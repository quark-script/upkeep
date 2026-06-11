import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Trophy, Flame, Clock, Dumbbell, ArrowRight, Pencil, Search, X, StickyNote } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { EXERCISES, SPLIT, COMPOUND_IDS, DAY_LABELS } from '../lib/data'
import { useLogDate } from '../lib/dateContext'
import { todayKey, parseKey } from '../lib/date'
import type { Session, WorkoutType, LiveSet, LiveLog, WorkoutDraft, Exercise } from '../lib/types'
import { Card, Pill, Btn, Divider } from '../components/ui'
import { DateStrip } from '../components/DateStrip'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeForDate(dateStr: string): WorkoutType {
  try {
    const override = localStorage.getItem(KEYS.dayOverride(dateStr))
    if (override) {
      const v = JSON.parse(override) as WorkoutType | 'REST'
      if (v && v !== 'REST') return v
    }
  } catch {}
  const t = SPLIT[parseKey(dateStr).getDay()]
  return t === 'REST' ? 'PUSH' : t
}

// Default per-day session — excludes optional (picker-only) lifts.
function getExercisesForDay(type: WorkoutType) {
  return EXERCISES.filter(e => e.day.includes(type) && !e.optional)
}

// Full library for the picker: this day's lifts first, then everything else.
function libraryForDay(type: WorkoutType): Exercise[] {
  const day = EXERCISES.filter(e => e.day.includes(type))
  const others = EXERCISES.filter(e => !e.day.includes(type))
  return [...day, ...others]
}

function getLastSets(
  sessions: Session[],
  type: WorkoutType,
  exerciseId: string
): { w: number; r: number } {
  const sorted = sessions
    .filter(s => s.type === type && s.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)

  for (const s of sorted) {
    const ex = s.exercises.find(e => e.exerciseId === exerciseId)
    const doneSets = ex?.sets.filter(st => st.done) ?? []
    if (doneSets.length > 0) {
      const top = doneSets.reduce((best, st) => st.weight > best.weight ? st : best)
      return { w: top.weight, r: top.reps }
    }
  }
  return { w: 20, r: 10 }
}

function defaultSetsFor(ex: Exercise, sessions: Session[], type: WorkoutType): LiveSet[] {
  const last = getLastSets(sessions, type, ex.id)
  return Array.from({ length: ex.defaultSets }, () => ({
    done: false, expW: last.w, expR: last.r, actW: last.w, actR: last.r,
  }))
}

function isStalled(
  sessions: Session[],
  type: WorkoutType,
  exerciseId: string
): boolean {
  if (!COMPOUND_IDS.has(exerciseId)) return false
  const past = sessions
    .filter(s => s.type === type && s.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 3)
  if (past.length < 3) return false
  const weights = past
    .map(s => {
      const ex = s.exercises.find(e => e.exerciseId === exerciseId)
      if (!ex || ex.sets.length === 0) return null
      return Math.max(...ex.sets.map(set => set.weight))
    })
    .filter((w): w is number => w !== null)
  if (weights.length < 3) return false
  return weights[0] === weights[1] && weights[1] === weights[2]
}

function fmtElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── NumField ─────────────────────────────────────────────────────────────────

function NumField({
  value,
  onChange,
  suffix,
  done,
}: {
  value: number
  onChange: (v: number) => void
  suffix: string
  done: boolean
}) {
  const [raw, setRaw] = useState(String(value))

  useEffect(() => {
    setRaw(String(value))
  }, [value])

  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <input
        inputMode="decimal"
        value={raw}
        onChange={e => {
          setRaw(e.target.value)
          const n = parseFloat(e.target.value)
          if (!isNaN(n)) onChange(n)
        }}
        onFocus={e => e.target.select()}
        style={{ width: '3.4ch' }}
        className={`bg-transparent border-none outline-none p-0 m-0 font-mono text-[18px] font-medium tracking-[-0.02em] text-left ${done ? 'text-accent' : 'text-text'}`}
      />
      <span className="font-mono text-[10px] text-text-dim tracking-[0.04em]">{suffix}</span>
    </div>
  )
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({
  idx,
  state,
  onUpdate,
  onLog,
  onUnlog,
}: {
  idx: number
  state: LiveSet
  onUpdate: (s: LiveSet) => void
  onLog: () => void
  onUnlog: () => void
}) {
  const { done } = state
  const dW = state.actW - state.expW
  const dR = state.actR - state.expR
  const hasDelta = done && (dW !== 0 || dR !== 0)
  const deltaPos = dW > 0 || (dW === 0 && dR > 0)

  return (
    <div
      className={`grid items-center gap-2 px-3.5 py-2.5 transition-colors ${idx > 0 ? 'border-t border-[var(--color-divider)]' : ''} ${done ? 'bg-[var(--color-accent-soft)]' : ''}`}
      style={{ gridTemplateColumns: '28px 1fr 1fr 60px 44px' }}
    >
      <span className="font-mono text-[11px] text-text-dim tracking-[0.06em]">
        {String(idx + 1).padStart(2, '0')}
      </span>

      <NumField value={state.actW} suffix="KG"   done={done} onChange={v => onUpdate({ ...state, actW: v })} />
      <NumField value={state.actR} suffix="REPS" done={done} onChange={v => onUpdate({ ...state, actR: v })} />

      <div
        className={`text-right font-mono text-[10px] tracking-[0.04em] ${
          !done ? 'text-text-faint' : hasDelta ? (deltaPos ? 'text-accent' : 'text-warn') : 'text-text-dim'
        }`}
      >
        {!done ? (
          <span>↳ {state.expW}×{state.expR}</span>
        ) : hasDelta ? (
          <>
            {dW !== 0 && <span>{dW > 0 ? '+' : ''}{dW}<span className="opacity-70">kg</span></span>}
            {dW !== 0 && dR !== 0 && <span> · </span>}
            {dR !== 0 && <span>{dR > 0 ? '+' : ''}{dR}r</span>}
          </>
        ) : (
          <span>= last</span>
        )}
      </div>

      <button
        onClick={() => (done ? onUnlog() : onLog())}
        className={`w-8 h-8 rounded-card flex items-center justify-center justify-self-end transition-colors ${done ? 'bg-accent' : 'bg-transparent border border-[var(--color-panel-border)]'}`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#EDEAE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  idx,
  isActive,
  onSelect,
  sets,
  onUpdateSet,
  onLog,
  onUnlog,
  onAddSet,
  onSkip,
  stalled,
  note,
  onNote,
}: {
  exercise: Exercise
  idx: number
  isActive: boolean
  onSelect: () => void
  sets: LiveSet[]
  onUpdateSet: (i: number, s: LiveSet) => void
  onLog: (i: number) => void
  onUnlog: (i: number) => void
  onAddSet: () => void
  onSkip: () => void
  stalled: boolean
  note: string
  onNote: (v: string) => void
}) {
  const completedCount = sets.filter(s => s.done).length
  const allDone = sets.length > 0 && completedCount === sets.length
  const pr = sets.some(s => s.done && s.actW > s.expW)
  const lastW = sets[0]?.expW ?? '–'
  const lastR = sets[0]?.expR ?? '–'

  return (
    <div
      className={`bg-panel rounded-card-lg overflow-hidden border shadow-card transition-colors ${isActive ? 'border-accent' : 'border-[var(--color-panel-border)]'}`}
    >
      {/* ── Header ── */}
      <div onClick={onSelect} className="px-4 py-3.5 flex items-start gap-2.5 cursor-pointer select-none">
        <div
          className={`w-[22px] h-[22px] rounded-pill shrink-0 mt-0.5 flex items-center justify-center font-mono text-[10px] font-semibold transition-colors ${allDone ? 'bg-accent text-accent-text' : 'bg-transparent text-text-dim border border-[var(--color-panel-border)]'}`}
        >
          {allDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#EDEAE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            idx + 1
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-[17px] text-text font-medium tracking-[-0.02em]">
              {exercise.name}
            </span>
            {stalled && <Pill color="warn">STALLED · 3</Pill>}
            {pr && <Pill color="accent">NEW PR</Pill>}
            {note.trim() && <Pill color="dim">NOTE</Pill>}
          </div>
          <div className="flex items-center gap-3 mt-1 font-mono text-[11px] text-text-dim tracking-[0.04em]">
            <span>{exercise.defaultSets} × {exercise.defaultReps}</span>
            <span className="opacity-40">·</span>
            <span>LAST: {lastW} KG × {lastR}</span>
          </div>
        </div>

        <span className="font-mono text-[13px] text-text-dim font-medium tracking-[0.04em] pt-0.5 shrink-0">
          {completedCount}/{sets.length}
        </span>
      </div>

      {/* ── Expanded sets ── */}
      {isActive && (
        <div className="border-t border-[var(--color-divider)]">
          <div
            className="grid items-center gap-2 px-3.5 py-2 font-mono text-[9px] text-text-faint uppercase tracking-[0.08em]"
            style={{ gridTemplateColumns: '28px 1fr 1fr 60px 44px' }}
          >
            <span>Set</span><span>Weight</span><span>Reps</span>
            <span className="text-right">vs last</span><span />
          </div>

          {sets.map((s, i) => (
            <SetRow
              key={i} idx={i} state={s}
              onUpdate={ns => onUpdateSet(i, ns)}
              onLog={() => onLog(i)}
              onUnlog={() => onUnlog(i)}
            />
          ))}

          <div className="px-3.5 py-2.5 border-t border-[var(--color-divider)] flex justify-between items-center">
            <button
              onClick={onAddSet}
              className="flex items-center gap-1.5 text-text-dim font-sans text-[11px] uppercase tracking-[0.06em] bg-transparent border-none cursor-pointer"
            >
              <Plus size={12} strokeWidth={1.8} /> Add set
            </button>
            <button
              onClick={onSkip}
              className="text-text-faint font-sans text-[11px] uppercase tracking-[0.06em] bg-transparent border-none cursor-pointer"
            >
              Skip
            </button>
          </div>

          <div className="px-3.5 py-2.5 border-t border-[var(--color-divider)] flex items-center gap-2">
            <StickyNote size={13} strokeWidth={1.7} className="text-text-faint shrink-0" />
            <input
              value={note}
              onChange={e => onNote(e.target.value)}
              placeholder="Note for this exercise…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[13px] text-text placeholder:text-text-faint"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SummaryOverlay ───────────────────────────────────────────────────────────

interface SummaryData {
  type: WorkoutType
  durationMin: number
  volume: number
  doneSets: number
  totalSets: number
  prs: string[]   // exercise names that hit a new PR
  exerciseLines: { name: string; sets: number; topWeight: number }[]
  manual: boolean
}

function SummaryOverlay({ data, onDone }: { data: SummaryData; onDone: () => void }) {
  const hasPRs = data.prs.length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-vault overflow-y-auto">
      <div className="max-w-[720px] mx-auto w-full px-4 md:px-8 pt-12 pb-28 md:pb-10 flex flex-col gap-6 min-h-full">
        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-4">
          <div className="w-16 h-16 rounded-[18px] bg-accent flex items-center justify-center mb-5 shadow-card">
            {hasPRs
              ? <Trophy size={28} strokeWidth={1.5} className="text-accent-text" />
              : <Flame  size={28} strokeWidth={1.5} className="text-accent-text" />
            }
          </div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em] mb-2">
            {data.manual ? 'Entry saved' : 'Session complete'}
          </p>
          <h1 className="font-serif text-[36px] leading-[40px] font-medium text-text tracking-[-0.05em]">
            {hasPRs ? 'New PRs hit.' : 'Work done.'}
          </h1>
          {hasPRs && (
            <p className="font-sans text-[14px] text-text-dim mt-2 leading-[20px]">
              {data.prs.join(' · ')}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Clock,    value: data.manual ? '—' : `${data.durationMin}`, unit: 'MIN'  },
            { icon: Dumbbell, value: `${Math.round(data.volume).toLocaleString()}`, unit: 'KG' },
            { icon: Trophy,   value: `${data.doneSets}/${data.totalSets}`, unit: 'SETS' },
          ].map(({ icon: Icon, value, unit }) => (
            <Card key={unit} className="flex flex-col items-center py-4 gap-1">
              <Icon size={14} strokeWidth={1.6} className="text-text-faint mb-1" />
              <span className="font-mono text-[22px] font-medium text-text tracking-[-0.03em]">{value}</span>
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]">{unit}</span>
            </Card>
          ))}
        </div>

        {/* Exercise breakdown */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">Exercises</p>
          <Card noPad>
            {data.exerciseLines.map((e, i) => (
              <div key={e.name}>
                {i > 0 && <Divider />}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-serif text-[15px] text-text font-medium">{e.name}</span>
                  <span className="font-mono text-[12px] text-text-dim tracking-[0.02em]">
                    {e.sets} sets · {e.topWeight > 0 ? `${e.topWeight} kg` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Btn fullWidth onClick={onDone} className="mt-auto">Back to today</Btn>
      </div>
    </div>
  )
}

// ─── Initial state loader ───────────────────────────────────────────────────────

interface InitState {
  type: WorkoutType
  added: Exercise[]              // exercises beyond the day defaults (library-optional or custom)
  log: LiveLog
  note: string
  notes: Record<string, string>
  activeId: string | null
  startedAt: number | null
  editingId: string | null
  started: boolean
}

function loadInitial(date: string, isToday: boolean, sessions: Session[]): InitState {
  // 1. Resume an in-progress / partially-entered draft.
  try {
    const raw = localStorage.getItem(KEYS.workoutDraft(date))
    if (raw) {
      const d = JSON.parse(raw) as WorkoutDraft
      if (d && d.log) {
        return {
          type: d.type,
          added: d.customExercises ?? [],
          log: d.log,
          note: d.note ?? '',
          notes: d.notes ?? {},
          activeId: d.activeId ?? null,
          startedAt: d.startedAt ?? null,
          editingId: d.editingId ?? null,
          started: true,
        }
      }
    }
  } catch {}

  // 2. Past day with an existing saved session → edit it.
  if (!isToday) {
    const existing = sessions.find(s => s.date === date && s.finishedAt !== null)
    if (existing) {
      const type = existing.type
      const defaults = getExercisesForDay(type)
      const log: LiveLog = {}
      const notes: Record<string, string> = {}
      const added: Exercise[] = []
      existing.exercises.forEach(el => {
        log[el.exerciseId] = el.sets.map(s => ({
          done: s.done, expW: s.weight, expR: s.reps, actW: s.weight, actR: s.reps,
        }))
        if (el.note) notes[el.exerciseId] = el.note
        // Anything not a default day lift is an "added" exercise (library-optional or custom).
        if (!defaults.some(d => d.id === el.exerciseId)) {
          const lib = EXERCISES.find(x => x.id === el.exerciseId)
          added.push(lib ?? {
            id: el.exerciseId,
            name: el.name ?? 'Custom exercise',
            defaultSets: el.sets.length || 3,
            defaultReps: '—',
            category: 'isolation' as const,
            day: [type], optional: true,
          })
        }
      })
      defaults.forEach(ex => { if (!log[ex.id]) log[ex.id] = defaultSetsFor(ex, sessions, type) })
      const ordered = [...defaults, ...added]
      return {
        type, added, log, notes,
        note: existing.note ?? '',
        activeId: ordered[0]?.id ?? null,
        startedAt: existing.startedAt,
        editingId: existing.id,
        started: true,
      }
    }
  }

  // 3. Fresh.
  const type = getTypeForDate(date)
  const exercises = getExercisesForDay(type)
  const log: LiveLog = {}
  exercises.forEach(ex => { log[ex.id] = defaultSetsFor(ex, sessions, type) })
  return {
    type, added: [], log, note: '', notes: {},
    activeId: exercises[0]?.id ?? null,
    startedAt: null, editingId: null,
    started: !isToday,   // manual entry needs no Begin gate
  }
}

// ─── Screen (per active date) ────────────────────────────────────────────────────

function WorkoutForDate({ date }: { date: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const isToday = date === todayKey()
  const mode: 'live' | 'manual' = isToday ? 'live' : 'manual'

  const init = useRef<InitState>(loadInitial(date, isToday, sessions)).current

  const [type, setType] = useState<WorkoutType>(init.type)
  const [added, setAdded] = useState<Exercise[]>(init.added)
  const [log, setLog] = useState<LiveLog>(init.log)
  const [note, setNote] = useState(init.note)
  const [notes, setNotes] = useState<Record<string, string>>(init.notes)
  const [activeId, setActiveId] = useState<string | null>(init.activeId)
  const [editingId, setEditingId] = useState<string | null>(init.editingId)
  const [started, setStarted] = useState(
    init.started || !!(location.state as { start?: boolean } | null)?.start
  )
  const [elapsed, setElapsed] = useState(0)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [showNote, setShowNote] = useState(!!init.note)
  const [showDiscard, setShowDiscard] = useState(false)
  const startRef = useRef<number | null>(init.startedAt)

  const exercises = [...getExercisesForDay(type), ...added]

  // Timer (live only)
  useEffect(() => {
    if (!started || mode !== 'live') return
    if (startRef.current === null) startRef.current = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [started, mode])

  // Auto-save draft on every meaningful change (this is the reload-safety fix).
  useEffect(() => {
    if (!started) return
    const draft: WorkoutDraft = {
      date, type, mode,
      startedAt: startRef.current,
      customExercises: added, log, note, notes, activeId, editingId,
      updatedAt: Date.now(),
    }
    try {
      localStorage.setItem(KEYS.workoutDraft(date), JSON.stringify(draft))
    } catch (err) {
      console.warn('failed to persist workout draft', err)
    }
  }, [started, date, type, mode, added, log, note, notes, activeId, editingId])

  const clearDraft = () => {
    try { localStorage.removeItem(KEYS.workoutDraft(date)) } catch {}
  }

  const totalSets = exercises.reduce((a, e) => a + (log[e.id]?.length ?? e.defaultSets), 0)
  const doneSets  = exercises.reduce((a, e) => a + (log[e.id]?.filter(s => s.done).length ?? 0), 0)
  const volume    = exercises.reduce(
    (acc, e) => acc + (log[e.id] ?? []).filter(s => s.done).reduce((a, s) => a + s.actW * s.actR, 0),
    0
  )

  const updateSet = (id: string, setIdx: number, ns: LiveSet) => {
    setLog(prev => ({ ...prev, [id]: prev[id].map((s, i) => (i === setIdx ? ns : s)) }))
  }

  const logSet = (id: string, setIdx: number) => {
    setLog(prev => ({ ...prev, [id]: prev[id].map((s, i) => (i === setIdx ? { ...s, done: true } : s)) }))
    navigator.vibrate?.(15)
    const currentSets = log[id] || []
    const allDoneAfter = currentSets.every((s, i) => i === setIdx || s.done)
    if (allDoneAfter) {
      const curPos = exercises.findIndex(e => e.id === id)
      const next = exercises[curPos + 1]
      if (next) setTimeout(() => setActiveId(next.id), 200)
    }
  }

  const unlogSet = (id: string, setIdx: number) => {
    setLog(prev => ({ ...prev, [id]: prev[id].map((s, i) => (i === setIdx ? { ...s, done: false } : s)) }))
  }

  const addSet = (id: string) => {
    setLog(prev => {
      const existing = prev[id] || []
      const ref = existing[existing.length - 1] ?? { expW: 20, expR: 10, actW: 20, actR: 10, done: false }
      return { ...prev, [id]: [...existing, { done: false, expW: ref.actW, expR: ref.actR, actW: ref.actW, actR: ref.actR }] }
    })
  }

  const skipExercise = (id: string) => {
    setLog(prev => ({ ...prev, [id]: (prev[id] || []).map(s => ({ ...s, done: false })) }))
    const curPos = exercises.findIndex(e => e.id === id)
    const next = exercises[curPos + 1]
    setActiveId(next ? next.id : null)
  }

  const closePicker = () => {
    setShowPicker(false); setPickerSearch(''); setAddingCustom(false); setNewExName('')
  }

  const addFromLibrary = (ex: Exercise) => {
    if (exercises.some(e => e.id === ex.id)) { setActiveId(ex.id); closePicker(); return }
    setAdded(prev => [...prev, ex])
    setLog(prev => ({ ...prev, [ex.id]: defaultSetsFor(ex, sessions, type) }))
    setActiveId(ex.id)
    closePicker()
  }

  const handleAddCustom = () => {
    const name = newExName.trim()
    if (!name) return
    const newEx: Exercise = {
      id: crypto.randomUUID(), name,
      defaultSets: 3, defaultReps: '10–12',
      category: 'isolation', day: [type], optional: true,
    }
    setAdded(prev => [...prev, newEx])
    setLog(prev => ({
      ...prev,
      [newEx.id]: Array.from({ length: 3 }, () => ({ done: false, expW: 20, expR: 10, actW: 20, actR: 10 })),
    }))
    setActiveId(newEx.id)
    closePicker()
  }

  // Switch workout type for a manual entry — rebuilds the exercise list fresh.
  const changeType = (next: WorkoutType) => {
    try { localStorage.setItem(KEYS.dayOverride(date), JSON.stringify(next)) } catch {}
    const ex = getExercisesForDay(next)
    const nl: LiveLog = {}
    ex.forEach(e => { nl[e.id] = defaultSetsFor(e, sessions, next) })
    setType(next)
    setAdded([])
    setLog(nl)
    setNotes({})
    setActiveId(ex[0]?.id ?? null)
    setEditingId(null)
  }

  const finishWorkout = useCallback(() => {
    const now = Date.now()
    const noon = parseKey(date).getTime() + 12 * 3600 * 1000
    const startedAt = mode === 'manual' ? noon : (startRef.current ?? now)
    const finishedAt = mode === 'manual' ? noon : now
    const id = editingId ?? crypto.randomUUID()

    const session: Session = {
      id, date, type, startedAt, finishedAt,
      note: note.trim() || undefined,
      exercises: exercises.map(ex => {
        const sets = (log[ex.id] || []).map(s => ({ weight: s.actW, reps: s.actR, done: s.done }))
        const skipped = sets.length > 0 && sets.every(s => !s.done)
        return { exerciseId: ex.id, name: ex.name, sets, skipped, note: notes[ex.id]?.trim() || undefined }
      }),
    }

    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (idx === -1) return [...prev, session]
      const copy = [...prev]; copy[idx] = session; return copy
    })
    clearDraft()

    const prs = exercises
      .filter(ex => (log[ex.id] || []).some(s => s.done && s.actW > s.expW))
      .map(e => e.name)
    const exerciseLines = exercises.map(ex => {
      const sets = (log[ex.id] || []).filter(s => s.done)
      const topWeight = sets.length ? Math.max(...sets.map(s => s.actW)) : 0
      return { name: ex.name, sets: sets.length, topWeight }
    }).filter(e => e.sets > 0)

    setSummary({
      type,
      durationMin: Math.round((now - (startRef.current ?? now)) / 60000),
      volume,
      doneSets,
      totalSets,
      prs,
      exerciseLines,
      manual: mode === 'manual',
    })
  }, [date, type, mode, editingId, exercises, log, note, notes, volume, doneSets, totalSets, setSessions])

  if (summary) {
    return <SummaryOverlay data={summary} onDone={() => navigate('/today')} />
  }

  // Live "Begin" gate (today, fresh, not yet started)
  if (mode === 'live' && !started) {
    return (
      <div className="pt-6 pb-8 flex flex-col gap-4">
        <DateStrip />
        <div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em]">Ready</p>
          <h1 className="font-serif text-[30px] leading-[34px] text-text font-medium tracking-[-0.04em] mt-1 capitalize">
            {type.toLowerCase()} day
          </h1>
        </div>
        <Card>
          <p className="font-sans text-[14px] text-text-dim leading-[22px]">{DAY_LABELS[type]}</p>
          <p className="font-mono text-[11px] text-text-faint mt-2 tracking-[0.04em]">
            {getExercisesForDay(type).length} exercises · tap Begin when you're ready
          </p>
        </Card>
        <Btn fullWidth onClick={() => setStarted(true)}>
          Begin workout <ArrowRight size={16} strokeWidth={1.6} />
        </Btn>
        <button
          onClick={() => navigate('/today')}
          className="w-full py-2.5 bg-transparent border-none font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] cursor-pointer"
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-8 flex flex-col gap-3.5">
      {/* ── Discard confirm modal ── */}
      {showDiscard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-24 md:p-4 md:items-center">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setShowDiscard(false)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-6">
            <p className="font-serif text-[22px] font-medium text-text tracking-[-0.03em] mb-2">
              {editingId ? 'Discard changes?' : 'Discard session?'}
            </p>
            <p className="font-sans text-[13px] text-text-dim leading-[20px] mb-6">
              {editingId
                ? 'Your edits to this entry will be lost. The saved version stays as it was.'
                : "Nothing will be saved. This session won't appear in your history."}
            </p>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowDiscard(false)} className="flex-1">Keep going</Btn>
              <button
                onClick={() => { clearDraft(); navigate('/today') }}
                className="flex-1 flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-card bg-danger text-accent-text font-sans font-semibold text-[13px] uppercase tracking-[0.04em] border-none cursor-pointer transition-all active:scale-[0.98]"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exercise picker ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={closePicker} />
          <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[78vh] mb-0">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">Add exercise</p>
              <button onClick={closePicker} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer">
                <X size={13} strokeWidth={2} className="text-text-dim" />
              </button>
            </div>

            {addingCustom ? (
              <div className="px-5 pb-6 flex flex-col gap-3">
                <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Custom exercise name</p>
                <input
                  autoFocus
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); if (e.key === 'Escape') setAddingCustom(false) }}
                  placeholder="e.g. Cable Fly"
                  className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3 font-sans text-[15px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors"
                />
                <div className="flex gap-2">
                  <Btn onClick={handleAddCustom} disabled={!newExName.trim()} className="flex-1">Add</Btn>
                  <Btn variant="secondary" onClick={() => { setAddingCustom(false); setNewExName('') }} className="flex-1">Back</Btn>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 pb-3">
                  <div className="flex items-center gap-2 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5">
                    <Search size={15} strokeWidth={1.8} className="text-text-faint shrink-0" />
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search exercises…"
                      className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[14px] text-text placeholder:text-text-faint"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto px-3 pb-3 flex-1">
                  {(() => {
                    const q = pickerSearch.trim().toLowerCase()
                    const present = new Set(exercises.map(e => e.id))
                    const list = libraryForDay(type).filter(e => !present.has(e.id) && (!q || e.name.toLowerCase().includes(q)))
                    if (list.length === 0) {
                      return <p className="text-center font-sans text-[13px] text-text-dim py-8">No matches. Try a custom exercise below.</p>
                    }
                    return list.map(ex => {
                      const onDay = ex.day.includes(type)
                      return (
                        <button
                          key={ex.id}
                          onClick={() => addFromLibrary(ex)}
                          className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-card text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset transition-colors"
                        >
                          <Plus size={14} strokeWidth={2} className="text-text-faint shrink-0" />
                          <span className="flex-1 min-w-0 font-sans text-[14px] text-text font-medium truncate">{ex.name}</span>
                          {!onDay && <Pill color="dim">{ex.day[0]}</Pill>}
                          <span className="font-mono text-[10px] text-text-dim tracking-[0.04em] shrink-0">{ex.defaultReps}</span>
                        </button>
                      )
                    })
                  })()}
                </div>

                <button
                  onClick={() => { setAddingCustom(true); setNewExName(pickerSearch) }}
                  className="flex items-center justify-center gap-2 px-5 py-4 border-t border-[var(--color-divider)] bg-transparent border-x-0 border-b-0 font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] font-medium cursor-pointer"
                >
                  <Plus size={13} strokeWidth={1.8} /> Custom exercise
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <DateStrip />

      {/* ── Header ── */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em] flex items-center gap-1.5">
            {mode === 'manual'
              ? <>{editingId ? <><Pencil size={11} strokeWidth={2} /> Editing</> : 'Manual entry'} · {format(parseKey(date), 'EEE MMM d')}</>
              : 'In session'}
          </p>
          <h1 className="font-serif text-[30px] leading-[34px] text-text font-medium tracking-[-0.04em] mt-1 capitalize">
            {type.toLowerCase()} day
          </h1>
          <button
            onClick={() => setShowDiscard(true)}
            className="mt-1 bg-transparent border-none font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] cursor-pointer hover:text-danger transition-colors p-0"
          >
            {editingId ? 'Discard changes' : 'Discard session'}
          </button>
        </div>
        {mode === 'live' ? (
          <div className="text-right">
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.1em]">Elapsed</p>
            <p className="font-mono text-[24px] text-text font-medium tracking-[-0.02em]">{fmtElapsed(elapsed)}</p>
          </div>
        ) : null}
      </div>

      {/* ── Manual type selector ── */}
      {mode === 'manual' && (
        <div className="flex gap-1.5">
          {(['PUSH', 'PULL', 'LEGS'] as const).map(t => (
            <button
              key={t}
              onClick={() => { if (t !== type) changeType(t) }}
              className={[
                'flex-1 py-2 rounded-card border font-sans text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors',
                t === type
                  ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                  : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── Progress bar ── */}
      <div>
        <div className="flex justify-between items-center mb-1.5 font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">
          <span>Sets · {doneSets}/{totalSets}</span>
          <span>Volume · <span className="text-text">{Math.round(volume).toLocaleString()} kg</span></span>
        </div>
        <div className="h-[3px] rounded-pill bg-panel-inset overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── Exercise list ── */}
      <div className="flex flex-col gap-2.5">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            idx={i}
            isActive={activeId === ex.id}
            onSelect={() => setActiveId(activeId === ex.id ? null : ex.id)}
            sets={log[ex.id] || []}
            onUpdateSet={(si, ns) => updateSet(ex.id, si, ns)}
            onLog={si => logSet(ex.id, si)}
            onUnlog={si => unlogSet(ex.id, si)}
            onAddSet={() => addSet(ex.id)}
            onSkip={() => skipExercise(ex.id)}
            stalled={isStalled(sessions, type, ex.id)}
            note={notes[ex.id] ?? ''}
            onNote={v => setNotes(prev => ({ ...prev, [ex.id]: v }))}
          />
        ))}
      </div>

      {/* ── Add exercise (picker) ── */}
      <button
        onClick={() => setShowPicker(true)}
        className="w-full py-3.5 rounded-card-lg bg-transparent border border-dashed border-[var(--color-panel-border)] text-text-dim font-sans text-xs uppercase tracking-[0.08em] font-medium flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus size={14} strokeWidth={1.8} /> Add exercise
      </button>

      {/* ── Workout note ── */}
      {showNote ? (
        <div className="bg-panel border border-[var(--color-panel-border)] rounded-card-lg p-4 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] flex items-center gap-1.5">
            <StickyNote size={12} strokeWidth={1.7} /> Workout note
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Felt strong today. Trainer: please check my squat depth."
            className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 font-sans text-[14px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors resize-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="w-full py-2.5 bg-transparent border-none font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] cursor-pointer flex items-center justify-center gap-1.5"
        >
          <StickyNote size={13} strokeWidth={1.7} /> Add workout note
        </button>
      )}

      {/* ── Finish / Save ── */}
      <Btn fullWidth onClick={finishWorkout}>
        {mode === 'manual'
          ? <>{editingId ? 'Save changes' : 'Save entry'} · {Math.round(volume).toLocaleString()} kg</>
          : <>Finish workout · {Math.round(volume).toLocaleString()} kg</>}
        <ArrowRight size={16} strokeWidth={1.6} />
      </Btn>
    </div>
  )
}

export default function Workout() {
  const { activeDate } = useLogDate()
  // Remount on date change so all per-day state re-initialises from its draft/session.
  return <WorkoutForDate key={activeDate} date={activeDate} />
}
