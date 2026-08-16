import { PROTEIN_ITEMS, PROTEIN_G_PER_KG, PROTEIN_TARGET_FALLBACK } from './data'
import { KEYS } from './storage'
import { latestBodyWeightKg } from './stats'
import type { ProteinItem, Settings } from './types'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

// Daily protein goal: an explicit setting if one exists, otherwise scaled off
// the latest body weight (1.6 g/kg is the usual muscle-building floor).
export function proteinTargetG(): number {
  const explicit = read<Settings | null>(KEYS.SETTINGS, null)?.proteinTargetG
  if (typeof explicit === 'number' && explicit > 0) return Math.round(explicit)
  const bw = latestBodyWeightKg()
  return bw > 0 ? Math.round(bw * PROTEIN_G_PER_KG) : PROTEIN_TARGET_FALLBACK
}

/** The standing plan (built-ins + user's custom items) plus that day's one-offs. */
export function itemsForDay(date: string): ProteinItem[] {
  const custom = read<ProteinItem[]>(KEYS.PROTEIN_CUSTOM, [])
  const extras = read<ProteinItem[]>(KEYS.proteinExtra(date), [])
  return [...PROTEIN_ITEMS, ...custom, ...extras]
}

export interface DayProtein {
  grams: number
  target: number
  itemsDone: number
  itemsTotal: number
}

export function proteinForDay(date: string, target = proteinTargetG()): DayProtein {
  const checked = read<Record<string, boolean>>(KEYS.proteinDay(date), {})
  const items = itemsForDay(date)
  const done = items.filter(it => checked[it.id])
  return {
    grams: done.reduce((a, it) => a + (it.grams ?? 0), 0),
    target,
    itemsDone: done.length,
    itemsTotal: items.length,
  }
}
