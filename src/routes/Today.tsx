import { useNavigate } from 'react-router-dom'
import { Moon, AlertTriangle, ArrowRight, Dumbbell } from 'lucide-react'
import {
  format, startOfWeek, eachDayOfInterval, endOfWeek,
  isSameDay, isAfter, isBefore, subDays,
} from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { SPLIT, DAY_LABELS, COMPOUND_IDS, EXERCISES } from '../lib/data'
import type { Session, MeasurementEntry, SleepEntry, WorkoutType, Profile } from '../lib/types'
import { Card, Pill, Stat, SectionLabel, Divider, EmptyState } from '../components/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function calcStreak(sessions: Session[]): number {
  const finished = sessions.filter(s => s.finishedAt)
  if (finished.length === 0) return 0

  let streak = 0
  let cur = subDays(new Date(), 1)
  cur.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const dayType = SPLIT[cur.getDay()]
    if (dayType === 'REST') {
      cur = subDays(cur, 1)
      continue
    }
    const dateStr = format(cur, 'yyyy-MM-dd')
    if (finished.some(s => s.date === dateStr)) {
      streak++
      cur = subDays(cur, 1)
    } else {
      break
    }
  }
  return streak
}

function fmtSleepTime(h: number | undefined): string {
  if (h == null) return '—'
  const hh = Math.floor(h) % 24
  const mm = Math.round((h - Math.floor(h)) * 60)
  const ampm = hh < 12 ? 'AM' : 'PM'
  const disp = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${disp}:${String(mm).padStart(2, '0')} ${ampm}`
}

function stalledCompound(sessions: Session[], type: WorkoutType) {
  for (const ex of EXERCISES.filter(e => COMPOUND_IDS.has(e.id) && e.day.includes(type))) {
    const past = sessions
      .filter(s => s.type === type && s.finishedAt)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 3)
    if (past.length < 3) continue
    const ws = past
      .map(s => {
        const el = s.exercises.find(e => e.exerciseId === ex.id)
        if (!el?.sets.length) return null
        return Math.max(...el.sets.map(s => s.weight))
      })
      .filter((w): w is number => w !== null)
    if (ws.length === 3 && ws[0] === ws[1] && ws[1] === ws[2]) {
      return { name: ex.name, weight: ws[0] }
    }
  }
  return null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Today() {
  const navigate = useNavigate()
  const [sessions]     = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [measurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])
  const [profile]      = useLocalStorage<Profile | null>(KEYS.PROFILE, null)

  const today      = new Date()
  const todayStr   = format(today, 'yyyy-MM-dd')
  const ystdayStr  = format(subDays(today, 1), 'yyyy-MM-dd')

  const [proteinToday] = useLocalStorage<Record<string, boolean>>(KEYS.proteinDay(todayStr), {})
  const [sleepLast]    = useLocalStorage<SleepEntry>(KEYS.sleepDay(ystdayStr), {})

  const dayType      = SPLIT[today.getDay()]
  const isRest       = dayType === 'REST'
  const workoutType  = isRest ? null : (dayType as WorkoutType)

  const latestMeasure = [...measurements].sort((a, b) => b.date.localeCompare(a.date))[0]
  const bodyWeight    = latestMeasure?.weight

  const streak = calcStreak(sessions)

  const weekStart       = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays        = eachDayOfInterval({ start: weekStart, end: endOfWeek(today, { weekStartsOn: 1 }) })
  const weekSessionCount = sessions.filter(s => {
    const d = new Date(s.date)
    return !isBefore(d, weekStart) && !isAfter(d, today) && s.finishedAt
  }).length

  const proteinDoneCount = Object.values(proteinToday).filter(Boolean).length

  const stall = workoutType ? stalledCompound(sessions, workoutType) : null

  const recentSessions = [...sessions]
    .filter(s => s.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 4)

  const dotStates = weekDays.map(day => {
    const d   = day.getDay()
    const str = format(day, 'yyyy-MM-dd')
    const isToday = isSameDay(day, today)
    const isPast  = isBefore(day, today) && !isToday
    const done    = sessions.some(s => s.date === str && s.finishedAt)
    return {
      label:  ['S','M','T','W','T','F','S'][d],
      isRest: SPLIT[d] === 'REST',
      isToday,
      done,
      missed: isPast && SPLIT[d] !== 'REST' && !done,
    }
  })

  const sleepBedTime = sleepLast?.bed
  const sleepStatus  =
    sleepBedTime == null ? null :
    sleepBedTime < 22.75 ? 'on target' :
    sleepBedTime < 23.5  ? 'late'      : 'very late'

  return (
    <div className="pt-6 pb-8 flex flex-col gap-4">
      {/* ── Greeting ── */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em]">
            {format(today, "EEE · MMM d · 'Week' w")}
          </p>
          <h1 className="font-serif text-[30px] leading-[34px] text-text font-medium tracking-[-0.04em] mt-1">
            {greeting()},<br />{profile?.name ?? 'there'}.
          </h1>
        </div>
        <div className="w-[38px] h-[38px] rounded-pill bg-[var(--color-accent-soft)] border border-[var(--color-panel-border)] flex items-center justify-center font-mono text-[12px] text-accent font-semibold shrink-0">
          VP
        </div>
      </div>

      {/* ── Today's session hero ── */}
      <Card noPad className="overflow-hidden">
        <div className="px-[18px] pt-[18px] pb-3.5 flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.14em]">Today's session</p>
            <h2 className="font-serif text-[38px] leading-[40px] text-text font-medium tracking-[-0.06em] mt-1.5 capitalize">
              {isRest ? 'Rest day.' : `${dayType?.toLowerCase()} day.`}
            </h2>
            <p className="font-sans text-[13px] text-text-dim mt-1.5">
              {isRest ? 'Walk, hydrate, recover.' : workoutType ? DAY_LABELS[workoutType] : ''}
            </p>
          </div>
          {streak > 0 && <Pill color="accent" className="shrink-0 mt-1">{streak}d streak</Pill>}
        </div>
        <Divider />
        <div className="flex">
          {!isRest && (
            <button
              onClick={() => navigate('/workout')}
              className="flex-1 py-3.5 px-4 bg-accent text-accent-text font-sans text-[13px] font-semibold uppercase tracking-[0.06em] flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              Start workout <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}
          <button
            className={`${isRest ? 'flex-1' : ''} px-[18px] py-3.5 bg-transparent text-text-dim font-sans text-[12px] font-medium uppercase tracking-[0.04em] border-none border-l border-[var(--color-divider)] cursor-pointer`}
          >
            Change
          </button>
        </div>
      </Card>

      {/* ── Snapshot ── */}
      <div>
        <SectionLabel right={`WEEK ${format(today, 'w')}`}>Snapshot</SectionLabel>
        <Card>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Stat label="Body weight" value={bodyWeight != null ? bodyWeight.toFixed(1) : '–'} unit={bodyWeight != null ? 'KG' : ''} />
            <Stat label="Gym streak"  value={streak} unit={streak !== 1 ? 'DAYS' : 'DAY'} accent />
            <Stat label="Sessions"    value={`${weekSessionCount}/6`} unit="WK" />
            <Stat label="Protein"     value={`${proteinDoneCount}/6`} unit="TDY" />
          </div>
          {/* week dots */}
          <div className="mt-5 flex justify-between">
            {dotStates.map((dot, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] text-text-dim tracking-[0.05em]">{dot.label}</span>
                <div
                  className={[
                    'w-[18px] h-[18px] transition-colors',
                    dot.done                              ? 'bg-accent'      : '',
                    dot.isToday && !dot.done              ? 'border border-dashed border-accent bg-transparent' : '',
                    dot.missed                            ? 'bg-danger/30'   : '',
                    !dot.done && !dot.isToday && !dot.missed ? 'bg-panel-inset' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    borderRadius: dot.isRest ? 0 : 4,
                    transform: dot.isRest ? 'rotate(45deg) scale(0.6)' : 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Stall alert ── */}
      {stall && (
        <Card warnBorder className="flex gap-3 items-start">
          <AlertTriangle size={16} strokeWidth={1.6} className="text-warn mt-0.5 shrink-0" />
          <div>
            <p className="font-sans text-[13px] text-text font-semibold">{stall.name} stalled</p>
            <p className="font-sans text-[12px] text-text-dim mt-0.5 leading-[17px]">
              {stall.weight} kg for 3 sessions running. Push harder or check form.
            </p>
          </div>
        </Card>
      )}

      {/* ── Recent sessions ── */}
      {sessions.filter(s => s.finishedAt).length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="No sessions yet."
            sub="Complete your first workout and it'll appear here."
          />
        </Card>
      ) : recentSessions.length > 0 && (
        <div>
          <SectionLabel right="LAST 7 DAYS">Recent</SectionLabel>
          <Card noPad>
            {recentSessions.map((s, i) => {
              const vol = s.exercises.reduce(
                (acc, ex) => acc + ex.sets.filter(st => st.done).reduce((a, st) => a + st.weight * st.reps, 0),
                0
              )
              const dur = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null
              return (
                <div
                  key={s.id}
                  className={`flex items-center px-4 py-3.5 ${i < recentSessions.length - 1 ? 'border-b border-[var(--color-divider)]' : ''}`}
                >
                  <div
                    className={`w-1.5 h-9 rounded-full mr-3.5 shrink-0 ${s.type === 'PUSH' ? 'bg-accent' : s.type === 'PULL' ? 'bg-success/70' : 'bg-warn/70'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13px] text-text font-medium">
                      {s.type}{' '}
                      <span className="text-text-dim font-normal">· {format(new Date(s.date), 'EEE d MMM')}</span>
                    </p>
                    <p className="font-mono text-[11px] text-text-dim mt-0.5 tracking-[0.03em]">
                      {Math.round(vol).toLocaleString()} KG VOL{dur ? ` · ${dur} MIN` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      {/* ── Sleep last night ── */}
      <Card className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <Moon size={18} strokeWidth={1.6} className="text-text-dim" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Phone away · last night</p>
          <p className="font-mono text-[22px] text-text font-medium tracking-[-0.02em] mt-0.5">
            {fmtSleepTime(sleepLast?.phone)}
          </p>
        </div>
        {sleepStatus && (
          <Pill color={sleepStatus === 'on target' ? 'success' : sleepStatus === 'late' ? 'warn' : 'danger'}>
            {sleepStatus}
          </Pill>
        )}
      </Card>
    </div>
  )
}
