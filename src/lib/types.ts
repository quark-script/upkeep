export type WorkoutType = 'PUSH' | 'PULL' | 'LEGS'
export type DayType = WorkoutType | 'REST'

// How a lift is loaded and counted:
//  · kg         → `weight` is the bar/stack load in kg, `reps` is repetitions
//  · bodyweight → `weight` is *added* kg (0 = pure bodyweight), `reps` is repetitions
//  · time       → `weight` is unused, `reps` holds the hold duration in seconds
export type LoadUnit = 'kg' | 'bodyweight' | 'time'

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'

export interface SetEntry {
  weight: number
  reps: number
  done: boolean
}

export interface ExerciseLog {
  exerciseId: string
  name?: string       // human name captured at log time (survives export & custom lifts)
  unit?: LoadUnit     // load unit captured at log time; absent = 'kg' (pre-unit sessions)
  sets: SetEntry[]
  skipped?: boolean
  note?: string       // per-exercise note / instruction
}

export interface Session {
  id: string
  date: string        // ISO YYYY-MM-DD
  type: WorkoutType
  startedAt: number   // epoch ms
  finishedAt: number | null
  exercises: ExerciseLog[]
  note?: string       // workout-level note / instruction
}

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other'

export interface Exercise {
  id: string
  name: string
  defaultSets: number
  defaultReps: string
  category: 'compound' | 'isolation'
  day: WorkoutType[]
  optional?: boolean    // not in the default day session; available via the picker
  unit?: LoadUnit       // absent = 'kg'
  groups?: MuscleGroup[]  // muscles trained, for weekly balance
  aliases?: string[]      // alternate spellings, matched by search, never displayed
  equipment?: Equipment
  step?: number           // load increment in kg; absent = stepFor(unit, category)
  custom?: boolean        // true = user-created, stored in upkeep:exercises
}

// Per-exercise user overrides, keyed by exercise id. Sparse by design: only
// fields the user actually changed are present, so improvements to the seed
// catalog still reach every field left untouched.
export interface ExercisePrefs {
  step?: number
  unit?: LoadUnit
  groups?: MuscleGroup[]
  defaultSets?: number
  defaultReps?: string
  hidden?: boolean
}

// The user's lift list for one workout type, replacing the `day` + `optional`
// seed defaults once set. Array order is display order.
export type DayPlan = Partial<Record<WorkoutType, string[]>>

export interface MeasurementEntry {
  date: string        // YYYY-MM-DD
  weight: number      // kg
  bodyFat: number     // %
  muscleMass: number  // kg
  bmi: number
  bmr: number
  measurements: {
    neck: number
    shoulder: number
    chest: number
    biceps: number
    forearm: number
    upperAbdomen: number
    lowerAbdomen: number
    waist: number
    hips: number
    thigh: number
    calf: number
  }
}

export interface Profile {
  name: string
}

/** Legacy: the pre-food checkbox plan. Kept only so the migration can read it. */
export interface ProteinItem {
  id: string
  label: string
  time?: string
  grams?: number    // protein content estimate; absent = 0 (e.g. creatine)
  custom?: boolean  // user-added to the standing daily plan
  oneOff?: boolean  // logged for a single day only, not part of the plan
}

// ─── Nutrition ──────────────────────────────────────────────────────────

export type FoodSource = 'seed' | 'custom' | 'off'

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner'

/** Macros per 100 g (or per 100 ml for liquids). The single source of truth —
 *  every serving is a gram weight that scales these. */
export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** A named household portion. `grams` is what it actually weighs, which is how
 *  it converts to macros — so "1 bowl" can be corrected once and every entry
 *  logged from then on stays consistent. */
export interface Serving {
  id: string
  label: string
  grams: number
}

export interface Food {
  id: string
  name: string
  brand?: string
  per100: Macros
  servings: Serving[]        // always non-empty
  defaultServingId: string
  liquid?: boolean           // label servings in ml
  source: FoodSource
  barcode?: string           // reserved for a future scanner
  aliases?: string[]
  needsReview?: boolean      // migrated with estimated or missing macros
  createdAt: number
  lastUsedAt?: number
}

/** One thing eaten. `grams` and `macros` are resolved at log time and stored,
 *  NOT derived on read: correcting a food's serving weight later must improve
 *  the future without silently rewriting three months of history. */
export interface FoodEntry {
  id: string
  foodId: string
  name: string               // captured at log time, survives food deletion
  servingId?: string         // absent = logged as a raw gram weight
  qty: number                // servings, or grams when servingId is absent
  grams: number
  macros: Macros
  slot: MealSlot
  /** Reconstructed by the protein-checkbox migration rather than logged. Such a
   *  day recorded only which supplements were ticked, so its totals are a floor,
   *  not a measurement — averages and charts exclude them. */
  migrated?: boolean
  at: number
}

export interface MacroTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Only the fields the user has pinned; the rest are derived. */
export interface TargetOverrides extends Partial<MacroTargets> {
  activityFactor?: number    // BMR multiplier; absent = 1.5
  goalDelta?: number         // kcal above/below maintenance; absent = +200
}

// One night's sleep, keyed by the date you went to bed — so `awake` is the
// following morning. Times are 24h floats (0–25); values >24 crossed midnight.
export interface SleepEntry {
  phone?: number
  bed?: number
  awake?: number
  quality?: number   // 1–5, how rested you felt
}

// ─── Scheduled routines (medicines, skincare) ────────────────────────────────

// When a routine item is expected. `weekly.days` uses JS weekdays (0 = Sunday).
// `interval` counts from `anchor`, so "every 3rd day" survives missed days.
export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekly'; days: number[] }
  | { kind: 'interval'; everyDays: number; anchor: string }
  | { kind: 'asNeeded' }

export type DaySlot = 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime'

export type MedForm = 'tablet' | 'capsule' | 'sachet' | 'drops' | 'injection' | 'other'

export interface Medicine {
  id: string
  name: string          // "Magnesium"
  dose?: string         // "250 mg", "60,000 IU"
  form?: MedForm
  schedule: Schedule
  slot: DaySlot
  note?: string         // "with food", "after dinner"
  startedOn?: string    // yyyy-MM-dd; nothing is "missed" before this
  active: boolean
}

export type SkinRoutine = 'am' | 'pm'
export type SkinKind = 'cleanser' | 'active' | 'moisturiser' | 'sunscreen' | 'other'

export interface SkinStep {
  id: string
  label: string         // "Niacinamide 10% serum"
  brand?: string        // "Brand name"
  kind?: SkinKind
  routine: SkinRoutine
  order: number         // application order within the routine
  schedule: Schedule
  note?: string         // "wait 1 min before next step"
  startedOn?: string    // yyyy-MM-dd; nothing counts as skipped before this
  active: boolean
}

export interface Settings {
  theme: 'vault' | 'ledger' | 'spec'
  proteinTargetG?: number   // daily protein goal in grams; absent = derived from body weight
}

// Live set state during an active workout session
export interface LiveSet {
  done: boolean
  expW: number  // expected weight (from last session)
  expR: number  // expected reps
  actW: number  // actual weight (user input)
  actR: number  // actual reps
}

// In-progress workout log, keyed by exerciseId (robust across list changes).
export type LiveLog = Record<string, LiveSet[]>

// A workout in progress (live today) or being entered/edited (past day),
// auto-saved to localStorage so a reload never loses logged sets.
export interface WorkoutDraft {
  date: string                 // yyyy-MM-dd (matches the storage key)
  type: WorkoutType
  mode: 'live' | 'manual'      // live = today w/ timer; manual = past-day entry
  startedAt: number | null     // epoch ms for live sessions; null for manual
  customExercises: Exercise[]  // ad-hoc exercises added this session
  log: LiveLog
  note?: string                // workout-level note
  notes?: Record<string, string>  // per-exercise notes, keyed by exerciseId
  activeId: string | null      // currently expanded exercise
  editingId: string | null     // id of an existing Session being edited, if any
  updatedAt: number
}
