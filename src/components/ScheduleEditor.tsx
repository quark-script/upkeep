import { format } from 'date-fns'
import { todayKey, parseKey } from '../lib/date'
import type { Schedule } from '../lib/types'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const KINDS: { kind: Schedule['kind']; label: string }[] = [
  { kind: 'daily',    label: 'Daily' },
  { kind: 'weekly',   label: 'Weekly' },
  { kind: 'interval', label: 'Every N days' },
  { kind: 'asNeeded', label: 'As needed' },
]

const chip = (on: boolean) =>
  [
    'py-2 rounded-card border font-sans text-[11px] font-semibold uppercase tracking-[0.04em] cursor-pointer transition-colors',
    on
      ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
      : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
  ].join(' ')

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: Schedule
  onChange: (s: Schedule) => void
}) {
  const setKind = (kind: Schedule['kind']) => {
    if (kind === value.kind) return
    switch (kind) {
      case 'daily':    return onChange({ kind: 'daily' })
      case 'weekly':   return onChange({ kind: 'weekly', days: [new Date().getDay()] })
      case 'interval': return onChange({ kind: 'interval', everyDays: 2, anchor: todayKey() })
      case 'asNeeded': return onChange({ kind: 'asNeeded' })
    }
  }

  const toggleDay = (d: number) => {
    if (value.kind !== 'weekly') return
    const has = value.days.includes(d)
    const days = has ? value.days.filter(x => x !== d) : [...value.days, d]
    onChange({ kind: 'weekly', days })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Frequency</p>

      <div className="grid grid-cols-2 gap-1.5">
        {KINDS.map(k => (
          <button key={k.kind} onClick={() => setKind(k.kind)} className={`px-2 ${chip(value.kind === k.kind)}`}>
            {k.label}
          </button>
        ))}
      </div>

      {value.kind === 'weekly' && (
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              aria-label={`Toggle day ${i}`}
              className={chip(value.days.includes(i))}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {value.kind === 'interval' && (
        <div className="flex items-center gap-2.5">
          <span className="font-sans text-[13px] text-text-dim">Every</span>
          <div className="flex items-center gap-1 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5">
            <input
              value={String(value.everyDays)}
              onChange={e => {
                const n = parseInt(e.target.value, 10)
                onChange({ ...value, everyDays: isNaN(n) || n < 1 ? 1 : Math.min(n, 365) })
              }}
              inputMode="numeric"
              className="w-[42px] bg-transparent border-none outline-none font-mono text-[15px] text-text"
            />
            <span className="font-mono text-[11px] text-text-faint">DAYS</span>
          </div>
          <button
            onClick={() => onChange({ ...value, anchor: todayKey() })}
            className="font-sans text-[12px] text-text-faint flex-1 text-left bg-transparent border-none cursor-pointer hover:text-text-dim transition-colors"
          >
            from {format(parseKey(value.anchor), 'd MMM')} · tap to restart today
          </button>
        </div>
      )}
    </div>
  )
}
