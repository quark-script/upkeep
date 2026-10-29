import React from 'react'
import type { LucideIcon } from 'lucide-react'

// ─── Card ──────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  accentBorder?: boolean
  warnBorder?: boolean
  noPad?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', accentBorder, warnBorder, noPad, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-panel rounded-card-lg shadow-card',
        'border border-[var(--color-panel-border)]',
        noPad ? '' : 'p-4',
        accentBorder ? 'border-l-[3px] border-l-accent' : '',
        warnBorder   ? 'border-l-[3px] border-l-warn'   : '',
        onClick      ? 'cursor-pointer'                   : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}

// ─── Pill ──────────────────────────────────────────────────────────────────
// Matches prototype: outlined/ghost by default, accentSoft fill for accent variant

type PillColor = 'accent' | 'success' | 'warn' | 'danger' | 'dim' | 'push' | 'pull' | 'legs'

const PILL_COLORS: Record<PillColor, string> = {
  dim:     'bg-transparent border-[var(--color-panel-border)] text-text-dim',
  accent:  'bg-[var(--color-accent-soft)] border-accent text-accent',
  success: 'bg-transparent border-success text-success',
  warn:    'bg-transparent border-warn text-warn',
  danger:  'bg-transparent border-danger text-danger',
  push:    'bg-transparent border-accent/40 text-accent',
  pull:    'bg-transparent border-success/40 text-success',
  legs:    'bg-transparent border-warn/40 text-warn',
}

interface PillProps {
  children: React.ReactNode
  color?: PillColor
  className?: string
}

export function Pill({ children, color = 'dim', className = '' }: PillProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-[3px] rounded-pill border font-mono text-[10px] uppercase tracking-[0.04em] font-medium ${PILL_COLORS[color]} ${className}`}
    >
      {children}
    </span>
  )
}

// ─── Btn ───────────────────────────────────────────────────────────────────

interface BtnProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

export function Btn({ children, variant = 'primary', onClick, disabled, className = '', type = 'button', fullWidth }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-card',
        'font-sans font-semibold text-[13px] uppercase tracking-[0.04em]',
        'transition-all active:scale-[0.98]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-accent text-accent-text border-none'
          : 'bg-transparent text-text border border-[var(--color-panel-border)]',
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Stat ──────────────────────────────────────────────────────────────────
// Matches prototype: fontSans label (10px textDim), numericFont value (30px), fontSans unit (11px)

interface StatProps {
  label: string
  value: string | number
  unit?: string
  accent?: boolean
}

export function Stat({ label, value, unit, accent }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-text-dim">
        {label}
      </span>
      <span className={`font-mono text-[30px] leading-[32px] font-medium tracking-[-0.04em] flex items-baseline gap-1 ${accent ? 'text-accent' : 'text-text'}`}>
        {value}
        {unit && (
          <span className="font-sans text-[11px] font-normal uppercase tracking-[0.04em] text-text-dim">
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

// ─── PageTitle ─────────────────────────────────────────────────────────────
// Matches prototype: mono kicker 11px textDim, serif title 32px/36px

interface PageTitleProps {
  kicker: string
  title: string
  className?: string
}

export function PageTitle({ kicker, title, className = '' }: PageTitleProps) {
  return (
    <div className={`pb-4 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim mb-1.5">
        {kicker}
      </p>
      <h1 className="font-serif text-[32px] leading-[36px] font-medium text-text tracking-[-0.04em]">
        {title}
      </h1>
    </div>
  )
}

// ─── SectionLabel ──────────────────────────────────────────────────────────
// Matches prototype: fontSans 11px textDim uppercase letterSpacing 1.2, optional right label

interface SectionLabelProps {
  children: React.ReactNode
  right?: string
  className?: string
}

export function SectionLabel({ children, right, className = '' }: SectionLabelProps) {
  return (
    <div className={`flex items-baseline justify-between px-1 mb-2.5 ${className}`}>
      <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium">
        {children}
      </span>
      {right && (
        <span className="font-mono text-[11px] text-text-dim tracking-[0.04em]">
          {right}
        </span>
      )}
    </div>
  )
}

// ─── Eyebrow ───────────────────────────────────────────────────────────────

export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim ${className}`}>
      {children}
    </p>
  )
}

// ─── Divider ───────────────────────────────────────────────────────────────

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-[var(--color-divider)] ${className}`} />
}

// ─── Ico ───────────────────────────────────────────────────────────────────

interface IcoProps {
  icon: LucideIcon
  size?: number
  className?: string
}

export function Ico({ icon: Icon, size = 18, className = '' }: IcoProps) {
  return <Icon size={size} strokeWidth={1.6} className={className} />
}

// ─── EmptyState ────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  sub: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, sub, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-12 h-12 rounded-[14px] bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center mb-4">
        <Icon size={20} strokeWidth={1.5} className="text-text-faint" />
      </div>
      <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em] mb-1">{title}</p>
      <p className="font-sans text-[13px] text-text-dim leading-[19px] max-w-[240px]">{sub}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
