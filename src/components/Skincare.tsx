import { useState } from 'react'
import { Sun, Moon, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { todayKey } from '../lib/date'
import { isDue, scheduleLabel } from '../lib/routines'
import { ScheduleEditor } from './ScheduleEditor'
import type { SkinStep, SkinRoutine, SkinKind } from '../lib/types'
import { Card, Btn, Pill } from './ui'

const KINDS: SkinKind[] = ['cleanser', 'active', 'moisturiser', 'sunscreen', 'other']

const ROUTINES: { key: SkinRoutine; label: string; Icon: typeof Sun }[] = [
  { key: 'am', label: 'Morning', Icon: Sun },
  { key: 'pm', label: 'Night',   Icon: Moon },
]

// ─── Editor sheet ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  onSave,
  onDelete,
  onClose,
}: {
  step: SkinStep
  onSave: (s: SkinStep) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<SkinStep>(step)
  const set = <K extends keyof SkinStep>(k: K, v: SkinStep[K]) => setDraft(d => ({ ...d, [k]: v }))

  const field =
    'w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3 font-sans text-[15px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">
            {onDelete ? 'Edit step' : 'Add step'}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
          >
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Product</label>
            <input
              autoFocus={!onDelete}
              value={draft.label}
              onChange={e => set('label', e.target.value)}
              placeholder="e.g. Evening serum"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Brand</label>
              <input
                value={draft.brand ?? ''}
                onChange={e => set('brand', e.target.value)}
                placeholder="Brand (optional)"
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Type</label>
              <select
                value={draft.kind ?? 'other'}
                onChange={e => set('kind', e.target.value as SkinKind)}
                className={`${field} capitalize`}
              >
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Routine</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROUTINES.map(r => (
                <button
                  key={r.key}
                  onClick={() => set('routine', r.key)}
                  className={[
                    'flex items-center justify-center gap-1.5 py-2.5 rounded-card border font-sans text-[12px] font-semibold uppercase tracking-[0.04em] cursor-pointer transition-colors',
                    draft.routine === r.key
                      ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                      : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
                  ].join(' ')}
                >
                  <r.Icon size={13} strokeWidth={1.8} /> {r.label}
                </button>
              ))}
            </div>
          </div>

          <ScheduleEditor value={draft.schedule} onChange={s => set('schedule', s)} />

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Note</label>
            <input
              value={draft.note ?? ''}
              onChange={e => set('note', e.target.value)}
              placeholder="e.g. wait a minute before the next step"
              className={field}
            />
          </div>

          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-2 py-3 rounded-card bg-transparent border border-danger/40 text-danger font-sans text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
            >
              <Trash2 size={13} strokeWidth={1.8} /> Delete
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-7 shrink-0 border-t border-[var(--color-divider)]">
          <Btn fullWidth disabled={!draft.label.trim()} onClick={() => onSave({ ...draft, label: draft.label.trim() })}>
            Save
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function SkincareCard({ date, isToday }: { date: string; isToday: boolean }) {
  // An empty list is a valid routine for someone who does not track skincare.
  const [steps, setSteps] = useLocalStorage<SkinStep[]>(KEYS.SKINCARE, [])
  const [done, setDone] = useLocalStorage<Record<string, boolean>>(KEYS.skinDay(date), {})
  const [editing, setEditing] = useState<SkinStep | null>(null)
  const [adding, setAdding] = useState<SkinRoutine | null>(null)

  const active = steps.filter(s => s.active)
  const dueAll = active.filter(s => isDue(s.schedule, date))
  const doneCount = dueAll.filter(s => done[s.id]).length

  const upsert = (s: SkinStep) => {
    setSteps(prev => (prev.some(x => x.id === s.id) ? prev.map(x => (x.id === s.id ? s : x)) : [...prev, s]))
    setEditing(null)
    setAdding(null)
  }

  const remove = (id: string) => {
    setSteps(prev => prev.filter(x => x.id !== id))
    setEditing(null)
  }

  const toggleRoutine = (routine: SkinRoutine, on: boolean) => {
    const ids = active.filter(s => s.routine === routine && isDue(s.schedule, date)).map(s => s.id)
    setDone(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = on })
      return next
    })
  }

  const renderRoutine = (routine: SkinRoutine, label: string, Icon: typeof Sun) => {
    const mine = active
      .filter(s => s.routine === routine)
      .sort((a, b) => a.order - b.order)
    const due = mine.filter(s => isDue(s.schedule, date))
    const allDone = due.length > 0 && due.every(s => done[s.id])

    return (
      <div key={routine}>
        <div className="px-[18px] py-2.5 bg-panel-inset/40 border-y border-[var(--color-divider)] flex items-center gap-2">
          <Icon size={13} strokeWidth={1.8} className="text-text-dim shrink-0" />
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.1em] flex-1">{label}</p>
          {due.length > 0 && (
            <button
              onClick={() => toggleRoutine(routine, !allDone)}
              className="font-mono text-[9px] uppercase tracking-[0.08em] bg-transparent border-none cursor-pointer text-text-faint hover:text-accent transition-colors"
            >
              {allDone ? 'Undo all' : 'Mark all'}
            </button>
          )}
        </div>

        {mine.length === 0 && (
          <p className="font-sans text-[12px] text-text-faint px-[18px] py-4">No steps yet.</p>
        )}

        {mine.map((s, i) => {
          const on = !!done[s.id]
          const scheduledToday = isDue(s.schedule, date)
          return (
            <div
              key={s.id}
              className={[
                'w-full flex items-center gap-3 px-[18px] transition-colors',
                on ? 'bg-[var(--color-accent-soft)]' : 'bg-transparent',
                i < mine.length - 1 ? 'border-b border-[var(--color-divider)]' : '',
              ].join(' ')}
            >
              <button
                onClick={() => setDone(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                className="flex-1 min-w-0 flex items-center gap-3 py-3 text-left bg-transparent border-none cursor-pointer"
              >
                <span className="font-mono text-[10px] text-text-faint w-[14px] shrink-0">{s.order}</span>
                <span
                  className={[
                    'w-[22px] h-[22px] rounded-card flex items-center justify-center shrink-0 transition-colors',
                    on ? 'bg-accent' : scheduledToday
                      ? 'bg-transparent border border-[var(--color-panel-border)]'
                      : 'bg-transparent border border-dashed border-[var(--color-panel-border)]',
                  ].join(' ')}
                >
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#EDEAE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`font-sans text-[13.5px] font-medium block truncate ${on ? 'text-text-dim line-through decoration-text-faint' : scheduledToday ? 'text-text' : 'text-text-dim'}`}>
                    {s.label}
                  </span>
                  <span className="block font-mono text-[10px] text-text-dim tracking-[0.03em] mt-0.5 truncate">
                    {s.brand ? `${s.brand} · ` : ''}
                    {scheduledToday ? (s.note ?? scheduleLabel(s.schedule)) : `Not today · ${scheduleLabel(s.schedule)}`}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setEditing(s)}
                aria-label={`Edit ${s.label}`}
                className="w-7 h-7 flex items-center justify-center bg-transparent border-none cursor-pointer text-text-faint hover:text-text transition-colors shrink-0"
              >
                <Pencil size={13} strokeWidth={1.8} />
              </button>
            </div>
          )
        })}

        <button
          onClick={() => setAdding(routine)}
          className="w-full py-2.5 px-[18px] bg-transparent border-none flex items-center justify-center gap-2 text-text-faint font-sans text-[11px] uppercase tracking-[0.08em] font-medium cursor-pointer hover:text-text-dim transition-colors"
        >
          <Plus size={11} strokeWidth={1.8} /> Add {label.toLowerCase()} step
        </button>
      </div>
    )
  }

  return (
    <Card noPad>
      <div className="px-[18px] pt-[18px] pb-3.5 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <Sun size={18} strokeWidth={1.6} className="text-text" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">
            {isToday ? 'Skincare today' : 'Skincare'}
          </p>
          <p className="font-serif text-[22px] text-text font-medium tracking-[-0.03em] mt-0.5">
            {dueAll.length === 0
              ? 'Nothing scheduled.'
              : doneCount === dueAll.length ? 'Routine done.' : `${dueAll.length - doneCount} step${dueAll.length - doneCount === 1 ? '' : 's'} left.`}
          </p>
        </div>
        {dueAll.length > 0 && (
          <Pill color={doneCount === dueAll.length ? 'success' : 'dim'}>{doneCount}/{dueAll.length}</Pill>
        )}
      </div>

      {ROUTINES.map(r => renderRoutine(r.key, r.label, r.Icon))}

      {editing && (
        <StepEditor
          step={editing}
          onSave={upsert}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <StepEditor
          step={{
            id: crypto.randomUUID(),
            label: '',
            kind: 'other',
            routine: adding,
            order: Math.max(0, ...steps.filter(s => s.routine === adding).map(s => s.order)) + 1,
            schedule: { kind: 'daily' },
            startedOn: todayKey(),
            active: true,
          }}
          onSave={upsert}
          onClose={() => setAdding(null)}
        />
      )}
    </Card>
  )
}
