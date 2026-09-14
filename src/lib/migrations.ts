import { EXERCISES } from './data'
import { normaliseName, upsertCustom } from './library'
import { sameName } from './text'
import {
  norm, resolveFoods, foodById, saveFood, setFoodPrefs, macrosFor,
  hasCurrentTargetSetup, legacyTargets, TARGET_SETUP_VERSION,
} from './nutrition'
import { KEYS, PREFIX, DAY_PREFIXES } from './storage'
import type {
  Session, Exercise, WorkoutType, WorkoutDraft,
  Food, FoodEntry, MealSlot, ProteinItem,
} from './types'

/**
 * A pre-migration snapshot of every app-owned key, written to one localStorage
 * entry. Migrations rewrite `upkeep:sessions` in place, so this is the only
 * thing standing between a bad migration and three months of logs.
 *
 * Kept deliberately: it costs a few hundred KB and it is the only way to check
 * a migration after the fact. Removable from Settings once the user is happy.
 */
export function snapshot(id: string): void {
  const key = `${PREFIX}snapshot:${id}`
  if (localStorage.getItem(key) != null) return   // never overwrite an earlier one
  const data: Record<string, string> = {}
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(PREFIX) || k.startsWith(`${PREFIX}snapshot:`)) continue
    const v = localStorage.getItem(k)
    if (v != null) data[k] = v
  }
  localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
}

function ran(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEYS.MIGRATIONS) ?? '{}') } catch { return {} }
}

/** Migrations that failed this session, for Settings to surface. */
const failures: string[] = []

export function migrationFailures(): string[] {
  return [...failures]
}

/**
 * Run `fn` at most once per install, keyed by `id`. Snapshots first, and the
 * marker is written only on success — so a failure leaves the migration pending
 * and it is retried on the next load.
 *
 * Nothing is rolled back automatically: `snapshot()` writes a copy and
 * `restoreSnapshot()` puts it back, but restoring is the user's call, not a
 * side effect of a partial run. Each migration is written to be resumable, so
 * the usual outcome of a retry is that it finishes the remaining work.
 *
 * Returns true if `fn` ran to completion.
 */
export function runOnce(id: string, fn: () => void): boolean {
  const done = ran()
  if (done[id]) return false
  try {
    snapshot(id)
    fn()
    localStorage.setItem(KEYS.MIGRATIONS, JSON.stringify({ ...done, [id]: Date.now() }))
    return true
  } catch (err) {
    // On a phone PWA there is no console to read this in; Settings surfaces it.
    console.error(`migration "${id}" failed and will be retried on next load`, err)
    failures.push(id)
    return false
  }
}

export interface SnapshotInfo {
  id: string
  at: number
  bytes: number
  keys: number
}

/** Every pre-migration snapshot still held, newest first. */
export function snapshots(): SnapshotInfo[] {
  const out: SnapshotInfo[] = []
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(`${PREFIX}snapshot:`)) continue
    try {
      const raw = localStorage.getItem(k) ?? ''
      const parsed = JSON.parse(raw) as { at: number; data: Record<string, string> }
      out.push({
        id: k.slice(`${PREFIX}snapshot:`.length),
        at: parsed.at,
        bytes: raw.length,
        keys: Object.keys(parsed.data).length,
      })
    } catch { /* an unreadable snapshot is not worth breaking Settings over */ }
  }
  return out.sort((a, b) => b.at - a.at)
}

/**
 * Put the store back as it was before one migration ran, and clear that
 * migration's marker so it can run again.
 *
 * Keys written *after* the snapshot are removed, which is the point: a bad
 * migration's output must not survive its own undo.
 */
export function restoreSnapshot(id: string): boolean {
  const key = `${PREFIX}snapshot:${id}`
  let parsed: { data: Record<string, string> }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error(`snapshot "${id}" is unreadable`, err)
    return false
  }
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX) && !k.startsWith(`${PREFIX}snapshot:`)) localStorage.removeItem(k)
  }
  for (const [k, v] of Object.entries(parsed.data)) localStorage.setItem(k, v)
  const done = ran()
  delete done[id]
  localStorage.setItem(KEYS.MIGRATIONS, JSON.stringify(done))
  return true
}

/** Free the space a snapshot holds, once the user is happy with the result. */
export function discardSnapshot(id: string): void {
  localStorage.removeItem(`${PREFIX}snapshot:${id}`)
}


/**
 * Three months of logs contain the same lift under a fresh random UUID per
 * session — "Preacher curl" appears twelve times with twelve different ids,
 * because the old custom-add path minted `crypto.randomUUID()` and never
 * persisted the exercise anywhere.
 *
 * This groups those logs by normalised name, adopts a seed id where the catalog
 * (including aliases) recognises the name, mints one stable custom id where it
 * does not, and rewrites every affected log. Logs with no name at all predate
 * name capture and are unrecoverable — they collapse into a single
 * "Unknown lift" so they stop polluting the picker.
 *
 * Written in one setItem at the end so a throw leaves sessions untouched.
 */
export function migrateOrphanExercises(): void {
  const raw = localStorage.getItem(KEYS.SESSIONS)
  if (!raw) return
  const sessions = JSON.parse(raw) as Session[]
  const seedIds = new Set(EXERCISES.map(e => e.id))

  // 1. Gather every log whose id is not a known seed lift.
  interface Orphan { name: string; types: Set<WorkoutType>; sets: number; unit?: string }
  const groups = new Map<string, Orphan>()

  for (const s of sessions) {
    for (const log of s.exercises) {
      if (seedIds.has(log.exerciseId)) continue
      const key = log.name ? normaliseName(log.name) : '__unnamed__'
      const existing = groups.get(key)
      if (existing) {
        existing.types.add(s.type)
        existing.sets = Math.max(existing.sets, log.sets.length)
      } else {
        groups.set(key, {
          name: log.name ?? 'Unknown lift',
          types: new Set([s.type]),
          sets: log.sets.length || 3,
          unit: log.unit,
        })
      }
    }
  }
  if (groups.size === 0) return

  // 2. Resolve each group to one stable id. upsertCustom already checks seed
  //    names and aliases first, so "Hyper extension" lands on `hyperextension`
  //    rather than creating a duplicate.
  const idFor = new Map<string, string>()
  for (const [key, o] of groups) {
    if (key === '__unnamed__') {
      idFor.set(key, upsertCustom('Unknown lift', { day: [], defaultReps: '—' }).id)
      continue
    }
    const resolved = upsertCustom(o.name, {
      defaultSets: o.sets,
      day: [...o.types] as WorkoutType[],
      ...(o.unit ? { unit: o.unit as Exercise['unit'] } : {}),
    })
    idFor.set(key, resolved.id)
  }

  // 3. Rewrite the logs, preserving the recorded name.
  let rewritten = 0
  for (const s of sessions) {
    for (const log of s.exercises) {
      if (seedIds.has(log.exerciseId)) continue
      const key = log.name ? normaliseName(log.name) : '__unnamed__'
      const next = idFor.get(key)
      if (next && next !== log.exerciseId) { log.exerciseId = next; rewritten++ }
    }
  }
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions))

  // 4. Any unfinished draft can reference a remapped id too.
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(`${PREFIX}workout-draft:`)) continue
    try {
      const draft = JSON.parse(localStorage.getItem(k)!) as WorkoutDraft
      let touched = false
      draft.customExercises = (draft.customExercises ?? []).map(ex => {
        const next = idFor.get(normaliseName(ex.name))
        if (!next || next === ex.id) return ex
        draft.log[next] = draft.log[ex.id]
        delete draft.log[ex.id]
        if (draft.activeId === ex.id) draft.activeId = next
        touched = true
        return { ...ex, id: next }
      })
      if (touched) localStorage.setItem(k, JSON.stringify(draft))
    } catch (err) {
      console.warn(`could not remap draft ${k}`, err)
    }
  }

  console.info(`migration: reunified ${rewritten} logs into ${groups.size} exercises`)
}

// ─── Legacy protein checkboxes ───────────────────────────────────────────────
// These two tables used to be app data in data.ts. They are lookup tables for
// historical records now: the only thing that still reads them is the migration
// below, which turns three months of ticked boxes into real food entries.

const LEGACY_PROTEIN_ITEMS: ProteinItem[] = [
  { id: 'eggs',        label: '2 Eggs at breakfast',    time: '7:30 AM',  grams: 12 },
  { id: 'whey',        label: 'Whey protein shake',     time: '9:00 AM',  grams: 24 },
  { id: 'chana',       label: 'Roasted chana + nuts',   time: '11:00 AM', grams: 12 },
  { id: 'pb-sandwich', label: 'PB sandwich',            time: '5:00 PM',  grams: 12 },
  { id: 'milk',        label: 'Warm milk at dinner',    time: '9:30 PM',  grams: 8 },
  { id: 'creatine',    label: 'Creatine (3g)',          time: 'anytime',  grams: 0 },
]

// Common Indian-diet additions that used to be one-tap adds. Their gram figures
// are the only protein estimate some historical entries ever had.
const LEGACY_QUICK_ADDS: { label: string; grams: number }[] = [
  { label: 'Dal (1 bowl)',        grams: 9 },
  { label: 'Curd (1 bowl)',       grams: 8 },
  { label: 'Paneer (100g)',       grams: 18 },
  { label: 'Chicken (100g)',      grams: 27 },
  { label: 'Rajma / chole bowl',  grams: 12 },
  { label: 'Soya chunks (50g)',   grams: 26 },
  { label: 'Roti ×2',             grams: 6 },
  { label: 'Rice (1 cup)',        grams: 4 },
  { label: 'Peanuts (30g)',       grams: 8 },
  { label: 'Whey scoop',          grams: 24 },
]

/** Old built-in item id -> seed food and how many servings it represented. */
const ITEM_MAP: Record<string, { foodId: string; qty: number }> = {
  'eggs':        { foodId: 'egg',           qty: 2 },
  'whey':        { foodId: 'whey',          qty: 1 },
  'chana':       { foodId: 'chana-roasted', qty: 1 },
  'pb-sandwich': { foodId: 'peanut-butter', qty: 2 },
  'milk':        { foodId: 'milk-cow',      qty: 1 },
  'creatine':    { foodId: 'creatine',      qty: 1 },
}

/** Slot from the old item's `time` string, which was free text like "7:30 AM". */
function slotFromTime(time: string | undefined): MealSlot {
  if (!time) return 'snack'
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!m) return 'snack'
  let h = parseInt(m[1], 10)
  if (/PM/i.test(m[3] ?? '') && h < 12) h += 12
  if (/AM/i.test(m[3] ?? '') && h === 12) h = 0
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

/**
 * Recover a quantity and a food from a free-text custom label. The old UI never
 * collected grams, so users encoded them in the label — "Panner 100g",
 * "Protein bar 17g", "2 eggs" — and `ProteinItem.grams` stayed unset, which is
 * why every one of those days scored zero for those items.
 */
function parseLegacyLabel(label: string): { name: string; qty: number; grams?: number } {
  const grams = label.match(/(\d+(?:\.\d+)?)\s*g\b/i)
  const leading = label.match(/^(\d+(?:\.\d+)?)\s+/)
  const name = label
    .replace(/(\d+(?:\.\d+)?)\s*g\b/i, '')
    .replace(/^(\d+(?:\.\d+)?)\s+/, '')
    .trim()
  return {
    name: name || label.trim(),
    qty: leading ? parseFloat(leading[1]) : 1,
    ...(grams ? { grams: parseFloat(grams[1]) } : {}),
  }
}

/**
 * Match a typed label against the food catalog by name or alias.
 *
 * Plural-insensitive: the catalog names foods in the singular ("Egg") and users
 * typed them however they eat them ("2 eggs").
 */
function matchFood(name: string): Food | undefined {
  if (!norm(name)) return undefined
  return resolveFoods().find(f => sameName(f.name, name) || f.aliases?.some(a => sameName(a, name)))
}

/** The protein a legacy item claimed, from the label, the item, or the old
 *  quick-add table it was probably copied from. */
function legacyProtein(item: ProteinItem, parsedGrams: number | undefined): number {
  if (item.grams !== undefined && item.grams > 0) return item.grams
  const quick = LEGACY_QUICK_ADDS.find(q => norm(q.label) === norm(item.label))
  if (quick) return quick.grams
  return parsedGrams ?? 0
}

// `asGrams` records HOW qty should be read, rather than guessing later from its
// magnitude — "Panner 100g" is 100 grams, "2 eggs" is 2 servings, and no
// threshold can tell those apart reliably.
interface Resolved { foodId: string; qty: number; slot: MealSlot; asGrams: boolean }

/**
 * Is a gram figure from a legacy label a plausible portion of the food it
 * matched? "Panner 100g" is a real 100 g of paneer. "Protein bar 17g" is not
 * 17 g of a 60 g bar — on packaging that phrasing means a bar *containing* 17 g
 * of protein, and reading it as a weight understates the entry roughly 4x.
 *
 * The test is whether the figure reaches the food's smallest named portion.
 * Below that, the label was describing something other than what was eaten.
 */
function plausibleGrams(food: Food, grams: number): boolean {
  const smallest = Math.min(...food.servings.map(s => s.grams))
  return grams >= smallest
}

/** Resolve one legacy item to a food, creating a reviewable one if need be. */
function resolveLegacyItem(item: ProteinItem, defaultSlot?: MealSlot): Resolved {
  const { name, qty, grams } = parseLegacyLabel(item.label)
  const slot = defaultSlot ?? slotFromTime(item.time)
  const seed = matchFood(name)
  if (seed) {
    // An implausible figure falls back to one default portion and flags the
    // food, so the user is asked rather than assumed at.
    if (grams !== undefined && !plausibleGrams(seed, grams)) {
      setFoodPrefs(seed.id, { needsReview: true })
      return { foodId: seed.id, qty: 1, slot, asGrams: false }
    }
    return { foodId: seed.id, qty: grams ?? qty, slot, asGrams: grams !== undefined }
  }
  // Nothing in the catalog matches. Create a food carrying whatever protein the
  // label implied, flagged so the user can finish it later.
  const id = `custom:${name.toLowerCase().replace(/\W+/g, '-').replace(/^-|-$/g, '') || item.id}`
  if (!foodById(id)) {
    const protein = legacyProtein(item, grams)
    saveFood({
      id,
      name,
      // The old model only ever knew protein, and only per portion. Treating the
      // portion as 100 g makes that number come out right without inventing
      // calories the user never recorded.
      per100: { kcal: 0, protein, carbs: 0, fat: 0 },
      servings: [{ id: `${id}:1`, label: '1 serving', grams: 100 }],
      defaultServingId: `${id}:1`,
      source: 'custom',
      needsReview: true,
      createdAt: Date.now(),
    })
  }
  return { foodId: id, qty: 1, slot, asGrams: false }
}

/**
 * Three months of protein logging recorded ticked boxes, not food. The grams
 * behind each tick lived in a lookup table, and for user-added items they were
 * never captured at all — so "Panner 100g", "Protein bar 17g" and "2 eggs" each
 * scored a flat zero on every day they were ticked.
 *
 * This turns each tick into a real entry with all four macros, matching typed
 * labels against the food catalog and minting a reviewable food where nothing
 * matches. Old keys are deliberately left in place.
 */
export function migrateProteinDays(): void {
  const dayKeys = Object.keys(localStorage).filter(
    k => k.startsWith(DAY_PREFIXES.protein) && k !== KEYS.PROTEIN_CUSTOM)
  if (dayKeys.length === 0) return

  let customItems: ProteinItem[] = []
  try {
    customItems = JSON.parse(localStorage.getItem(KEYS.PROTEIN_CUSTOM) ?? '[]') as ProteinItem[]
  } catch { customItems = [] }

  const resolved = new Map<string, Resolved>()
  for (const item of LEGACY_PROTEIN_ITEMS) {
    const m = ITEM_MAP[item.id]
    if (m) resolved.set(item.id, { ...m, slot: slotFromTime(item.time), asGrams: false })
  }
  for (const item of customItems) resolved.set(item.id, resolveLegacyItem(item))

  let days = 0, entries = 0
  for (const key of dayKeys) {
    const date = key.slice(DAY_PREFIXES.protein.length)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue          // skips protein:custom
    if (localStorage.getItem(KEYS.foodDay(date)) != null) continue   // never clobber real logs

    let checked: Record<string, boolean> = {}
    let extras: ProteinItem[] = []
    try {
      checked = JSON.parse(localStorage.getItem(key) ?? '{}')
      extras = JSON.parse(localStorage.getItem(KEYS.proteinExtra(date)) ?? '[]')
    } catch (err) {
      console.warn(`could not read protein day ${date}`, err)
      continue
    }

    // One-off extras were never in the standing plan, so resolve them here.
    for (const x of extras) if (!resolved.has(x.id)) resolved.set(x.id, resolveLegacyItem(x, 'snack'))

    const out: FoodEntry[] = []
    for (const [itemId, on] of Object.entries(checked)) {
      if (!on) continue
      const r = resolved.get(itemId)
      if (!r) continue
      const food = foodById(r.foodId)
      if (!food) continue
      const servingId = r.asGrams ? undefined : food.defaultServingId
      const { grams, macros } = macrosFor(food, servingId, r.qty)
      out.push({
        id: `m_${date}_${itemId}`,
        foodId: food.id,
        name: food.name,
        servingId,
        qty: r.qty,
        grams,
        macros,
        slot: r.slot,
        // Marks this entry as reconstructed from a checkbox rather than logged.
        // Averages exclude these: a day that only ever recorded two supplement
        // ticks is not a 300-kcal day, it is a barely-logged one.
        migrated: true,
        at: new Date(`${date}T12:00:00`).getTime(),
      })
      entries++
    }
    // Written per day rather than in one batch: 46 days of entries in a single
    // value risks the quota, and the `foodDay` check above makes a partial run
    // resumable — a retry picks up exactly the days that did not land.
    if (out.length) { localStorage.setItem(KEYS.foodDay(date), JSON.stringify(out)); days++ }
  }

  // Old keys are deliberately NOT deleted. They cost a few KB, they are already
  // in every backup, and they are the only way to check this migration later.
  console.info(`migration: converted ${entries} checkbox ticks across ${days} days`)
}

export function needsLegacyTargetMigration(): boolean {
  if (hasCurrentTargetSetup()) return false
  try {
    return localStorage.getItem(KEYS.PROFILE) != null ||
      localStorage.getItem(KEYS.TARGETS) != null
  } catch {
    return false
  }
}

export function migrateLegacyTargets(): void {
  if (!needsLegacyTargetMigration()) return
  localStorage.setItem(KEYS.TARGETS, JSON.stringify(legacyTargets()))
  localStorage.setItem(KEYS.TARGET_SETUP, JSON.stringify(TARGET_SETUP_VERSION))
}

/** Every migration this build knows about, in order. Called once from main.tsx. */
export function runMigrations(): void {
  runOnce('orphan-exercises-v1', migrateOrphanExercises)
  runOnce('protein-days-v1', migrateProteinDays)
  if (needsLegacyTargetMigration()) runOnce('manual-targets-v1', migrateLegacyTargets)
}
