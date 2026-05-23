import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Trophy, Flame, Clock, Dumbbell, ArrowRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { EXERCISES, SPLIT, COMPOUND_IDS, DAY_LABELS } from '../lib/data'
import type { Session, WorkoutType, LiveSet } from '../lib/types'
import { Card, Pill, Btn, Divider, EmptyState } from '../components/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayType(): WorkoutType | 'REST' {
  const todayStr = new Date().toISOString().split('T')[0]
  try {
    const override = localStorage.getItem(KEYS.dayOverride(todayStr))
    if (override) return JSON.parse(override) as WorkoutType | 'REST'
  } catch {}
  return SPLIT[new Date().getDay()]
}

function getExercisesForDay(type: WorkoutType) {
  return EXERCISES.filter(e => e.day.includes(type))
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

type ExerciseEntry = (typeof EXERCISES)[0]

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
}: {
  exercise: ExerciseEntry
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
}

function SummaryOverlay({ data, onDone }: { data: SummaryData; onDone: () => void }) {
  const hasPRs = data.prs.length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-vault overflow-y-auto">
      <div className="max-w-[720px] mx-auto w-full px-4 md:px-8 pt-12 pb-10 flex flex-col gap-6 min-h-full">
        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-4">
          <div className="w-16 h-16 rounded-[18px] bg-accent flex items-center justify-center mb-5 shadow-card">
            {hasPRs
              ? <Trophy size={28} strokeWidth={1.5} className="text-accent-text" />
              : <Flame  size={28} strokeWidth={1.5} className="text-accent-text" />
            }
          </div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em] mb-2">Session complete</p>
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
            { icon: Clock,    value: `${data.durationMin}`,     unit: 'MIN'  },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

type LiveLog = Record<number, LiveSet[]>

export default function Workout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [started, setStarted] = useState(() => !!(location.state as { start?: boolean } | null)?.start)
  const [sessions, setSessions] = useLocalStorage<Session[]>(KEYS.SESSIONS, [])

  const todayType = getTodayType()
  const workoutType: WorkoutType = todayType === 'REST' ? 'PUSH' : todayType
  const baseExercises = getExercisesForDay(workoutType)
  const [customExercises, setCustomExercises] = useState<ExerciseEntry[]>([])
  const exercises = [...baseExercises, ...customExercises]

  const buildInitialLog = useCallback((): LiveLog => {
    const log: LiveLog = {}
    exercises.forEach((ex, i) => {
      const last = getLastSets(sessions, workoutType, ex.id)
      log[i] = Array.from({ length: ex.defaultSets }, () => ({
        done: false,
        expW: last.w,
        expR: last.r,
        actW: last.w,
        actR: last.r,
      }))
    })
    return log
  }, []) // intentionally empty — only run once on mount

  const [log, setLog] = useState<LiveLog>(buildInitialLog)
  const [activeIdx, setActiveIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [showDiscard, setShowDiscard] = useState(false)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!started) return
    if (startRef.current === null) startRef.current = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [started])

  const totalSets = exercises.reduce((a, e) => a + e.defaultSets, 0)
  const doneSets  = Object.values(log).reduce((a, arr) => a + arr.filter(s => s.done).length, 0)
  const volume    = Object.values(log).reduce(
    (acc, arr) => acc + arr.filter(s => s.done).reduce((a, s) => a + s.actW * s.actR, 0),
    0
  )

  const updateSet = (exIdx: number, setIdx: number, ns: LiveSet) => {
    setLog(prev => ({
      ...prev,
      [exIdx]: prev[exIdx].map((s, i) => (i === setIdx ? ns : s)),
    }))
  }

  const logSet = (exIdx: number, setIdx: number) => {
    setLog(prev => ({
      ...prev,
      [exIdx]: prev[exIdx].map((s, i) => (i === setIdx ? { ...s, done: true } : s)),
    }))
    navigator.vibrate?.(15)
    // auto-advance to next exercise when current exercise is fully done
    const currentSets = log[exIdx] || []
    const allDoneAfter = currentSets.every((s, i) => i === setIdx || s.done)
    if (allDoneAfter) {
      const nextEx = exercises.findIndex((_, i) => i > exIdx)
      if (nextEx !== -1) setTimeout(() => setActiveIdx(nextEx), 200)
    }
  }

  const unlogSet = (exIdx: number, setIdx: number) => {
    setLog(prev => ({
      ...prev,
      [exIdx]: prev[exIdx].map((s, i) => (i === setIdx ? { ...s, done: false } : s)),
    }))
  }

  const addSet = (exIdx: number) => {
    setLog(prev => {
      const existing = prev[exIdx] || []
      const ref = existing[existing.length - 1] ?? { expW: 20, expR: 10, actW: 20, actR: 10, done: false }
      return {
        ...prev,
        [exIdx]: [...existing, { done: false, expW: ref.actW, expR: ref.actR, actW: ref.actW, actR: ref.actR }],
      }
    })
  }

  const skipExercise = (exIdx: number) => {
    setLog(prev => ({
      ...prev,
      [exIdx]: (prev[exIdx] || []).map(s => ({ ...s, done: false })),
    }))
    // collapse and advance
    const nextEx = exercises.findIndex((_, i) => i > exIdx)
    setActiveIdx(nextEx !== -1 ? nextEx : -1)
  }

  const handleAddExercise = () => {
    const name = newExName.trim()
    if (!name) return
    const newEx: ExerciseEntry = {
      id: crypto.randomUUID(),
      name,
      defaultSets: 3,
      defaultReps: '10–12',
      category: 'isolation',
      day: [workoutType],
    }
    const newIdx = exercises.length
    setCustomExercises(prev => [...prev, newEx])
    setLog(prev => ({
      ...prev,
      [newIdx]: Array.from({ length: 3 }, () => ({ done: false, expW: 20, expR: 10, actW: 20, actR: 10 })),
    }))
    setActiveIdx(newIdx)
    setNewExName('')
    setShowAddExercise(false)
  }

  const finishWorkout = () => {
    const finishedAt = Date.now()
    const session: Session = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: workoutType,
      startedAt: startRef.current ?? finishedAt,
      finishedAt,
      exercises: exercises.map((ex, i) => {
        const sets = (log[i] || []).map(s => ({ weight: s.actW, reps: s.actR, done: s.done }))
        const skipped = sets.length > 0 && sets.every(s => !s.done)
        return { exerciseId: ex.id, sets, skipped }
      }),
    }
    setSessions(prev => [...prev, session])

    // Build summary
    const totalSets = exercises.reduce((a, e) => a + e.defaultSets, 0)
    const doneSets  = Object.values(log).reduce((a, arr) => a + arr.filter(s => s.done).length, 0)
    const vol       = Object.values(log).reduce(
      (acc, arr) => acc + arr.filter(s => s.done).reduce((a, s) => a + s.actW * s.actR, 0), 0
    )
    const prs = exercises
      .filter((_, i) => (log[i] || []).some(s => s.done && s.actW > s.expW))
      .map(e => e.name)
    const exerciseLines = exercises.map((ex, i) => {
      const sets = (log[i] || []).filter(s => s.done)
      const topWeight = sets.length ? Math.max(...sets.map(s => s.actW)) : 0
      return { name: ex.name, sets: sets.length, topWeight }
    }).filter(e => e.sets > 0)

    setSummary({
      type: workoutType,
      durationMin: Math.round((finishedAt - (startRef.current ?? finishedAt)) / 60000),
      volume: vol,
      doneSets,
      totalSets,
      prs,
      exerciseLines,
    })
  }

  if (summary) {
    return <SummaryOverlay data={summary} onDone={() => navigate('/today')} />
  }

  if (!started) {
    return (
      <div className="pt-6 pb-8 flex flex-col gap-4">
        <div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em]">Ready</p>
          <h1 className="font-serif text-[30px] leading-[34px] text-text font-medium tracking-[-0.04em] mt-1 capitalize">
            {workoutType.toLowerCase()} day
          </h1>
        </div>
        <Card>
          <p className="font-sans text-[14px] text-text-dim leading-[22px]">
            {DAY_LABELS[workoutType]}
          </p>
          <p className="font-mono text-[11px] text-text-faint mt-2 tracking-[0.04em]">
            {getExercisesForDay(workoutType).length} exercises · tap Begin when you're ready
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
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setShowDiscard(false)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-6">
            <p className="font-serif text-[22px] font-medium text-text tracking-[-0.03em] mb-2">Discard session?</p>
            <p className="font-sans text-[13px] text-text-dim leading-[20px] mb-6">
              Nothing will be saved. This session won't appear in your history.
            </p>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setShowDiscard(false)} className="flex-1">Keep going</Btn>
              <button
                onClick={() => navigate('/today')}
                className="flex-1 flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-card bg-danger text-accent-text font-sans font-semibold text-[13px] uppercase tracking-[0.04em] border-none cursor-pointer transition-all active:scale-[0.98]"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em]">In session</p>
          <h1 className="font-serif text-[30px] leading-[34px] text-text font-medium tracking-[-0.04em] mt-1 capitalize">
            {workoutType.toLowerCase()} day
          </h1>
          <button
            onClick={() => setShowDiscard(true)}
            className="mt-1 bg-transparent border-none font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] cursor-pointer hover:text-danger transition-colors p-0"
          >
            Discard session
          </button>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.1em]">Elapsed</p>
          <p className="font-mono text-[24px] text-text font-medium tracking-[-0.02em]">
            {fmtElapsed(elapsed)}
          </p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div>
        <div className="flex justify-between items-center mb-1.5 font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">
          <span>Sets · {doneSets}/{totalSets}</span>
          <span>Volume · <span className="text-text">{Math.round(volume).toLocaleString()} kg</span></span>
        </div>
        <div className="h-[3px] rounded-pill bg-panel-inset overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${(doneSets / totalSets) * 100}%` }}
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
            isActive={activeIdx === i}
            onSelect={() => setActiveIdx(i === activeIdx ? -1 : i)}
            sets={log[i] || []}
            onUpdateSet={(si, ns) => updateSet(i, si, ns)}
            onLog={si => logSet(i, si)}
            onUnlog={si => unlogSet(i, si)}
            onAddSet={() => addSet(i)}
            onSkip={() => skipExercise(i)}
            stalled={isStalled(sessions, workoutType, ex.id)}
          />
        ))}
      </div>

      {/* ── Add exercise ── */}
      {showAddExercise ? (
        <div className="bg-panel border border-accent rounded-card-lg p-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Exercise name</p>
          <input
            autoFocus
            type="text"
            value={newExName}
            onChange={e => setNewExName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddExercise(); if (e.key === 'Escape') setShowAddExercise(false) }}
            placeholder="e.g. Cable Fly"
            className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3 font-sans text-[15px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors"
          />
          <div className="flex gap-2">
            <Btn onClick={handleAddExercise} disabled={!newExName.trim()} className="flex-1">Add</Btn>
            <Btn variant="secondary" onClick={() => { setShowAddExercise(false); setNewExName('') }} className="flex-1">Cancel</Btn>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddExercise(true)}
          className="w-full py-3.5 rounded-card-lg bg-transparent border border-dashed border-[var(--color-panel-border)] text-text-dim font-sans text-xs uppercase tracking-[0.08em] font-medium flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={14} strokeWidth={1.8} /> Add exercise
        </button>
      )}

      {/* ── Finish ── */}
      <Btn fullWidth onClick={finishWorkout}>
        Finish workout · {Math.round(volume).toLocaleString()} kg
        <ArrowRight size={16} strokeWidth={1.6} />
      </Btn>
    </div>
  )
}
