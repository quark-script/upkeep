import { Clock } from 'lucide-react'
import { useRestTimer } from '../lib/restTimer'

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// App-level so the countdown survives navigating away from the workout screen.
export function RestTimerBar() {
  const { remaining, total, stop, add } = useRestTimer()
  if (remaining == null) return null

  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0

  return (
    <div className="fixed left-0 right-0 bottom-[92px] md:bottom-6 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto relative overflow-hidden bg-panel border border-accent rounded-pill shadow-card flex items-center gap-2 pl-4 pr-2 py-1.5">
        {/* drains left-to-right as the rest runs out */}
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-accent-soft)] transition-[width] duration-200 ease-linear"
          style={{ width: `${pct * 100}%` }}
          aria-hidden
        />
        <Clock size={14} strokeWidth={1.8} className="text-accent relative" />
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-[0.1em] relative">Rest</span>
        <span className="font-mono text-[20px] text-text font-medium tabular-nums w-[52px] text-center relative">
          {fmt(remaining)}
        </span>
        <button
          onClick={() => add(-15)}
          aria-label="Cut rest by 15 seconds"
          className="font-mono text-[11px] text-text-dim px-2 py-1.5 bg-transparent border-none cursor-pointer relative"
        >−15</button>
        <button
          onClick={stop}
          className="font-mono text-[11px] text-accent-text font-semibold uppercase tracking-[0.04em] px-3 py-1.5 rounded-pill bg-accent border-none cursor-pointer relative"
        >Skip</button>
        <button
          onClick={() => add(15)}
          aria-label="Add 15 seconds of rest"
          className="font-mono text-[11px] text-text-dim px-2 py-1.5 bg-transparent border-none cursor-pointer relative"
        >+15</button>
      </div>
    </div>
  )
}
