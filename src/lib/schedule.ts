import { subDays } from 'date-fns'
import { SPLIT } from './data'
import { KEYS } from './storage'
import { dateKey, todayKey, parseKey } from './date'
import type { DayType, WorkoutType, Session } from './types'

// The planned day type for a date, honouring a manual override if one exists.
// Single source of truth — Today, Workout and the streak maths all read this.
export function dayTypeFor(key: string): DayType {
  try {
    const raw = localStorage.getItem(KEYS.dayOverride(key))
    if (raw) {
      const v = JSON.parse(raw) as DayType | null
      if (v === 'PUSH' || v === 'PULL' || v === 'LEGS' || v === 'REST') return v
    }
  } catch {}
  return SPLIT[parseKey(key).getDay()]
}

// Same, but never returns REST — used when the user opens a workout on a rest
// day and we still need a sensible set of lifts to show.
export function workoutTypeFor(key: string): WorkoutType {
  const t = dayTypeFor(key)
  return t === 'REST' ? 'PUSH' : t
}

// Consecutive training days hit, walking backwards from today.
//
// Today counts the moment it's logged, and an unlogged today does NOT break the
// streak — the day isn't over yet. Rest days are skipped, not counted.
export function calcStreak(sessions: Session[]): number {
  const done = new Set(sessions.filter(s => s.finishedAt).map(s => s.date))
  if (done.size === 0) return 0

  const today = todayKey()
  let cur = new Date()
  cur.setHours(0, 0, 0, 0)
  let streak = 0

  for (let i = 0; i < 365; i++) {
    const key = dateKey(cur)
    if (dayTypeFor(key) !== 'REST') {
      if (done.has(key)) streak++
      else if (key !== today) break
    }
    cur = subDays(cur, 1)
  }
  return streak
}

// How many training days the standard split schedules per week (rest excluded).
export const TRAINING_DAYS_PER_WEEK = Object.values(SPLIT).filter(t => t !== 'REST').length
