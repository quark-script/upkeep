import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { Dumbbell, Moon, CheckSquare, ChevronRight, ArrowRight, StickyNote } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { useLogDate } from '../lib/dateContext'
import { dateKey, todayKey, parseKey } from '../lib/date'
import { sessionVolume, logUnit, formatSet, topSet } from '../lib/stats'
import { proteinForDay, proteinTargetG } from '../lib/nutrition'
import { sleepDurationH } from '../lib/sleep'
import { exerciseName } from '../lib/export'
import type { Session, SleepEntry } from '../lib/types'
import { Card, PageTitle, EmptyState, Divider, Btn } from '../components/ui'

const WINDOW_STEP = 30

interface DaySummary {
  key: string
  session: Session | null
  proteinG: number
  proteinTarget: number
  sleepHours: number | null
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export default function History() {
  const navigate = useNavigate()
  const { setActiveDate } = useLogDate()
  const [sessions] = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState(WINDOW_STEP)

  const proteinTarget = proteinTargetG()
  const today = new Date()

  // Is there anything older than the current window still worth loading?
  const oldestSession = sessions.reduce<string | null>(
    (min, s) => (min == null || s.date < min ? s.date : min), null,
  )
  const hasOlder = oldestSession != null && oldestSession < dateKey(subDays(today, windowDays - 1))

  const days: DaySummary[] = []
  for (let i = 0; i < windowDays; i++) {
    const key = dateKey(subDays(today, i))
    const session = sessions.find(s => s.date === key && s.finishedAt !== null) ?? null
    const { grams: proteinG, itemsDone } = proteinForDay(key, proteinTarget)
    const sleep = readJSON<SleepEntry>(KEYS.sleepDay(key), {})
    const sleepHours = sleepDurationH(sleep)
    if (session || itemsDone > 0 || sleepHours != null || sleep.phone != null) {
      days.push({ key, session, proteinG, proteinTarget, sleepHours })
    }
  }

  const goEdit = (key: string, to: string) => {
    setActiveDate(key)
    navigate(to)
  }

  return (
    <div className="pt-6 pb-8 flex flex-col gap-5">
      <PageTitle kicker={`Last ${windowDays} days`} title="History." />

      {days.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="Nothing logged yet."
            sub="Workouts, food, and sleep you log will show up here, newest first."
          />
        </Card>
      ) : (
        <Card noPad>
          {days.map((d, i) => {
            const date = parseKey(d.key)
            const isToday = d.key === todayKey()
            const open = openKey === d.key
            const vol = d.session ? sessionVolume(d.session) : 0
            return (
              <div key={d.key}>
                {i > 0 && <Divider />}
                <button
                  onClick={() => setOpenKey(open ? null : d.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer"
                >
                  <div className="w-11 shrink-0 text-center">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.06em] ${isToday ? 'text-accent font-semibold' : 'text-text-dim'}`}>
                      {format(date, 'EEE')}
                    </p>
                    <p className="font-mono text-[18px] text-text font-medium tracking-[-0.02em] leading-tight">
                      {format(date, 'd')}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <p className="font-sans text-[13px] text-text font-medium">
                      {d.session
                        ? <>{d.session.type} · <span className="font-mono text-text-dim font-normal">{Math.round(vol).toLocaleString()} kg</span></>
                        : <span className="text-text-dim font-normal">No workout</span>}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim tracking-[0.03em] flex items-center gap-2.5">
                      <span className="flex items-center gap-1"><CheckSquare size={10} strokeWidth={1.8} />{d.proteinG}/{d.proteinTarget}g</span>
                      <span className="flex items-center gap-1"><Moon size={10} strokeWidth={1.8} />{d.sleepHours != null ? `${d.sleepHours.toFixed(1)}h` : '—'}</span>
                    </p>
                  </div>
                  <ChevronRight
                    size={16} strokeWidth={1.8}
                    className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                    {/* What actually happened — readable without entering edit mode. */}
                    {d.session && (
                      <div className="rounded-card bg-panel-inset border border-[var(--color-panel-border)] px-3.5 py-3 flex flex-col gap-2">
                        {d.session.note && (
                          <p className="font-sans text-[12px] text-text-dim leading-[17px] flex gap-1.5 items-start">
                            <StickyNote size={12} strokeWidth={1.7} className="text-text-faint shrink-0 mt-0.5" />
                            {d.session.note}
                          </p>
                        )}
                        {d.session.exercises
                          .filter(ex => ex.sets.some(s => s.done))
                          .map(ex => {
                            const top = topSet(ex)
                            const doneCount = ex.sets.filter(s => s.done).length
                            return (
                              <div key={ex.exerciseId} className="flex items-baseline justify-between gap-3">
                                <span className="font-sans text-[12.5px] text-text truncate">
                                  {exerciseName(ex)}
                                </span>
                                <span className="font-mono text-[11px] text-text-dim tracking-[0.02em] shrink-0">
                                  {doneCount}×{top ? ` ${formatSet(top, logUnit(ex))}` : ''}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    )}
                    <button
                      onClick={() => goEdit(d.key, '/workout')}
                      className="flex items-center justify-between px-3.5 py-3 rounded-card bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 font-sans text-[13px] text-text font-medium">
                        <Dumbbell size={15} strokeWidth={1.7} className="text-text-dim" />
                        {d.session ? 'Edit workout' : 'Add workout'}
                      </span>
                      <ArrowRight size={14} strokeWidth={1.8} className="text-text-faint" />
                    </button>
                    <button
                      onClick={() => goEdit(d.key, '/daily')}
                      className="flex items-center justify-between px-3.5 py-3 rounded-card bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 font-sans text-[13px] text-text font-medium">
                        <CheckSquare size={15} strokeWidth={1.7} className="text-text-dim" />
                        Edit food &amp; sleep
                      </span>
                      <ArrowRight size={14} strokeWidth={1.8} className="text-text-faint" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {hasOlder && (
        <Btn variant="secondary" fullWidth onClick={() => setWindowDays(w => w + WINDOW_STEP)}>
          Load {WINDOW_STEP} more days
        </Btn>
      )}
    </div>
  )
}
