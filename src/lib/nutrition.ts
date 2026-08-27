import { SEED_FOODS } from './foods'
import { PROTEIN_G_PER_KG, PROTEIN_TARGET_FALLBACK } from './data'
import { KEYS } from './storage'
import { normaliseName as norm, sameName } from './text'
import { latestBodyWeightKg, latestBmr } from './stats'
import type {
  Food, FoodEntry, Macros, MacroTargets, TargetOverrides, Settings, MealSlot,
} from './types'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (err) {
    console.warn(`failed to persist ${key}`, err)
  }
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/** Re-exported because the protein migration matches legacy labels against food
 *  names and must use exactly the normalisation the search does. */
export { normaliseName as norm } from './text'

// ─── Food library ────────────────────────────────────────────────────────────

export function userFoods(): Food[] {
  return read<Food[]>(KEYS.FOODS, [])
}

/** Seed catalog plus user foods, each with its sparse overrides applied. */
export function resolveFoods(): Food[] {
  const prefs = read<Record<string, Partial<Food>>>(KEYS.FOOD_PREFS, {})
  return [...SEED_FOODS, ...userFoods()].map(f => (prefs[f.id] ? { ...f, ...prefs[f.id] } : f))
}

export function foodById(id: string): Food | undefined {
  return resolveFoods().find(f => f.id === id)
}

export function saveFood(food: Food): void {
  const foods = userFoods()
  const i = foods.findIndex(f => f.id === food.id)
  write(KEYS.FOODS, i >= 0 ? foods.map((f, n) => (n === i ? food : f)) : [...foods, food])
}

/** Removes a user food. Past entries keep their own name and macros. */
export function deleteFood(id: string): void {
  write(KEYS.FOODS, userFoods().filter(f => f.id !== id))
}

export function setFoodPrefs(id: string, patch: Partial<Food>): void {
  const prefs = read<Record<string, Partial<Food>>>(KEYS.FOOD_PREFS, {})
  write(KEYS.FOOD_PREFS, { ...prefs, [id]: { ...prefs[id], ...patch } })
}

/** True when the user has corrected this food's data. */
export function hasFoodPrefs(id: string): boolean {
  const p = read<Record<string, Partial<Food>>>(KEYS.FOOD_PREFS, {})[id]
  // `lastUsedAt` is bookkeeping, not an edit — a food that has only been logged
  // must not read as "edited".
  return !!p && Object.keys(p).some(k => k !== 'lastUsedAt')
}

/** Drop the user's corrections, keeping their usage history. */
export function clearFoodPrefs(id: string): void {
  const all = read<Record<string, Partial<Food>>>(KEYS.FOOD_PREFS, {})
  if (!all[id]) return
  const { lastUsedAt } = all[id]
  write(KEYS.FOOD_PREFS, { ...all, [id]: lastUsedAt !== undefined ? { lastUsedAt } : {} })
}

/** Foods eaten in the last `days` days, most recently used first. */
export function recentFoods(days = 30): Food[] {
  const cutoff = Date.now() - days * 86_400_000
  return resolveFoods()
    .filter(f => f.lastUsedAt !== undefined && f.lastUsedAt >= cutoff)
    .sort((a, b) => b.lastUsedAt! - a.lastUsedAt!)
}

/**
 * Local search across tiers 1-3 (recent, user foods, seed). Tier 4 —
 * OpenFoodFacts — is deliberately NOT here: it is async, rate limited, and must
 * never delay local results. The UI calls it separately and appends.
 */
export function searchFoods(query: string, limit = 30): Food[] {
  const q = norm(query)
  const all = resolveFoods()
  if (!q) return recentFoods().slice(0, limit)

  const recentIds = new Set(recentFoods().map(f => f.id))
  // Catalog order is meaningful: the plainest form of a food is listed first, so
  // "milk" must surface cow's milk rather than whichever variant has the
  // shortest name. Ties break on this before falling back to length.
  const order = new Map(all.map((f, i) => [f.id, i]))
  const scored: { f: Food; tier: number }[] = []
  for (const f of all) {
    const name = norm(f.name)
    const aliases = (f.aliases ?? []).map(norm)
    let tier = -1
    // An exact alias ranks with an exact name: someone who typed "dal" and
    // tagged Toor Dal with that alias meant that food, not whichever other
    // food happens to start with the same three letters.
    // sameName also matches across a trailing plural, so "eggs" finds Egg.
    if (name === q || sameName(f.name, query)) tier = 0
    else if (aliases.includes(q) || aliases.some(a => sameName(a, query))) tier = 1
    else if (name.startsWith(q)) tier = 2
    else if (name.includes(q)) tier = 3
    else if (aliases.some(a => a.includes(q))) tier = 4
    else if (f.brand && norm(f.brand).includes(q)) tier = 5
    if (tier >= 0) scored.push({ f, tier })
  }
  return scored
    .sort((a, b) =>
      a.tier - b.tier ||
      Number(recentIds.has(b.f.id)) - Number(recentIds.has(a.f.id)) ||
      (order.get(a.f.id)! - order.get(b.f.id)!))
    .slice(0, limit)
    .map(s => s.f)
}

// ─── Macro maths ─────────────────────────────────────────────────────────────

/** Round to one decimal — enough precision to be honest, few enough digits to read. */
const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Resolve a portion to grams and macros.
 * `servingId` absent means `qty` IS the gram weight.
 */
export function macrosFor(
  food: Food,
  servingId: string | undefined,
  qty: number,
): { grams: number; macros: Macros } {
  const serving = servingId ? food.servings.find(s => s.id === servingId) : undefined
  const grams = serving ? serving.grams * qty : qty
  const k = grams / 100
  return {
    grams: r1(grams),
    macros: {
      kcal: Math.round(food.per100.kcal * k),
      protein: r1(food.per100.protein * k),
      carbs: r1(food.per100.carbs * k),
      fat: r1(food.per100.fat * k),
    },
  }
}

// ─── A day's entries ─────────────────────────────────────────────────────────

export function dayEntries(date: string): FoodEntry[] {
  return read<FoodEntry[]>(KEYS.foodDay(date), [])
}

/**
 * Record that a food was just used, so it surfaces in Recent next time.
 *
 * Called by whoever writes the day's entries. The day itself is persisted by
 * the component's `useLocalStorage`, which is the project's pattern for every
 * other Daily section and keeps the screen reactive — so this deliberately does
 * NOT write the entries too, rather than having two writers race for one key.
 */
export function touchFood(id: string): void {
  // Strictly increasing, not just `Date.now()`: two foods logged inside the same
  // millisecond would otherwise tie, and "most recently used" would order them
  // arbitrarily — which is exactly what happens when someone taps three Recent
  // tiles in a row.
  const latest = resolveFoods().reduce((max, f) => Math.max(max, f.lastUsedAt ?? 0), 0)
  const at = Math.max(Date.now(), latest + 1)
  const own = userFoods().find(f => f.id === id)
  if (own) saveFood({ ...own, lastUsedAt: at })
  else setFoodPrefs(id, { lastUsedAt: at })
}

/**
 * True when a day's entries all came from the protein-checkbox migration.
 *
 * Those days only ever recorded which of a handful of supplements were ticked,
 * so their totals are a floor rather than a measurement. Showing them in an
 * average reads as a catastrophic deficit instead of "barely logged".
 */
export function isMigratedDay(date: string): boolean {
  const entries = dayEntries(date)
  return entries.length > 0 && entries.every(e => e.migrated)
}

export function dayMacros(date: string): Macros {
  return dayEntries(date).reduce<Macros>((a, e) => ({
    kcal: a.kcal + e.macros.kcal,
    protein: r1(a.protein + e.macros.protein),
    carbs: r1(a.carbs + e.macros.carbs),
    fat: r1(a.fat + e.macros.fat),
  }), { ...ZERO })
}

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner']

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner',
}

/** The slot a meal logged right now most likely belongs to. */
export function slotForNow(d = new Date()): MealSlot {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

/**
 * Group entries into meals, oldest first within each.
 *
 * Takes the entries rather than reading them, so the day view can pass what its
 * `useLocalStorage` already holds instead of re-reading storage — and so the two
 * cannot disagree, which is what happened when the component grew its own copy
 * of this loop.
 */
export function groupBySlot(entries: FoodEntry[]): Record<MealSlot, FoodEntry[]> {
  const out: Record<MealSlot, FoodEntry[]> = { breakfast: [], lunch: [], snack: [], dinner: [] }
  // An entry whose slot predates the current set lands in Snack rather than
  // vanishing from the day.
  for (const e of entries) (out[e.slot] ?? out.snack).push(e)
  for (const k of MEAL_SLOTS) out[k].sort((a, b) => a.at - b.at)
  return out
}

export function entriesBySlot(date: string): Record<MealSlot, FoodEntry[]> {
  return groupBySlot(dayEntries(date))
}

// ─── Targets ─────────────────────────────────────────────────────────────────

// Daily protein goal: an explicit setting if one exists, otherwise scaled off
// the latest body weight (1.6 g/kg is the usual muscle-building floor).
export function proteinTargetG(): number {
  const explicit = read<Settings | null>(KEYS.SETTINGS, null)?.proteinTargetG
  if (typeof explicit === 'number' && explicit > 0) return Math.round(explicit)
  const bw = latestBodyWeightKg()
  return bw > 0 ? Math.round(bw * PROTEIN_G_PER_KG) : PROTEIN_TARGET_FALLBACK
}

export const DEFAULT_ACTIVITY = 1.5
export const DEFAULT_GOAL_DELTA = 200
const FAT_FRACTION = 0.25
const BMR_FALLBACK = 1500

export interface ResolvedTargets extends MacroTargets {
  derived: Record<keyof MacroTargets, boolean>
  /** The inputs behind the calorie figure, so the UI can show its working. */
  basis: { bmr: number; activityFactor: number; goalDelta: number }
}

/**
 * All four targets, each either pinned by the user or derived.
 *
 * Carbs are derived LAST, from whatever calories protein and fat leave behind,
 * so the three macro targets always reconcile to the calorie target instead of
 * drifting apart as body weight changes.
 */
export function targets(): ResolvedTargets {
  const o = read<TargetOverrides>(KEYS.TARGETS, {})
  const bmr = latestBmr()
  const activityFactor = o.activityFactor ?? DEFAULT_ACTIVITY
  const goalDelta = o.goalDelta ?? DEFAULT_GOAL_DELTA

  const protein = o.protein ?? proteinTargetG()
  const kcal = o.kcal ?? Math.round((bmr > 0 ? bmr : BMR_FALLBACK) * activityFactor + goalDelta)
  const fat = o.fat ?? Math.round((kcal * FAT_FRACTION) / 9)
  const carbs = o.carbs ?? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return {
    kcal, protein, carbs, fat,
    derived: {
      kcal: o.kcal === undefined,
      protein: o.protein === undefined,
      carbs: o.carbs === undefined,
      fat: o.fat === undefined,
    },
    basis: { bmr, activityFactor, goalDelta },
  }
}

export function setTargets(patch: TargetOverrides): void {
  write(KEYS.TARGETS, { ...read<TargetOverrides>(KEYS.TARGETS, {}), ...patch })
}

/** Drop one pinned target so it goes back to being derived. */
export function clearTarget(field: keyof TargetOverrides): void {
  const { [field]: _drop, ...rest } = read<TargetOverrides>(KEYS.TARGETS, {})
  write(KEYS.TARGETS, rest)
}
