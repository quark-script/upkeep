import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { Dumbbell, Moon, CheckSquare, ChevronRight, ArrowRight, StickyNote, Pill, Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { useLogDate } from '../lib/dateContext'
import { dateKey, todayKey, parseKey } from '../lib/date'
import { sessionVolume, logUnit, formatSet, topSet } from '../lib/stats'
import { dayMacros, targets } from '../lib/nutrition'
import { sleepDurationH } from '../lib/sleep'
import { exerciseName } from '../lib/export'
import { isDue } from '../lib/routines'
import type { Session, SleepEntry, Medicine, SkinStep } from '../lib/types'
import { Card, PageTitle, EmptyState, Divider, Btn } from '../components/ui'

const WINDOW_STEP = 30

/**
 * One logged entity on one day. A day row is built only from the entities that
 * actually have data, so nothing is ever asserted about an entity you did not
 * touch: logging dinner must not make the day claim anything about training.
 */
interface Fact {
  entity: 'workout' | 'diet' | 'sleep' | 'meds' | 'skin'
  icon: typeof Dumbbell
  text: string
  /** Where tapping this fact goes to edit it. */
  to: string
  /** Sub-tab to open when `to` is /daily. */
  section?: 'food' | 'sleep' | 'meds' | 'skin'
}

interface DaySummary {
  key: string
  session: Session | null
  facts: Fact[]
}

/**
 * The five things Upkeep tracks, in a fixed order. They are peers: no entity is
 * the headline and none is a sub-field of another, which is what keeps a day
 * with only skincare on it as legitimate as a day with a workout.
 */
const ENTITIES = [
  { key: 'workout', label: 'Workout',  icon: Dumbbell,    to: '/workout', section: undefined as string | undefined },
  { key: 'diet',    label: 'Food',     icon: CheckSquare, to: '/daily',   section: 'food' },
  { key: 'sleep',   label: 'Sleep',    icon: Moon,        to: '/daily',   section: 'sleep' },
  { key: 'meds',    label: 'Meds',     icon: Pill,        to: '/daily',   section: 'meds' },
  { key: 'skin',    label: 'Skincare', icon: Sparkles,    to: '/daily',   section: 'skin' },
] as const

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

  const proteinTarget = targets()?.protein ?? 0
  const today = new Date()

  // Is there anything older than the current window still worth loading?
  const oldestSession = sessions.reduce<string | null>(
    (min, s) => (min == null || s.date < min ? s.date : min), null,
  )
  const hasOlder = oldestSession != null && oldestSession < dateKey(subDays(today, windowDays - 1))

  // Routine definitions are read once, not per day: they are the denominator
  // for "2 of 3 taken", and re-reading them 30 times would be pure waste.
  const medicines = readJSON<Medicine[]>(KEYS.MEDICINES, []).filter(m => m?.active)
  const skinSteps = readJSON<SkinStep[]>(KEYS.SKINCARE, []).filter(st => st?.active)

  const days: DaySummary[] = []
  for (let i = 0; i < windowDays; i++) {
    const key = dateKey(subDays(today, i))
    const facts: Fact[] = []

    // ── workout ──
    const session = sessions.find(s => s.date === key && s.finishedAt !== null) ?? null
    if (session) {
      facts.push({
        entity: 'workout',
        icon: Dumbbell,
        text: `${session.type} · ${Math.round(sessionVolume(session)).toLocaleString()} kg`,
        to: '/workout',
      })
    }

    // ── diet ──
    const { protein: proteinG, kcal } = dayMacros(key)
    if (kcal > 0 || proteinG > 0) {
      facts.push({
        entity: 'diet',
        icon: CheckSquare,
        text: `${Math.round(kcal)} kcal · ${Math.round(proteinG)}g P${
          proteinTarget > 0 && proteinG >= proteinTarget ? ' ✓' : ''
        }`,
        to: '/daily',
        section: 'food',
      })
    }

    // ── sleep ──
    const sleep = readJSON<SleepEntry>(KEYS.sleepDay(key), {})
    const sleepHours = sleepDurationH(sleep)
    if (sleepHours != null || sleep.phone != null || sleep.bed != null || sleep.quality != null) {
      facts.push({
        entity: 'sleep',
        icon: Moon,
        text: sleepHours != null ? `${sleepHours.toFixed(1)}h` : 'logged',
        to: '/daily',
        section: 'sleep',
      })
    }

    // ── meds ──
    // Counted against what was actually due that day, so a weekly dose does not
    // read as "1 of 5" on the six days it was never expected.
    const medChecks = readJSON<Record<string, boolean>>(KEYS.medsDay(key), {})
    const medsTaken = Object.values(medChecks).filter(Boolean).length
    if (medsTaken > 0) {
      const due = medicines.filter(m => isDue(m.schedule, key)).length
      facts.push({
        entity: 'meds',
        icon: Pill,
        text: due > 0 ? `${medsTaken}/${due}` : `${medsTaken}`,
        to: '/daily',
        section: 'meds',
      })
    }

    // ── skincare ──
    const skinChecks = readJSON<Record<string, boolean>>(KEYS.skinDay(key), {})
    const skinDone = Object.values(skinChecks).filter(Boolean).length
    if (skinDone > 0) {
      const due = skinSteps.filter(st => isDue(st.schedule, key)).length
      facts.push({
        entity: 'skin',
        icon: Sparkles,
        text: due > 0 ? `${skinDone}/${due}` : `${skinDone}`,
        to: '/daily',
        section: 'skin',
      })
    }

    if (facts.length > 0) days.push({ key, session, facts })
  }

  // Daily remembers its last sub-tab in storage, so writing the section before
  // navigating is what makes "meds on the 12th" land on meds and not on food.
  const goEdit = (key: string, to: string, section?: string) => {
    setActiveDate(key)
    if (section) {
      try { localStorage.setItem(KEYS.DAILY_SECTION, JSON.stringify(section)) } catch {}
    }
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
            sub="Workouts, food, sleep, meds and skincare you log will show up here, newest first."
          />
        </Card>
      ) : (
        <Card noPad>
          {days.map((d, i) => {
            const date = parseKey(d.key)
            const isToday = d.key === todayKey()
            const open = openKey === d.key
            return (
              <div key={d.key}>
                {i > 0 && <Divider />}
                <button
                  onClick={() => setOpenKey(open ? null : d.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer"
                >
                  <div className="w-11 shrink-0 text-center">
                    <p className={`font-mono text-[11px] uppercase tracking-[0.06em] ${isToday ? 'text-accent font-semibold' : 'text-text-dim'}`}>
                      {format(date, 'EEE')}
                    </p>
                    <p className="font-mono text-[18px] text-text font-medium tracking-[-0.02em] leading-tight">
                      {format(date, 'd')}
                    </p>
                  </div>
                  {/* One chip per entity that has data. An entity you did not log
                      contributes nothing: no chip, no dash, no "none". */}
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {d.facts.map(f => (
                      <span
                        key={f.entity}
                        className={`flex items-center gap-1 font-mono text-[11px] tracking-[0.02em] ${
                          f.entity === 'workout' ? 'text-text font-medium' : 'text-text-dim'
                        }`}
                      >
                        <f.icon size={11} strokeWidth={1.8} className="text-text-faint shrink-0" />
                        {f.text}
                      </span>
                    ))}
                  </div>
                  <ChevronRight
                    size={16} strokeWidth={1.8}
                    className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                    {/* What actually happened, readable without entering edit mode. */}
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
                    {/* Every entity is reachable from every day, in the same order,
                        whether or not it was logged. These are actions, not claims:
                        an unlogged entity offers a way in without asserting a "no". */}
                    <div className="grid grid-cols-2 gap-2">
                      {ENTITIES.map(e => (
                        <button
                          key={e.key}
                          onClick={() => goEdit(d.key, e.to, e.section)}
                          className="flex items-center justify-between px-3 py-2.5 rounded-card bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-sans text-[12.5px] text-text font-medium truncate">
                            <e.icon size={14} strokeWidth={1.7} className="text-text-dim shrink-0" />
                            {e.label}
                          </span>
                          <ArrowRight size={13} strokeWidth={1.8} className="text-text-faint shrink-0" />
                        </button>
                      ))}
                    </div>
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
