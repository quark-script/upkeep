import { differenceInCalendarDays, addDays, format } from 'date-fns'
import { dateKey, parseKey } from './date'
import type { Schedule, DaySlot } from './types'

// ─── Schedule maths ──────────────────────────────────────────────────────────

/** Is this item expected on the given day? "As needed" items are never due. */
export function isDue(schedule: Schedule, key: string): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true
    case 'weekly':
      return schedule.days.includes(parseKey(key).getDay())
    case 'interval': {
      const delta = differenceInCalendarDays(parseKey(key), parseKey(schedule.anchor))
      return delta >= 0 && delta % Math.max(1, schedule.everyDays) === 0
    }
    case 'asNeeded':
      return false
  }
}

/** The next day on or after `fromKey` when this is due, within a year. */
export function nextDue(schedule: Schedule, fromKey = dateKey(new Date())): string | null {
  if (schedule.kind === 'asNeeded') return null
  let d = parseKey(fromKey)
  for (let i = 0; i < 366; i++) {
    const key = dateKey(d)
    if (isDue(schedule, key)) return key
    d = addDays(d, 1)
  }
  return null
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function scheduleLabel(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'daily':
      return 'Every day'
    case 'weekly': {
      const days = [...schedule.days].sort((a, b) => a - b)
      if (days.length === 0) return 'Weekly'
      if (days.length === 7) return 'Every day'
      return `Every ${days.map(d => WEEKDAY_SHORT[d]).join(', ')}`
    }
    case 'interval':
      return schedule.everyDays === 1 ? 'Every day' : `Every ${schedule.everyDays} days`
    case 'asNeeded':
      return 'As needed'
  }
}

/** Human phrasing for the next dose, e.g. "Next: Mon 18 Aug". */
export function nextDueLabel(schedule: Schedule, fromKey: string): string | null {
  const next = nextDue(schedule, fromKey)
  if (!next) return null
  if (next === fromKey) return 'Due today'
  return `Next ${format(parseKey(next), 'EEE d MMM')}`
}

/** Adherence over a window: taken / expected, ignoring days before it started. */
export function adherence(
  schedule: Schedule,
  checks: Record<string, Record<string, boolean>>,
  itemId: string,
  days: string[],
  startedOn?: string,
): { taken: number; expected: number } {
  let taken = 0
  let expected = 0
  for (const key of days) {
    if (startedOn && key < startedOn) continue
    if (!isDue(schedule, key)) continue
    expected++
    if (checks[key]?.[itemId]) taken++
  }
  return { taken, expected }
}

// ─── Slots ───────────────────────────────────────────────────────────────────

export const SLOT_ORDER: DaySlot[] = ['morning', 'afternoon', 'evening', 'night', 'anytime']

export const SLOT_LABELS: Record<DaySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
  anytime: 'Anytime',
}
