import { useState } from 'react'
import { Moon, Clock, Sunrise } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { sleepDurationH } from '../lib/sleep'
import { useLogDate } from '../lib/dateContext'
import { parseKey, dateKey } from '../lib/date'
import type { SleepEntry } from '../lib/types'
import { Card, PageTitle, Divider } from '../components/ui'
import { DateStrip } from '../components/DateStrip'
import { MedicinesCard } from '../components/Medicines'
import { SkincareCard } from '../components/Skincare'
import { FoodDay } from '../components/FoodDay'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(h: number | undefined | null): string {
  if (h == null) return '– : –'
  const hh = Math.floor(h) % 24
  const mm  = Math.round((h - Math.floor(h)) * 60)
  const ampm = hh < 12 ? 'AM' : 'PM'
  const disp = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${disp}:${String(mm).padStart(2, '0')} ${ampm}`
}

// 24h float (e.g. 22.5) ↔ "HH:MM" string for <input type="time">
function floatToHHMM(v: number): string {
  let hh = Math.floor(v) % 24
  let mm = Math.round((v - Math.floor(v)) * 60)
  if (mm === 60) { mm = 0; hh = (hh + 1) % 24 }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
function hhmmToFloat(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1]), mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h + mm / 60
}
function nowFloat(): number {
  const n = new Date()
  return n.getHours() + n.getMinutes() / 60
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

// ─── SleepTracker ─────────────────────────────────────────────────────────────

type SleepStage = 'phone' | 'bed' | 'awake'

const SLEEP_STAGES: { k: SleepStage; label: string }[] = [
  { k: 'phone', label: 'Phone away' },
  { k: 'bed',   label: 'In bed'     },
  { k: 'awake', label: 'Awake'      },
]

const QUALITY_LABELS = ['Wrecked', 'Rough', 'OK', 'Good', 'Fully rested']

function SleepTracker({ date, isToday, label }: { date: string; isToday: boolean; label: string }) {
  const [sleep, setSleep] = useLocalStorage<SleepEntry>(KEYS.sleepDay(date), {})
  // The night before the one being edited, where a morning wake-up belongs.
  const prevKey = dateKey(subDays(parseKey(date), 1))
  const [prevSleep, setPrevSleep] = useLocalStorage<SleepEntry>(KEYS.sleepDay(prevKey), {})

  // Week chart always reflects the real trailing 7 days.
  const today = new Date()
  const last7 = eachDayOfInterval({ start: subDays(today, 6), end: today })

  const weekData = last7.map(day => {
    const key = KEYS.sleepDay(format(day, 'yyyy-MM-dd'))
    const isTdy = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    try {
      const raw = localStorage.getItem(key)
      const entry: SleepEntry = raw ? JSON.parse(raw) : {}
      return { day, label: format(day, 'EEE').slice(0, 2), isToday: isTdy, ...entry, dur: sleepDurationH(entry) }
    } catch {
      return { day, label: format(day, 'EEE').slice(0, 2), isToday: isTdy, dur: null }
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

  const setStage = (k: SleepStage, v: number | undefined) => {
    setSleep(prev => {
      const next = { ...prev }
      if (v == null) delete next[k]
      else next[k] = v
      return next
    })
  }

  const anyLogged = sleep.phone != null || sleep.bed != null || sleep.awake != null || sleep.quality != null

  // Duration of the night being edited, shown live as the times go in.
  const thisDuration = sleepDurationH(sleep)

  // You wake up on *this* date, but the night is filed under yesterday. Rather
  // than make you go find it, offer to fill it in from here.
  //
  // Only when viewing today: the button stamps the current clock time, which is
  // meaningless against some past night and would store a negative duration.
  const needsPrevWake = isToday && prevSleep.bed != null && prevSleep.awake == null
  const morningLabel = format(subDays(parseKey(date), 0), 'EEE d MMM')

  return (
    <Card noPad>
      {/* Header */}
      <div className="px-[18px] py-4 border-b border-[var(--color-divider)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <Moon size={18} strokeWidth={1.6} className="text-text" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.12em]">Sleep cycle · this week</p>
          <p className="font-serif text-[20px] text-text font-medium tracking-[-0.03em] mt-0.5">
            Avg ·{' '}
            <span className="font-mono">{avgDur != null ? `${avgDur.toFixed(1)}h` : '–'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Target</p>
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
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.09em]">{s.label}</p>
            <p className="font-mono text-[17px] text-text font-medium tracking-[-0.02em] mt-1">
              {s.v != null ? fmtTime(s.v) : '–'}
            </p>
          </div>
        ))}
      </div>

      {/* Per-day timeline */}
      <div className="px-3.5 pt-4 pb-2">
        {/* axis labels */}
        <div className="grid mb-1.5 pl-[36px]" style={{ gridTemplateColumns: '1fr' }}>
          <div className="flex justify-between font-mono text-[10px] text-text-faint uppercase tracking-[0.06em] pr-[60px]">
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
                className={`font-mono text-[11px] uppercase tracking-[0.06em] ${d.isToday ? 'text-accent font-semibold' : 'text-text-dim'}`}
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
                {d.dur != null ? `${d.dur.toFixed(1)}h` : '–'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-[18px] pb-3 flex gap-4 font-mono text-[10px] text-text-faint uppercase tracking-[0.06em]">
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

      {/* Last night's wake-up, logged from the morning you're actually in */}
      {needsPrevWake && (
        <div className="px-[18px] py-3 bg-[var(--color-accent-soft)] border-b border-[var(--color-divider)] flex items-center gap-3">
          <Sunrise size={16} strokeWidth={1.7} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[13px] text-text font-medium">Woke up this morning?</p>
            <p className="font-sans text-[12px] text-text-dim leading-[16px] mt-0.5">
              {format(parseKey(prevKey), 'EEE')} night has a bedtime but no wake time.
            </p>
          </div>
          <button
            onClick={() => setPrevSleep(prev => ({ ...prev, awake: nowFloat() }))}
            className="shrink-0 px-3 py-2 rounded-card bg-accent text-accent-text font-mono text-[11px] font-semibold uppercase tracking-[0.06em] border-none cursor-pointer"
          >
            Log now
          </button>
        </div>
      )}

      {/* Day cycle logger: editable times, any order, log later */}
      <div className="px-[18px] py-4">
        <div className="flex justify-between items-center mb-1">
          <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.12em]">
            {isToday ? 'Tonight · cycle' : `${label} · cycle`}
          </p>
          {anyLogged && (
            <button
              onClick={() => setSleep({})}
              className="font-mono text-[10px] text-text-faint uppercase tracking-[0.06em] bg-transparent border-none cursor-pointer hover:text-warn transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="font-sans text-[11px] text-text-faint leading-[15px] mb-3">
          Night of {morningLabel}. "Awake" is the next morning.
          {thisDuration != null && (
            <span className="text-text-dim"> · <span className="font-mono">{thisDuration.toFixed(1)}h</span> in bed</span>
          )}
        </p>

        <div className="flex flex-col gap-2">
          {SLEEP_STAGES.map(s => {
            const val = sleep[s.k]
            const on = val != null
            return (
              <div
                key={s.k}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-card border transition-colors',
                  on ? 'bg-[var(--color-accent-soft)] border-accent' : 'bg-panel-inset border-[var(--color-panel-border)]',
                ].join(' ')}
              >
                <span className={`font-mono text-[11px] uppercase tracking-[0.08em] font-semibold w-[78px] shrink-0 ${on ? 'text-accent' : 'text-text-dim'}`}>
                  {s.label}
                </span>
                <input
                  type="time"
                  value={on ? floatToHHMM(val!) : ''}
                  onChange={e => {
                    const v = hhmmToFloat(e.target.value)
                    setStage(s.k, v ?? undefined)
                  }}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-[15px] text-text"
                />
                <button
                  onClick={() => setStage(s.k, nowFloat())}
                  className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim hover:text-accent bg-transparent border-none cursor-pointer shrink-0 px-1.5 py-1"
                >
                  <Clock size={11} strokeWidth={1.8} /> Now
                </button>
                {on && (
                  <button
                    onClick={() => setStage(s.k, undefined)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-panel border border-[var(--color-panel-border)] cursor-pointer shrink-0"
                    title={`Clear ${s.label}`}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="#9A968D" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Quality: the part a clock can't measure */}
        <div className="mt-3.5 pt-3.5 border-t border-[var(--color-divider)]">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.1em]">How rested</p>
            {sleep.quality != null && (
              <span className="font-sans text-[11px] text-text-dim">{QUALITY_LABELS[sleep.quality - 1]}</span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(q => {
              const on = sleep.quality === q
              return (
                <button
                  key={q}
                  aria-label={`${QUALITY_LABELS[q - 1]} (${q} of 5)`}
                  onClick={() => setSleep(prev => ({ ...prev, quality: prev.quality === q ? undefined : q }))}
                  className={[
                    'flex-1 py-2.5 rounded-card border font-mono text-[13px] font-medium cursor-pointer transition-colors',
                    on
                      ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                      : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
                  ].join(' ')}
                >
                  {q}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Section = 'food' | 'sleep' | 'meds' | 'skin'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'food',  label: 'Food' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'meds',  label: 'Meds' },
  { key: 'skin',  label: 'Skin' },
]

export default function Daily() {
  const { activeDate, isToday } = useLogDate()
  // Remembered across visits so you land where you last worked.
  const [section, setSection] = useLocalStorage<Section>(KEYS.DAILY_SECTION, 'food')
  const date = parseKey(activeDate)
  const label = isToday ? 'Today' : format(date, 'EEE · MMM d')

  return (
    <div className="pt-6 pb-8 flex flex-col gap-5">
      <PageTitle kicker={format(date, 'EEE · MMM d')} title="Daily." />
      <DateStrip />

      <div className="grid grid-cols-4 gap-1.5">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={[
              'py-2 rounded-card border font-sans text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors',
              s.key === section
                ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'food'  && <FoodDay key={`f-${activeDate}`} date={activeDate} isToday={isToday} label={label} />}
      {section === 'sleep' && <SleepTracker     key={`s-${activeDate}`} date={activeDate} isToday={isToday} label={label} />}
      {section === 'meds'  && <MedicinesCard    key={`m-${activeDate}`} date={activeDate} isToday={isToday} />}
      {section === 'skin'  && <SkincareCard     key={`k-${activeDate}`} date={activeDate} isToday={isToday} />}

      {!isToday && (
        <p className="text-center font-mono text-[11px] text-text-dim uppercase tracking-[0.14em]">
          Editing a past day
        </p>
      )}
    </div>
  )
}
