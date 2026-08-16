import { format, subDays } from 'date-fns'
import { EXERCISES, PROTEIN_ITEMS } from './data'
import { KEYS, DAY_PREFIXES } from './storage'
import { dateKey, parseKey } from './date'
import { sessionVolume, bestE1RM, logUnit, formatSet, topSet, latestBodyWeightKg } from './stats'
import { proteinTargetG, itemsForDay, proteinForDay } from './nutrition'
import { isDue, scheduleLabel, adherence } from './routines'
import { sleepDurationH } from './sleep'
import type {
  Session, ExerciseLog, MeasurementEntry, Profile, ProteinItem, SleepEntry, Medicine, SkinStep,
} from './types'

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
        .map(ex => {
          const unit = logUnit(ex)
          return {
            name: exerciseName(ex),
            loadUnit: unit,
            note: ex.note ?? null,
            skipped: ex.skipped ?? false,
            sets: ex.sets.map((st, i) =>
              unit === 'time'
                ? { set: i + 1, holdSeconds: st.reps, done: st.done }
                : { set: i + 1, weightKg: st.weight, reps: st.reps, done: st.done },
            ),
          }
        }),
    }))

  const sleep = readDayKeys<SleepEntry>(DAY_PREFIXES.sleep)
    .map(({ date, value }) => ({
      nightOf: date,
      phoneAway: value.phone ?? null,
      inBed: value.bed ?? null,
      awake: value.awake ?? null,
      durationH: sleepDurationH(value),
      quality: value.quality ?? null,
    }))

  const target = proteinTargetG()
  const nutrition = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.protein, k => k.endsWith(':custom'))
    .map(({ date, value }) => {
      const byId = new Map(itemsForDay(date).map(it => [it.id, it]))
      const items = Object.entries(value).map(([id, done]) => {
        const it = byId.get(id)
        return { label: it?.label ?? labels.get(id) ?? id, proteinG: it?.grams ?? 0, done }
      })
      const eaten = items.filter(i => i.done)
      return {
        date,
        proteinG: eaten.reduce((a, i) => a + i.proteinG, 0),
        targetG: target,
        hit: eaten.length,
        total: items.length,
        items,
      }
    })

  const meds = JSON.parse(localStorage.getItem(KEYS.MEDICINES) ?? '[]') as Medicine[]
  const skin = JSON.parse(localStorage.getItem(KEYS.SKINCARE) ?? '[]') as SkinStep[]
  const medName = new Map(meds.map(m => [m.id, m.dose ? `${m.name} ${m.dose}` : m.name]))
  const skinName = new Map(skin.map(s => [s.id, s.brand ? `${s.brand} ${s.label}` : s.label]))

  const medicineLog = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.meds)
    .map(({ date, value }) => ({
      date,
      taken: Object.entries(value).filter(([, v]) => v).map(([id]) => medName.get(id) ?? id),
      missed: meds
        .filter(m => m.active && isDue(m.schedule, date) && !value[m.id] && !(m.startedOn && date < m.startedOn))
        .map(m => medName.get(m.id) ?? m.id),
    }))

  const skincareLog = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.skin)
    .map(({ date, value }) => ({
      date,
      done: Object.entries(value).filter(([, v]) => v).map(([id]) => skinName.get(id) ?? id),
      skipped: skin
        .filter(s => s.active && isDue(s.schedule, date) && !value[s.id])
        .map(s => `${skinName.get(s.id) ?? s.id} (${s.routine.toUpperCase()})`),
    }))

  return {
    app: 'Upkeep',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    legend: {
      weight: 'kilograms (kg)',
      times: '24-hour local clock as decimal hours (22.5 = 22:30); sleep times past midnight may read >24',
      sleep: 'each entry is keyed by nightOf, the date the lifter went to bed — `awake` is the following morning',
      sleepQuality: 'self-rated 1 (wrecked) to 5 (fully rested); null when not rated',
      proteinG: 'estimated grams of protein from the items ticked that day, against the daily targetG',
      loadUnit:
        'kg = weightKg is the external load. ' +
        'bodyweight = weightKg is weight ADDED to the lifter (0 means unloaded). ' +
        'time = the set is a hold, measured by holdSeconds, with no external load.',
      volumeKg:
        'sum of load × reps across completed sets; bodyweight lifts use (body weight + added weight), timed holds contribute 0',
      note: 'free-text instructions written by the lifter',
    },
    bodyWeightKgUsedForVolume: latestBodyWeightKg() || null,
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
    medicines: {
      regimen: meds.map(m => ({
        name: m.name,
        dose: m.dose ?? null,
        form: m.form ?? null,
        frequency: scheduleLabel(m.schedule),
        takenAt: m.slot,
        note: m.note ?? null,
        startedOn: m.startedOn ?? null,
        active: m.active,
      })),
      log: medicineLog,
    },
    skincare: {
      routine: skin.map(s => ({
        product: s.brand ? `${s.brand} ${s.label}` : s.label,
        type: s.kind ?? null,
        routine: s.routine,
        step: s.order,
        frequency: scheduleLabel(s.schedule),
        note: s.note ?? null,
        active: s.active,
      })),
      log: skincareLog,
    },
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
    'date', 'session_type', 'duration_min', 'exercise', 'load_unit', 'set_number',
    'weight_kg', 'reps', 'hold_seconds', 'done', 'exercise_note', 'workout_note',
  ])]
  for (const s of sessions.filter(s => s.finishedAt !== null)) {
    const dur = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : ''
    for (const ex of s.exercises) {
      const name = exerciseName(ex)
      const unit = logUnit(ex)
      const isTime = unit === 'time'
      ex.sets.forEach((st, si) => {
        rows.push(csvRow([
          s.date, s.type, dur, name, unit, si + 1,
          isTime ? '' : st.weight,
          isTime ? '' : st.reps,
          isTime ? st.reps : '',
          st.done, ex.note ?? '', s.note ?? '',
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
  const rows = [csvRow(['night_of', 'phone_away', 'in_bed', 'awake', 'duration_h', 'quality_1_5'])]
  readDayKeys<SleepEntry>(DAY_PREFIXES.sleep).forEach(({ date, value }) => {
    rows.push(csvRow([
      date, value.phone ?? '', value.bed ?? '', value.awake ?? '',
      sleepDurationH(value) ?? '', value.quality ?? '',
    ]))
  })
  return rows.join('\n')
}

// ─── Weekly digest (plain markdown for a human or AI trainer) ────────────────

// PRs set within [startKey, endKey] — a lift's est-1RM beating its own prior
// best. A lift's first-ever appearance is a baseline, not a PR.
function weeklyPRs(all: Session[], startKey: string, endKey: string): { name: string; value: number; date: string }[] {
  const bw = latestBodyWeightKg()
  const finished = all.filter(s => s.finishedAt !== null).sort((a, b) => a.startedAt - b.startedAt)
  const best: Record<string, number> = {}
  const events: { name: string; value: number; date: string }[] = []
  for (const s of finished) {
    for (const ex of s.exercises) {
      const v = bestE1RM(ex, bw)
      if (v == null) continue
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
  L.push('# Upkeep — Weekly Digest')
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
      const top = topSet(ex)
      if (!top) continue
      L.push(`  - ${exerciseName(ex)}: ${done.length} sets, top ${formatSet(top, logUnit(ex))}${ex.note ? ` — ${ex.note}` : ''}`)
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

  // Nutrition
  const target = proteinTargetG()
  const proteinDays = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.protein, k => k.endsWith(':custom'))
    .filter(({ date }) => inWin(date))
    .map(({ date }) => proteinForDay(date, target))
  if (proteinDays.length > 0) {
    const avgG = proteinDays.reduce((a, d) => a + d.grams, 0) / proteinDays.length
    const daysHit = proteinDays.filter(d => d.grams >= target).length
    L.push(`## Nutrition — ${Math.round(avgG)} g protein/day average (target ${target} g)`)
    L.push(`- Target hit on ${daysHit} of ${proteinDays.length} logged day${proteinDays.length === 1 ? '' : 's'}`)
    L.push('')
  }

  // Sleep
  const nights = readDayKeys<SleepEntry>(DAY_PREFIXES.sleep).filter(({ date }) => inWin(date))
  const durations = nights.map(({ value }) => sleepDurationH(value)).filter((d): d is number => d != null)
  const qualities = nights.map(({ value }) => value.quality).filter((q): q is number => q != null)
  if (durations.length > 0 || qualities.length > 0) {
    const parts: string[] = []
    if (durations.length > 0) {
      const avg = durations.reduce((a, d) => a + d, 0) / durations.length
      parts.push(`${avg.toFixed(1)} h average over ${durations.length} night${durations.length === 1 ? '' : 's'}`)
    }
    if (qualities.length > 0) {
      const avgQ = qualities.reduce((a, q) => a + q, 0) / qualities.length
      parts.push(`rested ${avgQ.toFixed(1)}/5`)
    }
    L.push(`## Sleep — ${parts.join(' · ')}`)
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

  // Medicines
  const meds = (JSON.parse(localStorage.getItem(KEYS.MEDICINES) ?? '[]') as Medicine[]).filter(m => m.active)
  if (meds.length > 0) {
    const winDays = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.meds).filter(({ date }) => inWin(date))
    const checks: Record<string, Record<string, boolean>> = {}
    winDays.forEach(({ date, value }) => { checks[date] = value })
    const days: string[] = []
    for (let d = 6; d >= 0; d--) days.push(dateKey(subDays(today, d)))

    L.push('## Medicines')
    for (const m of meds) {
      const a = adherence(m.schedule, checks, m.id, days, m.startedOn)
      const label = `${m.name}${m.dose ? ` ${m.dose}` : ''} — ${scheduleLabel(m.schedule)}`
      L.push(a.expected > 0
        ? `- ${label}: ${a.taken}/${a.expected} taken`
        : `- ${label}: as needed`)
    }
    L.push('')
  }

  // Skincare
  const skin = (JSON.parse(localStorage.getItem(KEYS.SKINCARE) ?? '[]') as SkinStep[]).filter(s => s.active)
  if (skin.length > 0) {
    const winDays = readDayKeys<Record<string, boolean>>(DAY_PREFIXES.skin).filter(({ date }) => inWin(date))
    const checks: Record<string, Record<string, boolean>> = {}
    winDays.forEach(({ date, value }) => { checks[date] = value })
    const days: string[] = []
    for (let d = 6; d >= 0; d--) days.push(dateKey(subDays(today, d)))

    const totals = (['am', 'pm'] as const).map(routine => {
      const mine = skin.filter(s => s.routine === routine)
      return mine.reduce(
        (acc, s) => {
          const a = adherence(s.schedule, checks, s.id, days, s.startedOn)
          return { taken: acc.taken + a.taken, expected: acc.expected + a.expected, routine }
        },
        { taken: 0, expected: 0, routine },
      )
    }).filter(t => t.expected > 0)

    if (totals.length > 0) {
      L.push('## Skincare')
      totals.forEach(t => {
        L.push(`- ${t.routine === 'am' ? 'Morning' : 'Night'} routine: ${t.taken}/${t.expected} steps completed`)
      })
      L.push('')
    }
  }

  L.push('_Generated by Upkeep._')
  return L.join('\n')
}

export function proteinToCSV(): string {
  const labels = proteinLabelMap()
  const target = proteinTargetG()
  const rows = [csvRow(['date', 'item', 'protein_g', 'checked', 'day_total_g', 'day_target_g'])]
  readDayKeys<Record<string, boolean>>(DAY_PREFIXES.protein, k => k.endsWith(':custom')).forEach(({ date, value }) => {
    const byId = new Map(itemsForDay(date).map(it => [it.id, it]))
    const dayTotal = proteinForDay(date, target).grams
    Object.entries(value).forEach(([id, checked]) => {
      const it = byId.get(id)
      rows.push(csvRow([date, it?.label ?? labels.get(id) ?? id, it?.grams ?? 0, checked, dayTotal, target]))
    })
  })
  return rows.join('\n')
}
