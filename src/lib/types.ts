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
}

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

export interface ProteinItem {
  id: string
  label: string
  time?: string
  grams?: number    // protein content estimate; absent = 0 (e.g. creatine)
  custom?: boolean  // user-added to the standing daily plan
  oneOff?: boolean  // logged for a single day only, not part of the plan
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
  restSeconds?: number      // rest-timer default; absent = 90
  restSound?: boolean       // chime when rest ends; absent = true
  restAuto?: boolean        // start rest automatically on each logged set; absent = false
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
