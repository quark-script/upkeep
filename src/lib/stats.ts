import { exerciseById } from './library'
import { KEYS } from './storage'
import type { Session, SetEntry, ExerciseLog, LoadUnit, MeasurementEntry } from './types'

// ─── Units ───────────────────────────────────────────────────────────────────

// Resolved per call rather than cached at import time: a module-level map built
// from the seed catalog can never see a custom lift, so every bodyweight custom
// resolved to 'kg' and recorded a fake load.
export function unitFor(exerciseId: string): LoadUnit {
  return exerciseById(exerciseId)?.unit ?? 'kg'
}

// Prefer the unit captured at log time (survives library edits & custom lifts).
export function logUnit(log: ExerciseLog): LoadUnit {
  return log.unit ?? unitFor(log.exerciseId)
}

// ─── Body weight ─────────────────────────────────────────────────────────────

// The most recent measurement, or null when none has been recorded.
// Reads storage directly so every call site agrees without prop-drilling.
function latestMeasurement(): MeasurementEntry | null {
  try {
    const ms = JSON.parse(localStorage.getItem(KEYS.MEASUREMENTS) ?? '[]') as MeasurementEntry[]
    return [...ms].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null
  } catch {
    return null
  }
}

// Latest logged body weight, used to give bodyweight lifts a real load figure.
export function latestBodyWeightKg(): number {
  return latestMeasurement()?.weight ?? 0
}

/** BMR from the most recent measurement, or 0 when none has been recorded. */
export function latestBmr(): number {
  return latestMeasurement()?.bmr ?? 0
}

// ─── Volume ──────────────────────────────────────────────────────────────────

// Load moved by one set, in kg.
//  · kg         → weight × reps
//  · bodyweight → (body weight + added weight) × reps
//  · time       → 0 (a hold moves no external load)
export function setVolume(set: SetEntry, unit: LoadUnit, bodyWeightKg: number): number {
  if (unit === 'time') return 0
  const load = unit === 'bodyweight' ? bodyWeightKg + set.weight : set.weight
  return load * set.reps
}

export function sessionVolume(s: Session, bodyWeightKg = latestBodyWeightKg()): number {
  return s.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.filter(st => st.done)
        .reduce((a, st) => a + setVolume(st, logUnit(ex), bodyWeightKg), 0),
    0,
  )
}

// ─── Strength ────────────────────────────────────────────────────────────────

// Epley estimated 1-rep max. Timed holds have no meaningful 1RM.
export function e1rm(set: SetEntry, unit: LoadUnit, bodyWeightKg: number): number | null {
  if (unit === 'time') return null
  const load = unit === 'bodyweight' ? bodyWeightKg + set.weight : set.weight
  if (load <= 0 || set.reps <= 0) return null
  return load * (1 + set.reps / 30)
}

// Best estimated 1RM an exercise log reached across its completed sets.
export function bestE1RM(ex: ExerciseLog, bodyWeightKg = latestBodyWeightKg()): number | null {
  const unit = logUnit(ex)
  const vals = ex.sets
    .filter(st => st.done)
    .map(st => e1rm(st, unit, bodyWeightKg))
    .filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : null
}

// Is `a` the better set? Heavier wins; at equal load, more reps wins — which is
// the only thing that separates timed holds and unloaded bodyweight sets, where
// every set carries the same weight.
export function isBetterSet(a: SetEntry, b: SetEntry): boolean {
  return a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps)
}

// The heaviest completed set — the one a lifter thinks of as "today's top set".
export function topSet(ex: ExerciseLog): SetEntry | null {
  const done = ex.sets.filter(st => st.done)
  if (done.length === 0) return null
  return done.reduce((best, st) => (isBetterSet(st, best) ? st : best))
}

// ─── Formatting ──────────────────────────────────────────────────────────────

// How a set reads to a human: "62.5 kg × 8", "BW+10 × 8", "45s".
export function formatSet(set: SetEntry, unit: LoadUnit): string {
  if (unit === 'time') return `${set.reps}s`
  if (unit === 'bodyweight') return `${set.weight > 0 ? `BW+${set.weight}` : 'BW'} × ${set.reps}`
  return `${set.weight} kg × ${set.reps}`
}

// Both moved to progression.ts to keep the module graph acyclic; re-exported
// here so existing importers need no change.
export { stepFor, unitLabels } from './progression'
