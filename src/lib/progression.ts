import type { Exercise, Session, ExerciseLog, LiveSet, LoadUnit } from './types'

// ─── Units ───────────────────────────────────────────────────────────────────
// `stepFor` and `unitLabels` live here rather than in stats.ts on purpose:
// stats.ts needs `exerciseById` from library.ts, and library.ts needs the step
// size. Keeping them here makes the dependency run one way only —
// stats → library → progression → types.

export function unitLabels(unit: LoadUnit): { load: string; count: string } {
  if (unit === 'time') return { load: '', count: 'SEC' }
  if (unit === 'bodyweight') return { load: '+KG', count: 'REPS' }
  return { load: 'KG', count: 'REPS' }
}

// Step sizes for the +/- steppers, tuned per unit and lift category.
export function stepFor(unit: LoadUnit, category: 'compound' | 'isolation'): { load: number; count: number } {
  if (unit === 'time') return { load: 0, count: 10 }
  return { load: category === 'compound' ? 2.5 : 1.25, count: 1 }
}

/** How many qualifying sessions in a row earn a load increase. */
const QUALIFY_STREAK = 2

/** Sessions of no-progress before the Exercises screen offers to raise a range. */
const OVERSHOOT_STREAK = 3

// Every past appearance of a lift, newest first. Deliberately not filtered by
// workout type — a lift you moved to another day still carries its history.
export function pastLogs(sessions: Session[], exerciseId: string): { session: Session; log: ExerciseLog }[] {
  return sessions
    .filter(s => s.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(s => {
      const log = s.exercises.find(e => e.exerciseId === exerciseId)
      return log ? { session: s, log } : null
    })
    .filter((x): x is { session: Session; log: ExerciseLog } => x !== null)
}

/**
 * Pull the numeric bounds out of a prescribed rep string: "8–10", "12",
 * "30–60s", "10–12 ea". Handles both the en-dash used in the seed catalog and a
 * plain hyphen, since users type the latter.
 *
 * Returns null when there is nothing numeric to read, which disables bumping
 * for that lift rather than guessing a range.
 */
export function parseRepRange(reps: string): { min: number; max: number } | null {
  const nums = reps.match(/\d+/g)
  if (!nums || nums.length === 0) return null
  const min = parseInt(nums[0], 10)
  const max = nums.length > 1 ? parseInt(nums[1], 10) : min
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null
  return { min, max }
}

// Starting numbers for a lift the app has never seen logged.
function blankSet(unit: LoadUnit): { w: number; r: number } {
  if (unit === 'time') return { w: 0, r: 30 }
  if (unit === 'bodyweight') return { w: 0, r: 8 }
  return { w: 20, r: 10 }
}

export interface Bump {
  from: number
  to: number
  /** Carried explicitly so consumers never infer it from `reason`. */
  unit: LoadUnit
  /** Human-readable, shown on the chip's tooltip: "2 sessions at 12 reps". */
  reason: string
}

export interface Prefill {
  sets: LiveSet[]
  bump: Bump | null
}

/**
 * A session qualifies for progression when every set was completed AND every
 * set reached the top of the prescribed rep range. This is the whole fix: the
 * old rule asked only "were all sets ticked", which was true on 91 of the
 * user's sessions, so it offered more weight essentially every time and the
 * suggestion stopped carrying information.
 *
 * Comparison is `>=`, not `===`. Overshooting a range still qualifies, so a
 * range set too low makes the rule fire sooner rather than never.
 */
function qualifies(log: ExerciseLog, max: number): boolean {
  if (log.skipped) return false
  if (log.sets.length === 0) return false
  if (!log.sets.every(s => s.done)) return false
  // Works for timed holds unchanged: the "reps" field carries seconds there, and
  // the parsed range is in seconds ("30–60s"), so both sides use the same unit.
  return log.sets.every(s => s.reps >= max)
}

function topSet(log: ExerciseLog) {
  const done = log.sets.filter(s => s.done)
  if (done.length === 0) return null
  return done.reduce((best, s) => (s.weight > best.weight ? s : best))
}

/**
 * Seed one exercise's rows for a new session.
 *
 * `sets` ALWAYS prefill at last session's actual numbers — never the bumped
 * value. The increase is offered separately via `bump`, so an unwanted
 * suggestion costs a glance instead of an edit. `expW`/`expR` keep pointing at
 * last session so `beatsExpected` in Workout.tsx keeps working unchanged.
 *
 * The qualifying streak is recomputed from history on every call rather than
 * stored, so editing a past day corrects the streak automatically.
 */
export function prefillFor(ex: Exercise, sessions: Session[]): Prefill {
  const unit = ex.unit ?? 'kg'
  const step = ex.step ?? stepFor(unit, ex.category).load
  const range = parseRepRange(ex.defaultReps)
  const history = pastLogs(sessions, ex.id)

  const withSets = history.filter(h => topSet(h.log) !== null)
  if (withSets.length === 0) {
    const b = blankSet(unit)
    return {
      sets: Array.from({ length: ex.defaultSets }, () => ({
        done: false, expW: b.w, expR: b.r, actW: b.w, actR: b.r,
      })),
      bump: null,
    }
  }

  const last = topSet(withSets[0].log)!

  let bump: Bump | null = null
  if (range) {
    // Count the whole run, not just up to the threshold. A long run is not
    // noise to be suppressed — it is the strongest signal the app has that a
    // lift is being under-loaded, and the wording below escalates to say so.
    // Waving the chip away is per-session; that is the "not today" answer.
    let streak = 0
    for (const h of history) {
      if (!qualifies(h.log, range.max)) break
      streak++
    }
    if (streak >= QUALIFY_STREAK) {
      // Timed holds progress on duration; everything else on load.
      const held = unit === 'time' ? `${range.max}s` : `${range.max} reps`
      // The wording carries the actual run length, so a lift stuck for months
      // reads differently from one that just earned its first increase.
      const reason = streak > QUALIFY_STREAK
        ? `${streak} sessions running at ${held} — this is overdue`
        : `${streak} sessions at ${held}`
      bump = unit === 'time'
        ? { from: last.reps, to: last.reps + stepFor(unit, ex.category).count, unit, reason }
        : { from: last.weight, to: Math.round((last.weight + step) * 100) / 100, unit, reason }
    }
  }

  // Row count comes from the plan, not from last time. Inheriting it would
  // ratchet: add two extra sets once, fail to complete them, and every future
  // session is seeded with rows that can never all be completed.
  return {
    sets: Array.from({ length: ex.defaultSets }, () => ({
      done: false, expW: last.weight, expR: last.reps, actW: last.weight, actR: last.reps,
    })),
    bump,
  }
}

/**
 * Accept a bump. Load goes up and reps restart at the BOTTOM of the range —
 * that is the point of double progression: you buy the heavier weight by giving
 * back the reps and climbing again.
 */
export function applyBump(sets: LiveSet[], bump: Bump, min: number): LiveSet[] {
  // Timed holds progress on duration, so the bump lands on reps (= seconds)
  // and there is no rep count to give back.
  if (bump.unit === 'time') return sets.map(s => ({ ...s, actR: bump.to }))
  return sets.map(s => ({ ...s, actW: bump.to, actR: min }))
}

/**
 * True when the last few sessions all blew past the prescribed maximum without
 * the range ever being raised — a sign `defaultReps` no longer describes how
 * this lift is actually trained. Surfaced in the Exercises screen, never as an
 * interruption during a workout.
 */
export function overshooting(ex: Exercise, sessions: Session[]): boolean {
  const range = parseRepRange(ex.defaultReps)
  if (!range) return false
  const recent = pastLogs(sessions, ex.id).slice(0, OVERSHOOT_STREAK)
  if (recent.length < OVERSHOOT_STREAK) return false
  return recent.every(h =>
    h.log.sets.length > 0 && h.log.sets.every(s => s.done && s.reps > range.max))
}

/**
 * The range a lift is actually being trained in, rounded to the reps the last
 * few sessions kept hitting. Used by the "raise range" one-tap fix.
 */
export function suggestedRange(ex: Exercise, sessions: Session[]): string | null {
  const range = parseRepRange(ex.defaultReps)
  if (!range) return null
  const recent = pastLogs(sessions, ex.id).slice(0, OVERSHOOT_STREAK)
  const reps = recent.flatMap(h => h.log.sets.filter(s => s.done).map(s => s.reps))
  if (reps.length === 0) return null
  const lowest = Math.min(...reps)
  const width = range.max - range.min
  return `${lowest}–${lowest + (width || 2)}`
}
