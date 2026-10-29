import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, X, Search,
  RotateCcw, Eye, EyeOff, AlertTriangle,
} from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { MUSCLE_LABELS } from '../lib/data'
import {
  resolveLibrary, searchLibrary, planFor, planIdsFor, setPlan, resetPlan, hasCustomPlan,
  setPrefs, clearPref, prefsFor, hideExercise, unhideExercise,
  customExercises, renameCustom, addToPlan, hiddenExercises,
} from '../lib/library'
import { overshooting, suggestedRange, stepFor } from '../lib/progression'
import { useToast } from '../lib/toast'
import type { Equipment, Exercise, LoadUnit, MuscleGroup, Session, WorkoutType } from '../lib/types'
import { PageTitle, Card, Btn, Pill, Divider } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'

const TYPES: WorkoutType[] = ['PUSH', 'PULL', 'LEGS']

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine',
  cable: 'Cable', bodyweight: 'Bodyweight', other: 'Other',
}
const EQUIPMENT_ORDER: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']

const UNITS: { value: LoadUnit; label: string }[] = [
  { value: 'kg', label: 'Weight' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'time', label: 'Timed' },
]

// ─── Small controls ──────────────────────────────────────────────────────────

function Stepper({ value, onChange, min, max, step = 1, suffix }: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  const btn = 'w-11 h-11 rounded-card flex items-center justify-center bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer text-text-dim disabled:opacity-30 disabled:cursor-not-allowed'
  return (
    <div className="flex items-center gap-2">
      <button className={btn} disabled={value <= min} onClick={() => onChange(+(value - step).toFixed(2))} aria-label="Decrease">
        <X size={12} strokeWidth={2} className="rotate-45" />
      </button>
      <span className="font-mono text-[15px] text-text font-medium min-w-[46px] text-center tabular-nums">
        {value}{suffix}
      </span>
      <button className={btn} disabled={value >= max} onClick={() => onChange(+(value + step).toFixed(2))} aria-label="Increase">
        <Plus size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

function Field({ label, hint, onReset, children }: {
  label: string
  hint?: string
  onReset?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 pt-1">
        <p className="font-sans text-[13px] text-text font-medium">{label}</p>
        {hint && <p className="font-sans text-[11.5px] text-text-dim leading-[15px] mt-0.5">{hint}</p>}
        {onReset && (
          <button
            onClick={onReset}
            className="mt-1 bg-transparent border-none p-0 font-mono text-[11px] text-text-faint uppercase tracking-[0.06em] cursor-pointer hover:text-text-dim transition-colors"
          >
            Reset to default
          </button>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Day plan editor ─────────────────────────────────────────────────────────

function DayPlanSection({ type, version, onChange }: {
  type: WorkoutType
  version: number
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const toast = useToast()
  const lifts = useMemo(() => planFor(type), [type, version])

  // Reorder and remove operate on the STORED ids, not the rendered (hidden-
  // filtered) list, so a hidden lift is never dropped as a side effect. The
  // rendered list is a subset, so map positions back through it.
  const move = (i: number, dir: -1 | 1) => {
    const ids = planIdsFor(type)
    const from = ids.indexOf(lifts[i].id)
    const to = ids.indexOf(lifts[i + dir]?.id ?? '')
    if (from < 0 || to < 0) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    setPlan(type, ids)
    onChange()
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none cursor-pointer text-left hover:bg-panel-inset/50 transition-colors"
      >
        <span className="flex-1 min-w-0">
          <span className="font-sans text-[14px] text-text font-medium capitalize block">{type.toLowerCase()} day</span>
          <span className="font-mono text-[11px] text-text-dim tracking-[0.02em] mt-0.5 block">
            {lifts.length} lifts{hasCustomPlan(type) ? ' · edited' : ''}
          </span>
        </span>
        {open
          ? <ChevronUp size={14} strokeWidth={1.8} className="text-text-faint shrink-0" />
          : <ChevronDown size={14} strokeWidth={1.8} className="text-text-faint shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3.5">
          {lifts.length === 0 && (
            <p className="font-sans text-[12.5px] text-text-dim px-1.5 py-2">
              No lifts on this day yet.
            </p>
          )}
          {lifts.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-1 px-1.5 py-1.5 rounded-card hover:bg-panel-inset/50 transition-colors">
              <span className="flex-1 min-w-0 font-sans text-[13.5px] text-text truncate">{ex.name}</span>
              <span className="font-mono text-[11px] text-text-dim shrink-0 mr-1">{ex.defaultSets}×{ex.defaultReps}</span>
              <button
                onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                className="w-11 h-11 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp size={13} strokeWidth={2} />
              </button>
              <button
                onClick={() => move(i, 1)} disabled={i === lifts.length - 1} aria-label="Move down"
                className="w-11 h-11 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown size={13} strokeWidth={2} />
              </button>
              <button
                onClick={() => {
                  setPlan(type, planIdsFor(type).filter(id => id !== ex.id))
                  onChange()
                }}
                aria-label={`Remove ${ex.name}`}
                className="w-11 h-11 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-danger transition-colors"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}

          <div className="flex gap-2 mt-2.5 px-1.5">
            <Btn variant="secondary" onClick={() => setPicking(true)} className="flex-1 !py-2 !text-[11px]">
              <Plus size={12} strokeWidth={2} /> Add lift
            </Btn>
            {hasCustomPlan(type) && (
              <Btn
                variant="secondary"
                onClick={() => { resetPlan(type); onChange(); toast({ message: `${type} day reset to default` }) }}
                className="flex-1 !py-2 !text-[11px]"
              >
                <RotateCcw size={12} strokeWidth={2} /> Reset
              </Btn>
            )}
          </div>
        </div>
      )}

      <ExercisePicker
        open={picking}
        type={type}
        title={`Add to ${type.toLowerCase()} day`}
        present={new Set(lifts.map(e => e.id))}
        onPick={ex => { addToPlan(type, ex.id); setPicking(false); onChange() }}
        onClose={() => setPicking(false)}
      />
    </>
  )
}

// ─── Per-exercise editor ─────────────────────────────────────────────────────

function ExerciseEditor({ ex, onClose, onChange }: {
  ex: Exercise
  onClose: () => void
  onChange: () => void
}) {
  const prefs = prefsFor(ex.id)
  const [name, setName] = useState(ex.name)
  const unit = ex.unit ?? 'kg'
  const derivedStep = stepFor(unit, ex.category).load
  const groups = ex.groups ?? []

  const update = (patch: Parameters<typeof setPrefs>[1]) => { setPrefs(ex.id, patch); onChange() }
  const reset = (field: Parameters<typeof clearPref>[1]) => { clearPref(ex.id, field); onChange() }

  const toggleGroup = (g: MuscleGroup) => {
    const next = groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g]
    update({ groups: next })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[86vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em] truncate pr-3">{ex.name}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer shrink-0">
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-7 divide-y divide-[var(--color-divider)]">
          {ex.custom && (
            <Field label="Name" hint="History follows the lift, not its name.">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => { if (name.trim() && name !== ex.name) { renameCustom(ex.id, name); onChange() } }}
                className="w-[150px] bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2.5 py-2 font-sans text-[13px] text-text outline-none focus:border-accent transition-colors"
              />
            </Field>
          )}

          <Field label="Sets" onReset={prefs.defaultSets !== undefined ? () => reset('defaultSets') : undefined}>
            <Stepper value={ex.defaultSets} min={1} max={10} onChange={v => update({ defaultSets: v })} />
          </Field>

          <Field
            label="Rep range"
            hint="More weight is offered after two sessions at the top of this range."
            onReset={prefs.defaultReps !== undefined ? () => reset('defaultReps') : undefined}
          >
            <input
              // Keyed on the value: an uncontrolled input keeps its old text
              // after "Reset to default" clears the pref, so the field would
              // still show the override it had just discarded.
              key={ex.defaultReps}
              defaultValue={ex.defaultReps}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== ex.defaultReps) update({ defaultReps: v }) }}
              placeholder="8–10"
              className="w-[86px] bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2.5 py-2 font-mono text-[13px] text-text text-center outline-none focus:border-accent transition-colors"
            />
          </Field>

          <Field label="Measured in" onReset={prefs.unit !== undefined ? () => reset('unit') : undefined}>
            <div className="flex rounded-card border border-[var(--color-panel-border)] overflow-hidden">
              {UNITS.map(u => (
                <button
                  key={u.value}
                  onClick={() => update({ unit: u.value })}
                  className={`px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.04em] border-none cursor-pointer transition-colors ${
                    unit === u.value ? 'bg-accent text-accent-text' : 'bg-panel-inset text-text-dim'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </Field>

          {unit !== 'time' && (
            <Field
              label="Load step"
              hint={`How much to add when a bump is earned. Default ${derivedStep} kg.`}
              onReset={prefs.step !== undefined ? () => reset('step') : undefined}
            >
              <Stepper
                value={ex.step ?? derivedStep}
                min={0.5} max={20} step={0.5} suffix=" kg"
                onChange={v => update({ step: v })}
              />
            </Field>
          )}

          <Field label="Muscles" hint="Drives the weekly balance chart." onReset={prefs.groups !== undefined ? () => reset('groups') : undefined}>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[190px]">
              {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map(g => (
                <button
                  key={g}
                  onClick={() => toggleGroup(g)}
                  className={`px-2 py-[3px] rounded-pill border font-mono text-[11px] uppercase tracking-[0.04em] font-medium cursor-pointer transition-colors ${
                    groups.includes(g)
                      ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                      : 'bg-transparent border-[var(--color-panel-border)] text-text-dim'
                  }`}
                >
                  {MUSCLE_LABELS[g]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Hidden" hint="Keeps it out of search. Past sessions still show it.">
            <button
              onClick={() => { prefs.hidden ? unhideExercise(ex.id) : hideExercise(ex.id); onChange(); onClose() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-card bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer font-sans text-[12px] text-text-dim"
            >
              {prefs.hidden ? <><Eye size={13} strokeWidth={1.8} /> Unhide</> : <><EyeOff size={13} strokeWidth={1.8} /> Hide</>}
            </button>
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExerciseSettings() {
  const navigate = useNavigate()
  const toast = useToast()
  const [sessions] = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Exercise | null>(null)

  const bump = () => setVersion(v => v + 1)

  const library = useMemo(() => resolveLibrary(), [version])
  const customCount = useMemo(() => customExercises().length, [version])

  const results = useMemo(
    // Any type ranks the same set; PUSH is only the tie-break for day ordering,
    // which is meaningless in a settings list that shows every lift anyway.
    () => (query.trim() ? searchLibrary(query, 'PUSH') : library),
    [query, library, version],
  )

  const grouped = useMemo(() => {
    const by = new Map<Equipment, Exercise[]>()
    for (const ex of results) {
      const eq = ex.equipment ?? 'other'
      const list = by.get(eq)
      if (list) list.push(ex)
      else by.set(eq, [ex])
    }
    return EQUIPMENT_ORDER.map(eq => [eq, by.get(eq) ?? []] as const).filter(([, l]) => l.length > 0)
  }, [results])

  const hidden = useMemo(() => hiddenExercises(), [version])

  // Lifts whose prescribed range no longer describes how they are trained.
  const drifted = useMemo(
    () => library
      .map(ex => ({ ex, range: overshooting(ex, sessions) ? suggestedRange(ex, sessions) : null }))
      .filter((x): x is { ex: Exercise; range: string } => x.range !== null),
    [library, sessions],
  )

  const openEditor = (ex: Exercise) => setEditing(ex)

  // Re-read the edited lift so the sheet reflects the write that just happened.
  const editingLive = editing
    ? resolveLibrary().find(e => e.id === editing.id) ?? editing
    : null

  return (
    <>
      <div className="pt-6 pb-8 flex flex-col gap-5">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1.5 self-start bg-transparent border-none p-0 font-mono text-[11px] text-text-dim uppercase tracking-[0.08em] cursor-pointer hover:text-text transition-colors"
        >
          <ChevronLeft size={13} strokeWidth={2} /> Settings
        </button>

        <PageTitle kicker="Settings" title="Exercises." />

        {drifted.length > 0 && (
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
              Needs attention
            </p>
            <Card noPad>
              {drifted.map(({ ex, range }, i) => (
                <div key={ex.id}>
                  {i > 0 && <Divider />}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-warn/10">
                      <AlertTriangle size={15} strokeWidth={1.7} className="text-warn" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[14px] text-text font-medium truncate">{ex.name}</p>
                      <p className="font-sans text-[11.5px] text-text-dim mt-0.5 leading-[15px]">
                        Trained well past {ex.defaultReps} for three sessions, so the range never fires.
                      </p>
                    </div>
                    <Btn
                      variant="secondary"
                      onClick={() => { setPrefs(ex.id, { defaultReps: range }); bump(); toast({ message: `${ex.name} now ${range}` }) }}
                      className="shrink-0 !py-2 !px-3 !text-[11px]"
                    >
                      {range}
                    </Btn>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
            Day plans
          </p>
          <Card noPad>
            {TYPES.map((t, i) => (
              <div key={t}>
                {i > 0 && <Divider />}
                <DayPlanSection type={t} version={version} onChange={bump} />
              </div>
            ))}
          </Card>
        </div>

        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
            All exercises · {library.length}{customCount > 0 ? ` · ${customCount} yours` : ''}
          </p>

          <div className="flex items-center gap-2 bg-panel border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 mb-2.5">
            <Search size={15} strokeWidth={1.8} className="text-text-faint shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your library…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[14px] text-text placeholder:text-text-faint"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-text-faint shrink-0">
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          {grouped.length === 0 ? (
            <Card>
              <p className="font-sans text-[13px] text-text-dim text-center py-3">No matches.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(([eq, list]) => (
                <div key={eq}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint px-1 mb-1.5">
                    {EQUIPMENT_LABELS[eq]} · {list.length}
                  </p>
                  <Card noPad>
                    {list.map((ex, i) => (
                      <div key={ex.id}>
                        {i > 0 && <Divider />}
                        <button
                          onClick={() => openEditor(ex)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset/50 transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="font-sans text-[13.5px] text-text font-medium block truncate">{ex.name}</span>
                            <span className="font-mono text-[10.5px] text-text-dim tracking-[0.02em] mt-0.5 block">
                              {ex.defaultSets} × {ex.defaultReps}
                              {ex.unit === 'time' ? ' · timed' : ex.unit === 'bodyweight' ? ' · bodyweight' : ''}
                            </span>
                          </span>
                          {ex.custom && <Pill color="dim">YOURS</Pill>}
                          <ChevronRight size={14} strokeWidth={1.6} className="text-text-faint shrink-0" />
                        </button>
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        {hidden.length > 0 && (
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
              Hidden · {hidden.length}
            </p>
            <Card noPad>
              {hidden.map((ex, i) => (
                <div key={ex.id}>
                  {i > 0 && <Divider />}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <span className="flex-1 min-w-0 font-sans text-[13.5px] text-text-dim truncate">{ex.name}</span>
                    <Btn
                      variant="secondary"
                      onClick={() => { unhideExercise(ex.id); bump() }}
                      className="shrink-0 !py-2 !px-3 !text-[11px]"
                    >
                      <Eye size={12} strokeWidth={1.8} /> Unhide
                    </Btn>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {editingLive && (
        <ExerciseEditor ex={editingLive} onClose={() => setEditing(null)} onChange={bump} />
      )}
    </>
  )
}
