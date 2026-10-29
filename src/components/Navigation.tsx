import { NavLink } from 'react-router-dom'
import { Sun, Dumbbell, TrendingUp, CheckSquare, History, Settings } from 'lucide-react'

// Primary surfaces, shown in the mobile bottom bar (5 = clean max).
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
            <span className="font-sans text-[10px] uppercase tracking-[0.03em] font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** GitHub's mark, from Octicons (lucide has no brand icons). */
export function GitHubMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
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
          <span className="font-mono font-bold text-sm text-accent-text leading-none">UK</span>
        </div>
        <span className="font-serif text-xl text-text tracking-tight">Upkeep</span>
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

      <a
        href="https://github.com/quark-script/upkeep"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 font-mono text-[11px] text-text-dim uppercase tracking-[0.08em] hover:text-text transition-colors"
      >
        <GitHubMark size={13} /> Open source
      </a>
    </aside>
  )
}
