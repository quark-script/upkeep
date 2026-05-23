import { useState, useRef, useEffect } from 'react'
import { Plus, Moon } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { PROTEIN_ITEMS } from '../lib/data'
import type { ProteinItem, SleepEntry } from '../lib/types'
import { Card, PageTitle, Divider } from '../components/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(h: number | undefined | null): string {
  if (h == null) return '— : —'
  const hh = Math.floor(h) % 24
  const mm  = Math.round((h - Math.floor(h)) * 60)
  const ampm = hh < 12 ? 'AM' : 'PM'
  const disp = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${disp}:${String(mm).padStart(2, '0')} ${ampm}`
}

// Map a time-float to % within the sleep window (21.5h–32.5h)
const WIN_START = 21.5
const WIN_END   = 32.5
function toX(h: number | undefined | null): number | null {
  if (h == null) return null
  let v = h
  if (v < 12) v += 24  // awake times cross midnight
  return Math.max(0, Math.min(100, ((v - WIN_START) / (WIN_END - WIN_START)) * 100))
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ value, total, size = 76, stroke = 5 }: {
  value: number; total: number; size?: number; stroke?: number
}) {
  const r  = (size - stroke) / 2
  const c  = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1A1A1E" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#B0413E" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize={size * 0.3}
        fontWeight="500" fill="#EDEAE3"
      >
        {value}
        <tspan fontSize={size * 0.18} fill="#9A968D">/{total}</tspan>
      </text>
    </svg>
  )
}

// ─── ProteinChecklist ─────────────────────────────────────────────────────────

function ProteinChecklist({ todayKey }: { todayKey: string }) {
  const [checked, setChecked] = useLocalStorage<Record<string, boolean>>(todayKey, {})
  const [customItems, setCustomItems] = useLocalStorage<ProteinItem[]>(KEYS.PROTEIN_CUSTOM, [])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const allItems = [...PROTEIN_ITEMS, ...customItems]
  const total   = allItems.length
  const done    = allItems.filter(it => checked[it.id]).length

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  const addCustom = () => {
    const label = draft.trim()
    if (!label) { setAdding(false); return }
    const id = `c_${Date.now()}`
    setCustomItems(prev => [...prev, { id, label, custom: true }])
    setChecked(prev => ({ ...prev, [id]: true }))
    setDraft('')
    setAdding(false)
  }

  // Weekly adherence (last 7 days) — rough estimate from what we have
  const adherenceLabel = total > 0 ? `${Math.round((done / total) * 100)}% today` : '–'

  return (
    <Card noPad>
      {/* Header */}
      <div className="px-[18px] pt-[18px] pb-3.5 flex items-center gap-4 border-b border-[var(--color-divider)]">
        <ProgressRing value={done} total={total} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Protein today</p>
            {done > 0 && (
              <button
                onClick={() => setChecked({})}
                className="bg-transparent border-none font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] cursor-pointer hover:text-danger transition-colors p-0"
              >
                Reset
              </button>
            )}
          </div>
          <p className="font-serif text-[24px] text-text font-medium tracking-[-0.03em] mt-1">
            {done === total && total > 0 ? 'All hit.' : `${total - done} to go.`}
          </p>
          <p className="font-sans text-[12px] text-text-dim mt-1">
            Today · <span className="text-text">{adherenceLabel}</span>
          </p>
        </div>
      </div>

      {/* Items */}
      {allItems.map((it, i) => {
        const on = !!checked[it.id]
        const isLast = i === allItems.length - 1 && !adding
        return (
          <button
            key={it.id}
            onClick={() => toggle(it.id)}
            className={[
              'w-full flex items-center gap-3.5 px-[18px] py-3.5 text-left border-none cursor-pointer transition-colors',
              on ? 'bg-[var(--color-accent-soft)]' : 'bg-transparent',
              !isLast ? 'border-b border-[var(--color-divider)]' : '',
            ].join(' ')}
          >
            <div
              className={[
                'w-[22px] h-[22px] rounded-card flex items-center justify-center shrink-0 transition-colors',
                on ? 'bg-accent' : 'bg-transparent border border-[var(--color-panel-border)]',
              ].join(' ')}
            >
              {on && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#EDEAE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span
                className={`font-sans text-[14px] font-medium transition-colors ${on ? 'text-text-dim line-through decoration-text-faint' : 'text-text'}`}
              >
                {it.label}
              </span>
              {it.custom && (
                <span className="font-mono text-[9px] text-text-dim uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-pill border border-[var(--color-panel-border)] shrink-0">
                  custom
                </span>
              )}
            </div>
            {it.time && (
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em] shrink-0">
                {it.time}
              </span>
            )}
          </button>
        )
      })}

      {/* Add custom */}
      {adding ? (
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-panel-inset border-t border-[var(--color-divider)]">
          <div className="w-[22px] h-[22px] rounded-card border border-dashed border-[var(--color-panel-border)] shrink-0" />
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addCustom()
              if (e.key === 'Escape') { setDraft(''); setAdding(false) }
            }}
            placeholder="e.g. Greek yogurt · 200g"
            className="flex-1 bg-transparent border-none outline-none font-sans text-[14px] text-text py-1.5"
          />
          <button
            onClick={() => { setDraft(''); setAdding(false) }}
            className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] bg-transparent border-none cursor-pointer px-2 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={addCustom}
            className="font-mono text-[10px] text-accent-text uppercase tracking-[0.08em] font-semibold bg-accent border-none rounded-card cursor-pointer px-3 py-2"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 px-[18px] bg-transparent border-none border-t border-dashed border-[var(--color-divider)] flex items-center justify-center gap-2 text-text-dim font-sans text-[12px] uppercase tracking-[0.08em] font-medium cursor-pointer"
        >
          <Plus size={12} strokeWidth={1.8} /> Add custom item
        </button>
      )}
    </Card>
  )
}

// ─── SleepTracker ─────────────────────────────────────────────────────────────

type SleepStage = 'phone' | 'bed' | 'awake'

function SleepTracker({ todayKey }: { todayKey: string }) {
  const [todaySleep, setTodaySleep] = useLocalStorage<SleepEntry>(todayKey, {})

  // Load last 7 days of sleep data
  const today = new Date()
  const last7 = eachDayOfInterval({ start: subDays(today, 6), end: today })

  // We read each day's sleep from localStorage directly (one-time read)
  const weekData = last7.map(day => {
    const key = KEYS.sleepDay(format(day, 'yyyy-MM-dd'))
    const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    try {
      const raw = localStorage.getItem(key)
      const entry: SleepEntry = raw ? JSON.parse(raw) : {}
      const dur = entry.bed != null && entry.awake != null
        ? (() => {
            let a = entry.awake!
            if (a < 12) a += 24
            let b = entry.bed!
            if (b < 12) b += 24
            return Math.round((a - b) * 10) / 10
          })()
        : null
      return { day, label: format(day, 'EEE').slice(0, 2), isToday, ...entry, dur }
    } catch {
      return { day, label: format(day, 'EEE').slice(0, 2), isToday, dur: null }
    }
  })

  const complete = weekData.filter(d => d.bed != null && d.awake != null)
  const avg = (k: SleepStage) =>
    complete.length > 0
      ? complete.reduce((a, d) => a + ((d as Record<string, unknown>)[k] as number ?? 0), 0) / complete.length
      : null
  const avgPhone = avg('phone')
  const avgBed   = avg('bed')
  const avgAwake = avg('awake')
  const avgDur   = complete.length > 0
    ? complete.reduce((a, d) => a + (d.dur ?? 0), 0) / complete.length
    : null

  // Tonight logger stage
  const stage: SleepStage | 'done' | null =
    todaySleep.awake != null ? 'done' :
    todaySleep.bed   != null ? 'awake' :
    todaySleep.phone != null ? 'bed'   : 'phone'

  const logNext = () => {
    const now = new Date()
    const h = now.getHours() + now.getMinutes() / 60
    if (stage === 'phone') setTodaySleep(prev => ({ ...prev, phone: h }))
    else if (stage === 'bed') setTodaySleep(prev => ({ ...prev, bed: h }))
    else if (stage === 'awake') setTodaySleep(prev => ({ ...prev, awake: h }))
  }

  const stageLabel =
    stage === 'phone' ? 'Log phone away' :
    stage === 'bed'   ? 'Log in bed'     :
    stage === 'awake' ? 'Log awake'      : '✓ Cycle complete'

  return (
    <Card noPad>
      {/* Header */}
      <div className="px-[18px] py-4 border-b border-[var(--color-divider)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <Moon size={18} strokeWidth={1.6} className="text-text" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Sleep cycle · this week</p>
          <p className="font-serif text-[20px] text-text font-medium tracking-[-0.03em] mt-0.5">
            Avg ·{' '}
            <span className="font-mono">{avgDur != null ? `${avgDur.toFixed(1)}h` : '—'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.12em]">Target</p>
          <p className="font-mono text-[14px] text-accent font-semibold">10:30 PM</p>
        </div>
      </div>

      {/* Averages strip */}
      <div className="grid grid-cols-3 border-b border-[var(--color-divider)]">
        {([
          { label: 'Phone away', v: avgPhone },
          { label: 'In bed',     v: avgBed   },
          { label: 'Awake',      v: avgAwake },
        ] as { label: string; v: number | null }[]).map((s, i) => (
          <div
            key={s.label}
            className={`px-3.5 py-3 ${i > 0 ? 'border-l border-[var(--color-divider)]' : ''}`}
          >
            <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.09em]">{s.label}</p>
            <p className="font-mono text-[17px] text-text font-medium tracking-[-0.02em] mt-1">
              {s.v != null ? fmtTime(s.v) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Per-day timeline */}
      <div className="px-3.5 pt-4 pb-2">
        {/* axis labels */}
        <div className="grid mb-1.5 pl-[36px]" style={{ gridTemplateColumns: '1fr' }}>
          <div className="flex justify-between font-mono text-[9px] text-text-faint uppercase tracking-[0.06em] pr-[60px]">
            <span>10P</span><span>12A</span><span>2A</span><span>4A</span><span>6A</span><span>8A</span>
          </div>
        </div>

        {weekData.map((d, i) => {
          const px = toX(d.phone as number | null)
          const bx = toX(d.bed   as number | null)
          const ax = toX(d.awake as number | null)
          const bedH: number | undefined = d.bed as number | undefined
          const barColor =
            bedH == null     ? 'transparent' :
            bedH < 22.75     ? '#9CB084' :   // success
            bedH < 23.5      ? '#D5A45F' :   // warn
                               '#B0413E'     // danger

          return (
            <div
              key={i}
              className="grid items-center gap-2 py-1.5"
              style={{ gridTemplateColumns: '28px 1fr 52px' }}
            >
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.06em] ${d.isToday ? 'text-accent font-semibold' : 'text-text-dim'}`}
              >
                {d.label}
              </span>

              {/* track */}
              <div className="relative h-[18px]">
                {/* base track */}
                <div className="absolute left-0 right-0 top-[7px] h-[3px] rounded-pill bg-panel-inset" />

                {/* asleep bar (bed → awake) */}
                {bx != null && ax != null && (
                  <div
                    className="absolute top-[5px] h-[7px] rounded-pill"
                    style={{ left: `${bx}%`, width: `${ax - bx}%`, background: barColor, opacity: 0.85 }}
                  />
                )}

                {/* phone marker (vertical tick) */}
                {px != null && (
                  <div
                    className="absolute top-[2px] w-[2px] h-[14px] bg-text-dim"
                    style={{ left: `${px}%`, transform: 'translateX(-1px)' }}
                  />
                )}

                {/* bed marker (white dot) */}
                {bx != null && (
                  <div
                    className="absolute top-0 flex items-center justify-center h-[18px]"
                    style={{ left: `${bx}%`, width: 8, transform: 'translateX(-4px)' }}
                  >
                    <div className="w-2 h-2 rounded-pill bg-text" />
                  </div>
                )}

                {/* awake marker (accent dot) */}
                {ax != null && (
                  <div
                    className="absolute top-0 flex items-center justify-center h-[18px]"
                    style={{ left: `${ax}%`, width: 10, transform: 'translateX(-5px)' }}
                  >
                    <div className="w-2.5 h-2.5 rounded-pill bg-accent ring-2 ring-bg" />
                  </div>
                )}

                {/* target line 10:30 PM */}
                <div
                  className="absolute top-[-2px] bottom-[-2px] w-px bg-accent opacity-20"
                  style={{ left: `${toX(22.5)!}%` }}
                />
              </div>

              <div className="font-mono text-[11px] text-text-dim tracking-[-0.01em] text-right">
                {d.dur != null ? `${d.dur.toFixed(1)}h` : '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-[18px] pb-3 flex gap-4 font-mono text-[9px] text-text-faint uppercase tracking-[0.06em]">
        <span className="flex items-center gap-1.5">
          <span className="w-[2px] h-3 bg-text-dim inline-block" />Phone away
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-pill bg-text inline-block" />In bed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-pill bg-accent inline-block" />Awake
        </span>
      </div>

      <Divider />

      {/* Tonight cycle logger */}
      <div className="px-[18px] py-4">
        <div className="flex justify-between items-center mb-3">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Tonight · cycle</p>
          {todaySleep.phone != null && (
            <button
              onClick={() => setTodaySleep({})}
              className="font-mono text-[9px] text-text-faint uppercase tracking-[0.06em] bg-transparent border-none cursor-pointer hover:text-warn transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {([
            { k: 'phone' as SleepStage, label: 'Phone away', val: todaySleep.phone },
            { k: 'bed'   as SleepStage, label: 'In bed',     val: todaySleep.bed   },
            { k: 'awake' as SleepStage, label: 'Awake',      val: todaySleep.awake },
          ]).map(s => {
            const on = s.val != null
            return (
              <div
                key={s.k}
                className={[
                  'relative px-2.5 py-2.5 rounded-card border transition-colors',
                  on ? 'bg-[var(--color-accent-soft)] border-accent' : 'bg-panel-inset border-[var(--color-panel-border)]',
                ].join(' ')}
              >
                {on && (
                  <button
                    onClick={() => {
                      // clear this stage and all later ones
                      const cleared: SleepEntry = { ...todaySleep }
                      if (s.k === 'phone') { delete cleared.phone; delete cleared.bed; delete cleared.awake }
                      if (s.k === 'bed')   { delete cleared.bed;   delete cleared.awake }
                      if (s.k === 'awake') { delete cleared.awake }
                      setTodaySleep(cleared)
                    }}
                    className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-panel border border-[var(--color-panel-border)] cursor-pointer"
                    title={`Reset ${s.label}`}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-text-faint" />
                    </svg>
                  </button>
                )}
                <p className={`font-mono text-[9px] uppercase tracking-[0.08em] font-semibold ${on ? 'text-accent' : 'text-text-dim'}`}>
                  {s.label}
                </p>
                <p className={`font-mono text-[15px] font-medium tracking-[-0.02em] mt-1 ${on ? 'text-text' : 'text-text-faint'}`}>
                  {s.val != null ? fmtTime(s.val) : '— : —'}
                </p>
              </div>
            )
          })}
        </div>

        <button
          onClick={logNext}
          disabled={stage === 'done'}
          className={[
            'w-full py-3.5 rounded-card border-none font-sans text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer flex items-center justify-center',
            stage === 'done'
              ? 'bg-transparent border border-[var(--color-panel-border)] text-text-dim cursor-default'
              : 'bg-accent text-accent-text',
          ].join(' ')}
        >
          {stageLabel}
        </button>
      </div>
    </Card>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Daily() {
  const today    = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  return (
    <div className="pt-6 pb-8 flex flex-col gap-5">
      <PageTitle kicker={format(today, 'EEE · MMM d')} title="Daily." />
      <ProteinChecklist todayKey={KEYS.proteinDay(todayStr)} />
      <SleepTracker todayKey={KEYS.sleepDay(todayStr)} />
      <p className="text-center font-mono text-[11px] text-text-faint uppercase tracking-[0.14em]">
        Resets at midnight · local time
      </p>
    </div>
  )
}
