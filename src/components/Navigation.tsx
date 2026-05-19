import { NavLink } from 'react-router-dom'
import { Sun, Dumbbell, TrendingUp, CheckSquare, Settings } from 'lucide-react'

const PRIMARY_TABS = [
  { to: '/today',    label: 'Today',    Icon: Sun },
  { to: '/workout',  label: 'Workout',  Icon: Dumbbell },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/daily',    label: 'Daily',    Icon: CheckSquare },
]

const ALL_TABS = [
  ...PRIMARY_TABS,
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export function BottomBar() {
  return (
    <nav className="md:hidden fixed bottom-[18px] left-3 right-3 z-50">
      <div
        className="bg-panel border border-[var(--color-panel-border)] rounded-pill
                   flex items-center justify-around px-2 py-1.5 shadow-card"
      >
        {PRIMARY_TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-0.5 px-4 py-2 rounded-pill transition-colors',
                isActive ? 'bg-accent text-accent-text' : 'text-text-dim',
              ].join(' ')
            }
          >
            <Icon size={20} strokeWidth={1.6} />
            <span className="font-sans text-[10px] uppercase tracking-[0.04em] font-semibold">{label}</span>
          </NavLink>
        ))}
        {/* Settings — icon only to save space */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-pill transition-colors',
              isActive ? 'bg-accent text-accent-text' : 'text-text-dim',
            ].join(' ')
          }
        >
          <Settings size={20} strokeWidth={1.6} />
        </NavLink>
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
        {ALL_TABS.map(({ to, label, Icon }) => (
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
