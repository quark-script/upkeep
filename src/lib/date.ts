import { format, subDays, parseISO } from 'date-fns'

// Local-timezone date key (yyyy-MM-dd). Use this everywhere instead of
// `toISOString().split('T')[0]`, which is UTC and can be off by a day.
export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function todayKey(): string {
  return dateKey(new Date())
}

// Parse a yyyy-MM-dd key back to a local Date (midnight local).
export function parseKey(k: string): Date {
  return parseISO(k)
}

// The last 7 calendar days, newest (today) first.
export function last7Days(): { key: string; date: Date }[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, i)
    return { key: dateKey(date), date }
  })
}
