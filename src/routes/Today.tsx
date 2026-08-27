import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, AlertTriangle, ArrowRight, Dumbbell, X, History as HistoryIcon, Settings } from 'lucide-react'
import {
  format, startOfWeek, eachDayOfInterval, endOfWeek,
  isSameDay, isAfter, isBefore, subDays,
} from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { todayKey, dateKey, parseKey } from '../lib/date'
import { SPLIT, DAY_LABELS, COMPOUND_IDS } from '../lib/data'
import { planFor } from '../lib/library'
import { targets } from '../lib/nutrition'
import { calcStreak, TRAINING_DAYS_PER_WEEK } from '../lib/schedule'
import { sessionVolume } from '../lib/stats'
import { sleepDurationH } from '../lib/sleep'
import { useToast } from '../lib/toast'
import type { Session, MeasurementEntry, SleepEntry, WorkoutType, Profile, FoodEntry } from '../lib/types'
import { Card, Pill, Stat, SectionLabel, Divider, EmptyState, Btn } from '../components/ui'
import { InstallPrompt } from '../components/InstallPrompt'
import { RoutineSummary } from '../components/RoutineSummary'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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
  for (const ex of planFor(type).filter(e => COMPOUND_IDS.has(e.id))) {
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
  const toast = useToast()
  const [sessions, setSessions] = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [measurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])
  const [profile]      = useLocalStorage<Profile | null>(KEYS.PROFILE, null)
  const [showChange, setShowChange] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [hasTodayDraft] = useState(() => {
    try { return !!localStorage.getItem(KEYS.workoutDraft(todayKey())) } catch { return false }
  })

  const today      = new Date()
  const todayStr   = dateKey(today)
  const ystdayStr  = dateKey(subDays(today, 1))

  const [foodToday]     = useLocalStorage<FoodEntry[]>(KEYS.foodDay(todayStr), [])
  const [sleepLast]     = useLocalStorage<SleepEntry>(KEYS.sleepDay(ystdayStr), {})
  const [dayOverride, setDayOverride] = useLocalStorage<WorkoutType | 'REST' | null>(KEYS.dayOverride(todayStr), null)

  const dayType      = dayOverride ?? SPLIT[today.getDay()]
  const isRest       = dayType === 'REST'
  const workoutType  = isRest ? null : (dayType as WorkoutType)

  const latestMeasure = [...measurements].sort((a, b) => b.date.localeCompare(a.date))[0]
  const bodyWeight    = latestMeasure?.weight

  const streak = calcStreak(sessions)

  const weekStart       = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays        = eachDayOfInterval({ start: weekStart, end: endOfWeek(today, { weekStartsOn: 1 }) })
  const weekSessionCount = sessions.filter(s => {
    const d = parseKey(s.date)
    return !isBefore(d, weekStart) && !isAfter(d, today) && s.finishedAt
  }).length

  // Summed from the hook's own value, so the tiles follow a log without a reload.
  const eatenToday = foodToday.reduce(
    (a, e) => ({ kcal: a.kcal + e.macros.kcal, protein: a.protein + e.macros.protein }),
    { kcal: 0, protein: 0 },
  )
  const macroTargets = targets()

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

  // A restore reloads the app; surface the result once we're back on Today.
  useEffect(() => {
    const note = sessionStorage.getItem('upkeep:restore-note')
    if (note) {
      sessionStorage.removeItem('upkeep:restore-note')
      toast({ message: note })
    }
  }, [toast])

  const sleepHours = sleepDurationH(sleepLast ?? {})

  const sleepBedTime = sleepLast?.bed
  const sleepStatus  =
    sleepBedTime == null ? null :
    sleepBedTime < 22.75 ? 'on target' :
    sleepBedTime < 23.5  ? 'late'      : 'very late'

  return (
    <div className="pt-6 pb-8 flex flex-col gap-4">
      {/* ── Delete session confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-24 md:p-4 md:items-center">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-6">
            <p className="font-serif text-[22px] font-medium text-text tracking-[-0.03em] mb-2">Delete session?</p>
            <p className="font-sans text-[13px] text-text-dim leading-[20px] mb-6">
              This session will be permanently removed from your history.
            </p>
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Btn>
              <button
                onClick={() => {
                  const removed = sessions.find(s => s.id === deleteId)
                  setSessions(prev => prev.filter(s => s.id !== deleteId))
                  setDeleteId(null)
                  if (removed) {
                    toast({
                      message: `${removed.type} session deleted.`,
                      actionLabel: 'Undo',
                      onAction: () => setSessions(prev =>
                        prev.some(s => s.id === removed.id) ? prev : [...prev, removed],
                      ),
                    })
                  }
                }}
                className="flex-1 flex items-center justify-center px-[18px] py-3.5 rounded-card bg-danger text-accent-text font-sans font-semibold text-[13px] uppercase tracking-[0.04em] border-none cursor-pointer transition-all active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
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
        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="relative w-[38px] h-[38px] rounded-pill bg-[var(--color-accent-soft)] border border-[var(--color-panel-border)] flex items-center justify-center font-mono text-[12px] text-accent font-semibold shrink-0 cursor-pointer transition-transform active:scale-95"
        >
          {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'UK'}
          <span className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-panel border border-[var(--color-panel-border)] flex items-center justify-center">
            <Settings size={9} strokeWidth={2} className="text-text-dim" />
          </span>
        </button>
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
              onClick={() => navigate('/workout', hasTodayDraft ? undefined : { state: { start: true } })}
              className="flex-1 py-3.5 px-4 bg-accent text-accent-text font-sans text-[13px] font-semibold uppercase tracking-[0.06em] flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              {hasTodayDraft ? 'Resume workout' : 'Start workout'} <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={() => setShowChange(true)}
            className={`${isRest ? 'flex-1' : ''} px-[18px] py-3.5 bg-transparent text-text-dim font-sans text-[12px] font-medium uppercase tracking-[0.04em] border-none border-l border-[var(--color-divider)] cursor-pointer`}
          >
            Change
          </button>
        </div>
      </Card>

      <InstallPrompt />

      {/* ── Snapshot ── */}
      <div>
        <SectionLabel right={`WEEK ${format(today, 'w')}`}>Snapshot</SectionLabel>
        <Card>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 [&>*:last-child:nth-child(odd)]:col-span-2">
            <Stat label="Body weight" value={bodyWeight != null ? bodyWeight.toFixed(1) : '–'} unit={bodyWeight != null ? 'KG' : ''} />
            <Stat label="Gym streak"  value={streak} unit={streak !== 1 ? 'DAYS' : 'DAY'} accent />
            <Stat label="Sessions"    value={`${weekSessionCount}/${TRAINING_DAYS_PER_WEEK}`} unit="WK" />
            <Stat
              label="Calories"
              value={eatenToday.kcal}
              unit={`/ ${macroTargets.kcal}`}
              accent={eatenToday.kcal >= macroTargets.kcal}
            />
            <Stat
              label="Protein"
              value={Math.round(eatenToday.protein)}
              unit={`/ ${macroTargets.protein} G`}
              accent={eatenToday.protein >= macroTargets.protein}
            />
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

      {/* ── Meds & skincare due today ── */}
      <RoutineSummary date={todayStr} />

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
              const vol = sessionVolume(s)
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
                      <span className="text-text-dim font-normal">· {format(parseKey(s.date), 'EEE d MMM')}</span>
                    </p>
                    <p className="font-mono text-[11px] text-text-dim mt-0.5 tracking-[0.03em]">
                      {Math.round(vol).toLocaleString()} KG VOL{dur ? ` · ${dur} MIN` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteId(s.id)}
                    className="ml-3 w-7 h-7 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                    aria-label="Delete session"
                  >
                    <X size={13} strokeWidth={1.8} />
                  </button>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      {/* ── View history ── */}
      <button
        onClick={() => navigate('/history')}
        className="flex items-center justify-center gap-2 py-2.5 bg-transparent border-none font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] font-medium cursor-pointer hover:text-text transition-colors"
      >
        <HistoryIcon size={13} strokeWidth={1.8} /> View past days
      </button>

      {/* ── Sleep last night ── */}
      <Card
        className="flex items-center gap-3.5"
        onClick={() => navigate('/daily')}
      >
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <Moon size={18} strokeWidth={1.6} className="text-text-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Last night</p>
          <p className="font-mono text-[22px] text-text font-medium tracking-[-0.02em] mt-0.5">
            {sleepHours != null ? `${sleepHours.toFixed(1)}h` : '—'}
          </p>
          <p className="font-mono text-[10px] text-text-dim tracking-[0.04em] mt-0.5">
            PHONE {fmtSleepTime(sleepLast?.phone)}
            {sleepLast?.quality != null && ` · RESTED ${sleepLast.quality}/5`}
          </p>
        </div>
        {sleepStatus && (
          <Pill color={sleepStatus === 'on target' ? 'success' : sleepStatus === 'late' ? 'warn' : 'danger'}>
            {sleepStatus}
          </Pill>
        )}
      </Card>

      {/* ── Day override modal ── */}
      {showChange && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setShowChange(false)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card p-5 pb-7 md:pb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">Change today's session</p>
              <button onClick={() => setShowChange(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer">
                <X size={13} strokeWidth={2} className="text-text-dim" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {(['PUSH', 'PULL', 'LEGS', 'REST'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setDayOverride(type); setShowChange(false) }}
                  className={`w-full px-4 py-3 rounded-card text-left font-sans text-[14px] font-medium border cursor-pointer transition-colors ${dayType === type ? 'bg-[var(--color-accent-soft)] border-accent text-accent' : 'bg-panel-inset border-[var(--color-panel-border)] text-text'}`}
                >
                  {type === 'REST' ? 'Rest day' : `${type} — ${type === 'PUSH' ? 'Chest · Shoulders · Triceps' : type === 'PULL' ? 'Back · Biceps · Traps' : 'Quads · Hamstrings · Calves'}`}
                </button>
              ))}
              {dayOverride && (
                <button
                  onClick={() => { setDayOverride(null); setShowChange(false) }}
                  className="w-full pt-2 text-center font-mono text-[11px] text-text-dim uppercase tracking-[0.06em] bg-transparent border-none cursor-pointer"
                >
                  Reset to default ({SPLIT[today.getDay()]})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
