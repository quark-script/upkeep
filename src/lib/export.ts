import { format, subDays } from 'date-fns'
import { EXERCISES, PROTEIN_ITEMS } from './data'
import { KEYS } from './storage'
import { dateKey, parseKey } from './date'
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

// ─── Weekly digest (plain markdown for a human or AI trainer) ────────────────

function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

// PRs set within [startKey, endKey] — a lift's est-1RM beating its own prior
// best. A lift's first-ever appearance is a baseline, not a PR.
function weeklyPRs(all: Session[], startKey: string, endKey: string): { name: string; value: number; date: string }[] {
  const finished = all.filter(s => s.finishedAt !== null).sort((a, b) => a.startedAt - b.startedAt)
  const best: Record<string, number> = {}
  const events: { name: string; value: number; date: string }[] = []
  for (const s of finished) {
    for (const ex of s.exercises) {
      const done = ex.sets.filter(st => st.done)
      if (done.length === 0) continue
      const v = Math.max(...done.map(st => e1rm(st.weight, st.reps)))
      const prev = best[ex.exerciseId]
      if (prev == null) { best[ex.exerciseId] = v; continue }
      if (v > prev + 0.5) {
        best[ex.exerciseId] = v
        if (s.date >= startKey && s.date <= endKey) {
          events.push({ name: exerciseName(ex), value: v, date: s.date })
        }
      }
    }
  }
  return events.sort((a, b) => b.value - a.value)
}

export function buildWeeklyDigest(): string {
  const today = new Date()
  const startKey = dateKey(subDays(today, 6))
  const endKey = dateKey(today)
  const inWin = (d: string) => d >= startKey && d <= endKey

  const allSessions = JSON.parse(localStorage.getItem(KEYS.SESSIONS) ?? '[]') as Session[]
  const sessions = allSessions
    .filter(s => s.finishedAt !== null && inWin(s.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const profile = JSON.parse(localStorage.getItem(KEYS.PROFILE) ?? 'null') as Profile | null

  const L: string[] = []
  L.push('# GainZ — Weekly Digest')
  L.push(`**${format(parseKey(startKey), 'MMM d')} – ${format(parseKey(endKey), 'MMM d, yyyy')}**`)
  if (profile?.name) L.push(`Lifter: ${profile.name}`)
  L.push('')

  // Training
  const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0)
  L.push(`## Training — ${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${Math.round(totalVol).toLocaleString()} kg total`)
  if (sessions.length === 0) L.push('_No workouts logged this week._')
  for (const s of sessions) {
    const dur = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null
    L.push(`- **${format(parseKey(s.date), 'EEE MMM d')} · ${s.type}** — ${Math.round(sessionVolume(s)).toLocaleString()} kg${dur ? `, ${dur} min` : ''}`)
    if (s.note) L.push(`  - note: ${s.note}`)
    for (const ex of s.exercises) {
      const done = ex.sets.filter(st => st.done)
      if (done.length === 0) continue
      const top = done.reduce((b, st) => (st.weight > b.weight ? st : b))
      L.push(`  - ${exerciseName(ex)}: ${done.length} sets, top ${top.weight} kg × ${top.reps}${ex.note ? ` — ${ex.note}` : ''}`)
    }
  }
  L.push('')

  // PRs
  const prs = weeklyPRs(allSessions, startKey, endKey)
  if (prs.length > 0) {
    L.push('## New PRs (est. 1RM)')
    prs.forEach(p => L.push(`- ${p.name}: **${Math.round(p.value)} kg** (${format(parseKey(p.date), 'MMM d')})`))
    L.push('')
  }

  // Nutrition adherence
  const proteinTotal = PROTEIN_ITEMS.length +
    (JSON.parse(localStorage.getItem(KEYS.PROTEIN_CUSTOM) ?? '[]') as ProteinItem[]).length
  const proteinDays = readDayKeys<Record<string, boolean>>('gainz:protein:', k => k.endsWith(':custom'))
    .filter(({ date }) => inWin(date))
  if (proteinDays.length > 0) {
    const avgHit = proteinDays.reduce((a, { value }) => a + Object.values(value).filter(Boolean).length, 0) / proteinDays.length
    L.push(`## Nutrition — protein adherence ${Math.round((avgHit / proteinTotal) * 100)}% (${avgHit.toFixed(1)}/${proteinTotal} items/day avg)`)
    L.push('')
  }

  // Sleep
  const sleepDays = readDayKeys<SleepEntry>('gainz:sleep:')
    .filter(({ date }) => inWin(date))
    .map(({ value }) => sleepDuration(value))
    .filter((d): d is number => d != null)
  if (sleepDays.length > 0) {
    const avg = sleepDays.reduce((a, d) => a + d, 0) / sleepDays.length
    L.push(`## Sleep — ${avg.toFixed(1)} h average over ${sleepDays.length} night${sleepDays.length === 1 ? '' : 's'}`)
    L.push('')
  }

  // Body
  const ms = (JSON.parse(localStorage.getItem(KEYS.MEASUREMENTS) ?? '[]') as MeasurementEntry[])
    .sort((a, b) => a.date.localeCompare(b.date))
  if (ms.length > 0) {
    const latest = ms.at(-1)!
    const prev = ms.length > 1 ? ms[ms.length - 2] : null
    const d = (cur: number, was?: number) => (was == null ? '' : ` (${cur - was >= 0 ? '+' : ''}${(cur - was).toFixed(1)})`)
    L.push('## Body — latest measurement ' + format(parseKey(latest.date), 'MMM d'))
    L.push(`- Weight: ${latest.weight} kg${d(latest.weight, prev?.weight)}`)
    L.push(`- Body fat: ${latest.bodyFat}%${d(latest.bodyFat, prev?.bodyFat)}`)
    L.push(`- Muscle: ${latest.muscleMass} kg${d(latest.muscleMass, prev?.muscleMass)}`)
    L.push('')
  }

  L.push('_Generated by GainZ._')
  return L.join('\n')
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
