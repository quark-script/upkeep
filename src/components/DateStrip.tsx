import { format } from 'date-fns'
import { useLogDate } from '../lib/dateContext'
import { last7Days } from '../lib/date'

// Horizontal strip of the last 7 days (Today on the left → 6 days ago).
// Selecting a day scopes the logging screen to that date.
export function DateStrip() {
  const { activeDate, setActiveDate } = useLogDate()
  const days = last7Days()

  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none">
      {days.map(({ key, date }, i) => {
        const active = key === activeDate
        const top = i === 0 ? 'Today' : i === 1 ? 'Yest' : format(date, 'EEE')
        return (
          <button
            key={key}
            onClick={() => setActiveDate(key)}
            className={[
              'shrink-0 flex flex-col items-center justify-center min-w-[52px] px-3 py-2 rounded-card border transition-colors cursor-pointer',
              active
                ? 'bg-[var(--color-accent-soft)] border-accent'
                : 'bg-panel-inset border-[var(--color-panel-border)]',
            ].join(' ')}
          >
            <span
              className={`font-sans text-[10px] uppercase tracking-[0.06em] font-semibold ${active ? 'text-accent' : 'text-text-dim'}`}
            >
              {top}
            </span>
            <span
              className={`font-mono text-[15px] font-medium tracking-[-0.02em] mt-0.5 ${active ? 'text-text' : 'text-text-faint'}`}
            >
              {format(date, 'd')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
