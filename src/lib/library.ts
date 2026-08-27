import { EXERCISES } from './data'
import { KEYS } from './storage'
import { normaliseName as normalise, sameName } from './text'
import type { Exercise, ExercisePrefs, DayPlan, WorkoutType } from './types'

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

/** Re-exported so existing importers keep working; the rule lives in `./text`. */
export { normaliseName } from './text'

/** User-created exercises only. Seed lifts are never stored. */
export function customExercises(): Exercise[] {
  return read<Exercise[]>(KEYS.EXERCISES, [])
}

function prefs(): Record<string, ExercisePrefs> {
  return read<Record<string, ExercisePrefs>>(KEYS.EXERCISE_PREFS, {})
}

export function prefsFor(id: string): ExercisePrefs {
  return prefs()[id] ?? {}
}

function applyPrefs(ex: Exercise, p: ExercisePrefs | undefined): Exercise {
  if (!p) return ex
  return {
    ...ex,
    ...(p.step !== undefined && { step: p.step }),
    ...(p.unit !== undefined && { unit: p.unit }),
    ...(p.groups !== undefined && { groups: p.groups }),
    ...(p.defaultSets !== undefined && { defaultSets: p.defaultSets }),
    ...(p.defaultReps !== undefined && { defaultReps: p.defaultReps }),
  }
}

/**
 * Every exercise available to the app: seed catalog plus user customs, each
 * merged with its overrides, hidden ones dropped.
 *
 * Not memoised. It reads three small localStorage keys and maps a ~90-entry
 * array; callers that need it per-render should wrap it in useMemo with the
 * dependencies they actually care about, rather than this module holding a
 * cache that goes stale the moment a custom is added.
 */
export function resolveLibrary(): Exercise[] {
  const p = prefs()
  return [...EXERCISES, ...customExercises()]
    .filter(ex => !p[ex.id]?.hidden)
    .map(ex => applyPrefs(ex, p[ex.id]))
}

/**
 * Resolve one id, including hidden lifts — history must still render the name
 * of a lift the user has since hidden. Returns undefined for ids that predate
 * name capture, so callers can show "Unknown lift" instead of crashing.
 */
export function exerciseById(id: string): Exercise | undefined {
  const p = prefs()
  const found = [...EXERCISES, ...customExercises()].find(e => e.id === id)
  return found ? applyPrefs(found, p[found.id]) : undefined
}

/**
 * The lift list for one workout day: the user's saved plan if they have one,
 * otherwise the seed default (non-optional lifts tagged for that day).
 */
export function planFor(type: WorkoutType): Exercise[] {
  const p = prefs()
  const ids = read<DayPlan>(KEYS.DAY_PLAN, {})[type]
  // An empty saved plan is a real choice, not an absent one — dropping the last
  // lift from a day must leave it empty, never resurrect the seed defaults.
  if (Array.isArray(ids)) {
    return ids
      .map(id => exerciseById(id))
      .filter((e): e is Exercise => e !== undefined && !p[e.id]?.hidden)
  }
  return EXERCISES
    .filter(e => e.day.includes(type) && !e.optional && !p[e.id]?.hidden)
    .map(e => applyPrefs(e, p[e.id]))
}

/** True once the user has edited this day's list; drives "Reset to default". */
export function hasCustomPlan(type: WorkoutType): boolean {
  return Array.isArray(read<DayPlan>(KEYS.DAY_PLAN, {})[type])
}

/**
 * The stored id list for a day, or the seed default materialised.
 *
 * Plan edits must go through this, NOT through `planFor`: that filters hidden
 * lifts out, so rebuilding the stored array from it would quietly delete a
 * hidden lift from the plan the next time anything else on that day was
 * reordered or dropped — an irreversible config edit from an unrelated action.
 */
function planIds(type: WorkoutType): string[] {
  const saved = read<DayPlan>(KEYS.DAY_PLAN, {})[type]
  if (Array.isArray(saved)) return saved
  return EXERCISES.filter(e => e.day.includes(type) && !e.optional).map(e => e.id)
}

export function setPlan(type: WorkoutType, ids: string[]): void {
  write(KEYS.DAY_PLAN, { ...read<DayPlan>(KEYS.DAY_PLAN, {}), [type]: ids })
}

export function resetPlan(type: WorkoutType): void {
  const { [type]: _drop, ...rest } = read<DayPlan>(KEYS.DAY_PLAN, {})
  write(KEYS.DAY_PLAN, rest)
}

export function setPrefs(id: string, patch: Partial<ExercisePrefs>): void {
  const all = prefs()
  write(KEYS.EXERCISE_PREFS, { ...all, [id]: { ...all[id], ...patch } })
}

/** Drop one overridden field so the seed value shows through again. */
export function clearPref(id: string, field: keyof ExercisePrefs): void {
  const all = prefs()
  if (!all[id]) return
  const { [field]: _drop, ...rest } = all[id]
  write(KEYS.EXERCISE_PREFS, { ...all, [id]: rest })
}

/**
 * Lifts the user has hidden. They are absent from `resolveLibrary` by design,
 * so without this there would be no way back — the Exercises screen lists them
 * separately and offers an unhide.
 */
export function hiddenExercises(): Exercise[] {
  const p = prefs()
  return [...EXERCISES, ...customExercises()].filter(ex => p[ex.id]?.hidden)
}

export function hideExercise(id: string): void {
  setPrefs(id, { hidden: true })
}

export function unhideExercise(id: string): void {
  clearPref(id, 'hidden')
}

/** Turn a name into a slug id, e.g. "Preacher Curl" -> "custom:preacher-curl". */
function slugId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `custom:${slug || Date.now()}`
}

/**
 * Look a typed name up in the whole library first — including seed aliases —
 * and return the existing lift if there is one. Only a genuinely new name mints
 * an id. This is the fix for the same lift becoming a new random UUID on every
 * session; ids are stable and derived from the name.
 */
export function upsertCustom(name: string, patch: Partial<Exercise> = {}): Exercise {
  const trimmed = name.trim()

  for (const ex of [...EXERCISES, ...customExercises()]) {
    if (sameName(ex.name, trimmed)) return applyPrefs(ex, prefs()[ex.id])
    if (ex.aliases?.some(a => sameName(a, trimmed))) return applyPrefs(ex, prefs()[ex.id])
  }

  const customs = customExercises()
  let id = slugId(trimmed)
  // A different name can still slugify to a taken id; disambiguate rather than
  // silently merging two distinct lifts.
  if (customs.some(c => c.id === id) || EXERCISES.some(e => e.id === id)) {
    id = `${id}-${customs.length + 1}`
  }

  const created: Exercise = {
    id,
    name: trimmed,
    defaultSets: 3,
    defaultReps: '10–12',
    category: 'isolation',
    day: [],
    optional: true,
    custom: true,
    ...patch,
  }
  write(KEYS.EXERCISES, [...customs, created])
  return created
}

/** Edit a user-created lift's name in place, keeping its id and history. */
export function renameCustom(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  write(KEYS.EXERCISES, customExercises().map(c => (c.id === id ? { ...c, name: trimmed } : c)))
}

/**
 * Picker search. Ranked rather than filtered, so a lift tagged to another day
 * is still reachable — it just sorts below the ones for today.
 *
 * Tiers: exact name > exact alias > name prefix > name substring > alias
 * substring. An exact alias ranks with an exact name — someone typing
 * "deadlift" means the lift tagged with it, not whatever else starts the same
 * way. Within a tier, lifts for the current day come first, then shorter names,
 * so "row" surfaces "Barbell Row" above "Chest-Supported Row".
 */
export function searchLibrary(query: string, type: WorkoutType): Exercise[] {
  const all = resolveLibrary()
  const q = normalise(query)
  if (!q) {
    const onDay = all.filter(e => e.day.includes(type))
    const rest = all.filter(e => !e.day.includes(type))
    return [...onDay, ...rest]
  }

  const scored: { ex: Exercise; tier: number }[] = []
  for (const ex of all) {
    const name = normalise(ex.name)
    const aliases = (ex.aliases ?? []).map(normalise)
    let tier = -1
    if (name === q || sameName(ex.name, query)) tier = 0
    else if (aliases.includes(q) || aliases.some(a => sameName(a, query))) tier = 1
    else if (name.startsWith(q)) tier = 2
    else if (name.includes(q)) tier = 3
    else if (aliases.some(a => a.includes(q))) tier = 4
    if (tier >= 0) scored.push({ ex, tier })
  }

  return scored
    .sort((a, b) =>
      a.tier - b.tier ||
      Number(b.ex.day.includes(type)) - Number(a.ex.day.includes(type)) ||
      a.ex.name.length - b.ex.name.length)
    .map(s => s.ex)
}

// ─── Plan drift ──────────────────────────────────────────────────────────────
// How many finished sessions in a row a planned lift can be skipped before the
// workout screen asks whether it still belongs on the day.

function streaks(): Record<string, number> {
  return read<Record<string, number>>(KEYS.SKIP_STREAKS, {})
}

export function skipStreak(id: string): number {
  return streaks()[id] ?? 0
}

export function bumpSkipStreak(id: string): number {
  const all = streaks()
  const next = (all[id] ?? 0) + 1
  write(KEYS.SKIP_STREAKS, { ...all, [id]: next })
  return next
}

export function resetSkipStreak(id: string): void {
  const all = streaks()
  if (!all[id]) return
  const { [id]: _drop, ...rest } = all
  write(KEYS.SKIP_STREAKS, rest)
}

/**
 * Remove a lift from a day. The plan is materialised from the seed defaults
 * first if the user has never edited it, so dropping one lift does not silently
 * adopt an empty plan.
 */
export function dropFromPlan(type: WorkoutType, id: string): void {
  setPlan(type, planIds(type).filter(x => x !== id))
  resetSkipStreak(id)
}

/** Replace a lift in place, keeping its position in the day's order. */
export function swapInPlan(type: WorkoutType, oldId: string, newId: string): void {
  const ids = planIds(type).map(id => (id === oldId ? newId : id))
  // A lift already on the day would otherwise appear twice.
  setPlan(type, ids.filter((id, i) => ids.indexOf(id) === i))
  resetSkipStreak(oldId)
}

/** Append a lift to a day's plan, materialising the seed default first. */
export function addToPlan(type: WorkoutType, id: string): void {
  const ids = planIds(type)
  if (ids.includes(id)) return
  // Adding a hidden lift back to a day is an explicit request for it: unhide,
  // or it would be written to the plan and then filtered straight back out.
  if (prefs()[id]?.hidden) unhideExercise(id)
  setPlan(type, [...ids, id])
}

/** The day's plan including hidden lifts — for the editor, which must show
 *  everything it is about to rewrite. */
export function planIdsFor(type: WorkoutType): string[] {
  return planIds(type)
}
