export type WorkoutType = 'PUSH' | 'PULL' | 'LEGS'
export type DayType = WorkoutType | 'REST'

export interface SetEntry {
  weight: number
  reps: number
  done: boolean
}

export interface ExerciseLog {
  exerciseId: string
  sets: SetEntry[]
  skipped?: boolean
}

export interface Session {
  id: string
  date: string        // ISO YYYY-MM-DD
  type: WorkoutType
  startedAt: number   // epoch ms
  finishedAt: number | null
  exercises: ExerciseLog[]
}

export interface Exercise {
  id: string
  name: string
  defaultSets: number
  defaultReps: string
  category: 'compound' | 'isolation'
  day: WorkoutType[]
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
  custom?: boolean
}

// Times stored as 24h floats (0–25); values >24 crossed midnight
export interface SleepEntry {
  phone?: number
  bed?: number
  awake?: number
}

export interface Settings {
  theme: 'vault' | 'ledger' | 'spec'
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
  activeId: string | null      // currently expanded exercise
  editingId: string | null     // id of an existing Session being edited, if any
  updatedAt: number
}
