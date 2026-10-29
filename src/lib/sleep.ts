import type { SleepEntry } from './types'

/**
 * Hours in bed for one night, or null when it can't be determined.
 *
 * Times are 24h floats keyed to the night you went to bed, so a wake-up after
 * midnight is stored as a small number (6.5 = 06:30) and has to be pushed into
 * the next day before subtracting.
 *
 * A non-positive result means the two times can't describe a single night,
 * for example a wake time logged in the afternoon against a 23:00 bedtime. Reporting
 * that as unknown keeps a nonsense negative out of the week chart, the CSV,
 * the JSON report and the digest average.
 */
export function sleepDurationH(e: SleepEntry): number | null {
  if (e.bed == null || e.awake == null) return null
  let a = e.awake; if (a < 12) a += 24
  let b = e.bed;   if (b < 12) b += 24
  const hours = Math.round((a - b) * 10) / 10
  return hours > 0 ? hours : null
}
