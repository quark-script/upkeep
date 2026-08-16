import { differenceInCalendarDays, addDays, format } from 'date-fns'
import { dateKey, parseKey } from './date'
import { KEYS } from './storage'
import type { Schedule, DaySlot, Medicine, SkinStep } from './types'

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

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Write the starter regimens to storage on first run.
 *
 * These have to be *persisted*, not just used as a hook's fallback value: the
 * Today summary and the trainer export read storage directly, so an unwritten
 * default would show up as "no medicines" everywhere except the editor.
 * An empty list is a deliberate user choice, so only absent keys are seeded.
 */
export function seedRoutineDefaults(): void {
  try {
    if (localStorage.getItem(KEYS.MEDICINES) == null) {
      localStorage.setItem(KEYS.MEDICINES, JSON.stringify(defaultMedicines(dateKey(new Date()))))
    }
    if (localStorage.getItem(KEYS.SKINCARE) == null) {
      localStorage.setItem(KEYS.SKINCARE, JSON.stringify(defaultSkinSteps(dateKey(new Date()))))
    }
  } catch (err) {
    console.warn('could not seed routine defaults', err)
  }
}

// Seeded once, then fully editable — names, doses and schedules are the user's.
export function defaultMedicines(startedOn: string): Medicine[] {
  return [
    {
      id: 'med-magnesium',
      name: 'Magnesium',
      dose: '250 mg',
      form: 'capsule',
      schedule: { kind: 'daily' },
      slot: 'night',
      active: true,
      startedOn,
    },
    {
      id: 'med-vitamin-d3',
      name: 'Vitamin D3',
      dose: '60,000 IU',
      form: 'sachet',
      // Weekly is the usual 60K cholecalciferol cadence — change the day if yours differs.
      schedule: { kind: 'weekly', days: [0] },
      slot: 'morning',
      note: 'With a meal — vitamin D absorbs better with fat',
      active: true,
      startedOn,
    },
  ]
}

export function defaultSkinSteps(startedOn: string): SkinStep[] {
  return [
    // ── Morning ──
    {
      id: 'skin-am-cleanse',
      label: 'Rinse with water',
      kind: 'cleanser',
      routine: 'am', order: 1,
      schedule: { kind: 'daily' },
      note: 'Plain water is enough in the morning',
      active: true, startedOn,
    },
    {
      id: 'skin-am-niacinamide',
      label: 'Niacinamide 10% Face Serum',
      kind: 'active',
      routine: 'am', order: 2,
      schedule: { kind: 'daily' },
      active: true, startedOn,
    },
    {
      id: 'skin-am-moisturiser',
      label: 'Moisturising Lotion',
      kind: 'moisturiser',
      routine: 'am', order: 3,
      schedule: { kind: 'daily' },
      active: true, startedOn,
    },
    {
      id: 'skin-am-spf',
      label: 'Sunscreen SPF 50 PA+++',
      kind: 'sunscreen',
      routine: 'am', order: 4,
      schedule: { kind: 'daily' },
      note: 'Reapply if outdoors for long',
      active: true, startedOn,
    },
    // ── Night ──
    {
      id: 'skin-pm-cleanse',
      label: 'Gentle Skin Cleanser (normal to dry)',
      kind: 'cleanser',
      routine: 'pm', order: 1,
      schedule: { kind: 'daily' },
      active: true, startedOn,
    },
    {
      id: 'skin-pm-salicylic',
      label: 'Salicylic Acid 02% Face Serum',
      kind: 'active',
      routine: 'pm', order: 2,
      // Actives are usually alternate nights while skin builds tolerance.
      schedule: { kind: 'interval', everyDays: 2, anchor: '2026-01-01' },
      note: 'Alternate nights — raise to daily once skin tolerates it',
      active: true, startedOn,
    },
    {
      id: 'skin-pm-moisturiser',
      label: 'Moisturising Cream',
      kind: 'moisturiser',
      routine: 'pm', order: 3,
      schedule: { kind: 'daily' },
      active: true, startedOn,
    },
  ]
}
