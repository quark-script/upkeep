import { EXERCISES, PROTEIN_ITEMS } from './data'
import { KEYS } from './storage'
import type { Session, ExerciseLog, MeasurementEntry, Profile, ProteinItem, SleepEntry } from './types'

// ─── Name / label resolution ────────────────────────────────────────────────

const NAME_BY_ID = new Map(EXERCISES.map(e => [e.id, e.name]))

// Prefer the name captured at log time; fall back to the library, then the raw
// id (back-compat for sessions logged before names were stored).
export function exerciseName(log: ExerciseLog): string {
  return log.name ?? NAME_BY_ID.get(log.exerciseId) ?? log.exerciseId
}

function proteinLabelMap(): Map<string, string> {
  const map = new Map(PROTEIN_ITEMS.map(p => [p.id, p.label]))
  try {
    const custom = JSON.parse(localStorage.getItem(KEYS.PROTEIN_CUSTOM) ?? '[]') as ProteinItem[]
    custom.forEach(p => map.set(p.id, p.label))
  } catch {}
  return map
}

// ─── Shared maths ────────────────────────────────────────────────────────────

function sleepDuration(e: SleepEntry): number | null {
  if (e.bed == null || e.awake == null) return null
  let a = e.awake; if (a < 12) a += 24
  let b = e.bed;   if (b < 12) b += 24
  return Math.round((a - b) * 10) / 10
}

function sessionVolume(s: Session): number {
  return s.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(st => st.done).reduce((a, st) => a + st.weight * st.reps, 0),
    0,
  )
}

function readDayKeys<T>(prefix: string, skip?: (k: string) => boolean): { date: string; value: T }[] {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(prefix) && !(skip?.(k) ?? false))
    .sort()
    .map(k => {
      try {
        return { date: k.replace(prefix, ''), value: JSON.parse(localStorage.getItem(k) ?? 'null') as T }
      } catch {
        return null
      }
    })
    .filter((x): x is { date: string; value: T } => x !== null)
}

// ─── Clean, self-describing report (JSON) ────────────────────────────────────

export function buildReport() {
  const sessions = JSON.parse(localStorage.getItem(KEYS.SESSIONS) ?? '[]') as Session[]
  const measurements = JSON.parse(localStorage.getItem(KEYS.MEASUREMENTS) ?? '[]') as MeasurementEntry[]
  const profile = JSON.parse(localStorage.getItem(KEYS.PROFILE) ?? 'null') as Profile | null
  const labels = proteinLabelMap()

  const workouts = sessions
    .filter(s => s.finishedAt !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      date: s.date,
      type: s.type,
      durationMin: s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null,
      volumeKg: Math.round(sessionVolume(s)),
      note: s.note ?? null,
      exercises: s.exercises
        .filter(ex => ex.sets.length > 0)
        .map(ex => ({
          name: exerciseName(ex),
          note: ex.note ?? null,
          skipped: ex.skipped ?? false,
          sets: ex.sets.map((st, i) => ({
            set: i + 1, weightKg: st.weight, reps: st.reps, done: st.done,
          })),
        })),
    }))

  const sleep = readDayKeys<SleepEntry>('gainz:sleep:')
    .map(({ date, value }) => ({
      date,
      phoneAway: value.phone ?? null,
      inBed: value.bed ?? null,
      awake: value.awake ?? null,
      durationH: sleepDuration(value),
    }))

  const nutrition = readDayKeys<Record<string, boolean>>('gainz:protein:', k => k.endsWith(':custom'))
    .map(({ date, value }) => {
      const items = Object.entries(value).map(([id, done]) => ({ label: labels.get(id) ?? id, done }))
      return { date, hit: items.filter(i => i.done).length, total: items.length, items }
    })

  return {
    app: 'GainZ',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    legend: {
      weight: 'kilograms (kg)',
      times: '24-hour local clock as decimal hours (22.5 = 22:30); sleep times past midnight may read >24',
      volumeKg: 'sum of weight × reps across completed sets',
      note: 'free-text instructions written by the lifter',
    },
    profile,
    workouts,
    measurements: measurements.map(m => ({
      date: m.date,
      weightKg: m.weight,
      bodyFatPct: m.bodyFat,
      muscleMassKg: m.muscleMass,
      bmi: m.bmi,
      bmr: m.bmr,
      circumferencesCm: m.measurements,
    })),
    sleep,
    nutrition,
  }
}

export function reportToJSON(): string {
  return JSON.stringify(buildReport(), null, 2)
}

// ─── CSV (human-readable) ─────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',')
}

export function sessionsToCSV(sessions: Session[]): string {
  const rows = [csvRow([
    'date', 'session_type', 'duration_min', 'exercise', 'set_number',
    'weight_kg', 'reps', 'done', 'exercise_note', 'workout_note',
  ])]
  for (const s of sessions.filter(s => s.finishedAt !== null)) {
    const dur = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : ''
    for (const ex of s.exercises) {
      const name = exerciseName(ex)
      ex.sets.forEach((st, si) => {
        rows.push(csvRow([
          s.date, s.type, dur, name, si + 1,
          st.weight, st.reps, st.done, ex.note ?? '', s.note ?? '',
        ]))
      })
    }
  }
  return rows.join('\n')
}

export function measurementsToCSV(ms: MeasurementEntry[]): string {
  const rows = [csvRow([
    'date', 'weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'bmi', 'bmr',
    'neck', 'shoulder', 'chest', 'biceps', 'forearm', 'upper_abdomen',
    'lower_abdomen', 'waist', 'hips', 'thigh', 'calf',
  ])]
  for (const m of ms) {
    const t = m.measurements
    rows.push(csvRow([
      m.date, m.weight, m.bodyFat, m.muscleMass, m.bmi, m.bmr,
      t.neck, t.shoulder, t.chest, t.biceps, t.forearm, t.upperAbdomen,
      t.lowerAbdomen, t.waist, t.hips, t.thigh, t.calf,
    ]))
  }
  return rows.join('\n')
}

export function sleepToCSV(): string {
  const rows = [csvRow(['date', 'phone_away', 'in_bed', 'awake', 'duration_h'])]
  readDayKeys<SleepEntry>('gainz:sleep:').forEach(({ date, value }) => {
    rows.push(csvRow([date, value.phone ?? '', value.bed ?? '', value.awake ?? '', sleepDuration(value) ?? '']))
  })
  return rows.join('\n')
}

export function proteinToCSV(): string {
  const labels = proteinLabelMap()
  const rows = [csvRow(['date', 'item', 'checked'])]
  readDayKeys<Record<string, boolean>>('gainz:protein:', k => k.endsWith(':custom')).forEach(({ date, value }) => {
    Object.entries(value).forEach(([id, checked]) => {
      rows.push(csvRow([date, labels.get(id) ?? id, checked]))
    })
  })
  return rows.join('\n')
}
