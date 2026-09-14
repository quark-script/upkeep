// Every key this app owns lives under one prefix, so backup, export and reset
// can find them all without guessing.
export const PREFIX = 'upkeep:'

/** The app's previous name — data written before the rename still uses it. */
const LEGACY_PREFIX = 'gainz:'

export const KEYS = {
  PROFILE: `${PREFIX}profile`,
  SESSIONS: `${PREFIX}sessions`,
  EXERCISES: `${PREFIX}exercises`,
  EXERCISE_PREFS: `${PREFIX}exercise-prefs`,
  DAY_PLAN: `${PREFIX}day-plan`,
  SKIP_STREAKS: `${PREFIX}skip-streaks`,
  MIGRATIONS: `${PREFIX}migrations`,
  FOODS: `${PREFIX}foods`,
  FOOD_PREFS: `${PREFIX}food-prefs`,
  TARGETS: `${PREFIX}macro-targets`,
  TARGET_SETUP: `${PREFIX}target-setup-version`,
  SETTINGS: `${PREFIX}settings`,
  MEASUREMENTS: `${PREFIX}measurements`,
  PROTEIN_CUSTOM: `${PREFIX}protein:custom`,
  REST_END: `${PREFIX}rest-end`,
  LAST_BACKUP: `${PREFIX}last-backup`,
  SYNC_STATE: `${PREFIX}sync-state`,
  MEDICINES: `${PREFIX}medicines`,
  SKINCARE: `${PREFIX}skincare`,
  DAILY_SECTION: `${PREFIX}daily-section`,
  foodDay:      (date: string) => `${PREFIX}food:${date}`,
  proteinDay:   (date: string) => `${PREFIX}protein:${date}`,
  proteinExtra: (date: string) => `${PREFIX}protein-extra:${date}`,
  sleepDay:     (date: string) => `${PREFIX}sleep:${date}`,
  dayOverride:  (date: string) => `${PREFIX}day-override:${date}`,
  workoutDraft: (date: string) => `${PREFIX}workout-draft:${date}`,
  medsDay:      (date: string) => `${PREFIX}meds-day:${date}`,
  skinDay:      (date: string) => `${PREFIX}skin-day:${date}`,
} as const

/** Prefixes for the per-day key families, used when scanning storage. */
export const DAY_PREFIXES = {
  food:    `${PREFIX}food:`,
  protein: `${PREFIX}protein:`,
  sleep:   `${PREFIX}sleep:`,
  meds:    `${PREFIX}meds-day:`,
  skin:    `${PREFIX}skin-day:`,
} as const

/**
 * One-time rename of `gainz:*` keys to `upkeep:*`.
 *
 * Each key is copied and its original deleted immediately, one at a time, so
 * progress is monotonic: a failure part-way through leaves every key either
 * fully migrated or still under the old name, never both. Doing it key-by-key
 * also keeps peak usage flat, since the copy would otherwise briefly double
 * every value — the most likely way to hit the quota in the first place.
 *
 * Anything left behind is picked up on the next load, because the loop skips
 * keys already present under the new prefix.
 */
export function migrateLegacyKeys(): number {
  let legacy: string[]
  try {
    legacy = Object.keys(localStorage).filter(k => k.startsWith(LEGACY_PREFIX))
  } catch {
    return 0
  }
  if (legacy.length === 0) return 0

  let migrated = 0
  for (const oldKey of legacy) {
    try {
      const newKey = PREFIX + oldKey.slice(LEGACY_PREFIX.length)
      const value = localStorage.getItem(oldKey)
      // Never clobber data already written under the new name; the stale
      // original is still safe to drop.
      if (value != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, value)
        migrated++
      }
      localStorage.removeItem(oldKey)
    } catch (err) {
      // Leave this key (and the rest) for the next load rather than losing it.
      console.warn(`storage migration stopped at "${oldKey}"`, err)
      break
    }
  }
  return migrated
}
