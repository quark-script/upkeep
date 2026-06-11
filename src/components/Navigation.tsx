import { NavLink } from 'react-router-dom'
import { Sun, Dumbbell, TrendingUp, CheckSquare, History, Settings } from 'lucide-react'

// Primary surfaces — shown in the mobile bottom bar (5 = clean max).
const TABS = [
  { to: '/today',    label: 'Today',    Icon: Sun },
  { to: '/workout',  label: 'Workout',  Icon: Dumbbell },
  { to: '/daily',    label: 'Daily',    Icon: CheckSquare },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/history',  label: 'History',  Icon: History },
]

// Desktop sidebar also surfaces Settings (mobile reaches it via the profile avatar).
const SIDEBAR_TABS = [...TABS, { to: '/settings', label: 'Settings', Icon: Settings }]

export function BottomBar() {
  return (
    <nav className="md:hidden fixed bottom-[18px] left-3 right-3 z-40">
      <div
        className="bg-panel border border-[var(--color-panel-border)] rounded-pill
                   flex items-center justify-around px-1.5 py-1.5 shadow-card"
      >
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-pill transition-colors',
                isActive ? 'bg-accent text-accent-text' : 'text-text-dim',
              ].join(' ')
            }
          >
            <Icon size={19} strokeWidth={1.6} />
            <span className="font-sans text-[9.5px] uppercase tracking-[0.03em] font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside
      className="hidden md:flex flex-col w-60 shrink-0 h-full
                 border-r border-[var(--color-panel-border)] bg-panel px-6 py-8"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center shrink-0">
          <span className="font-mono font-bold text-sm text-accent-text leading-none">GZ</span>
        </div>
        <span className="font-serif text-xl text-text tracking-tight">GainZ</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {SIDEBAR_TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors text-sm font-medium',
                isActive
                  ? 'bg-[var(--color-accent-soft)] text-accent'
                  : 'text-text-dim hover:text-text hover:bg-panel-inset',
              ].join(' ')
            }
          >
            <Icon size={17} strokeWidth={1.6} />
            <span className="font-sans">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer hint */}
      <p className="font-mono text-[10px] text-text-faint uppercase tracking-widest">
        v0.1.0 · offline
      </p>
    </aside>
  )
}
