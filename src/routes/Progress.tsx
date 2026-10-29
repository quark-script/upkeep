import { useMemo, useState } from 'react'
import { format, subDays, eachDayOfInterval, startOfWeek } from 'date-fns'
import { X, Scale } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { dateKey, parseKey } from '../lib/date'
import { calcStreak, dayTypeFor, TRAINING_DAYS_PER_WEEK } from '../lib/schedule'
import type { Session, MeasurementEntry } from '../lib/types'
import { Card, Stat, SectionLabel, PageTitle, Btn, Pill, Divider, EmptyState } from '../components/ui'
import { BodyStory, StrengthSection, MuscleBalance, NutritionSection } from '../components/Insights'

// ─── Heatmap ─────────────────────────────────────────────────────────────────

type CellState = 'hit' | 'missed' | 'rest' | 'future' | 'today'

interface HeatmapCell {
  date: Date
  state: CellState
}

function buildHeatmap(sessions: Session[]): HeatmapCell[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = subDays(today, 26 * 7 - 1)

  const sessionDates = new Set(sessions.filter(s => s.finishedAt).map(s => s.date))

  return eachDayOfInterval({ start, end: today }).map(day => {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    const isToday  = d.getTime() === today.getTime()
    const dateStr  = dateKey(d)
    const isRest   = dayTypeFor(dateStr) === 'REST'
    const isFuture = d > today

    // A logged session outranks the schedule: training on a day you'd marked
    // as rest must still show up, not vanish into a grey cell.
    let state: CellState
    if (isToday)                           state = 'today'
    else if (sessionDates.has(dateStr))    state = 'hit'
    else if (isRest)                       state = 'rest'
    else if (isFuture)                     state = 'future'
    else                                   state = 'missed'

    return { date: d, state }
  })
}

const CELL_COLOR: Record<CellState, string> = {
  hit:    '#B0413E',
  today:  '#B0413E',
  missed: 'rgba(176,65,62,0.45)',
  rest:   '#1A1A1E',
  future: '#1A1A1E',
}

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const weeks = useMemo(() => {
    const w: HeatmapCell[][] = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [cells])

  const monthLabels = useMemo(() => {
    const labels: { i: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((wk, i) => {
      const m = wk[0]?.date.getMonth() ?? -1
      if (m !== lastMonth) { labels.push({ i, label: format(wk[0].date, 'MMM') }); lastMonth = m }
    })
    return labels
  }, [weeks])

  const cols = weeks.length
  const gridCols = `14px repeat(${cols}, minmax(0, 1fr))`

  return (
    <div className="overflow-hidden w-full">
      <div className="grid gap-[3px] mb-1" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {weeks.map((_, i) => {
          const m = monthLabels.find(ml => ml.i === i)
          return (
            <div key={i} className="font-mono text-[9px] text-text-dim uppercase tracking-[0.05em] h-3">
              {m ? m.label : ''}
            </div>
          )
        })}
      </div>

      {['S','M','T','W','T','F','S'].map((d, row) => (
        <div key={row} className="grid gap-[3px] mb-[3px]" style={{ gridTemplateColumns: gridCols }}>
          <div className="font-mono text-[9px] text-text-dim flex items-center">
            {row % 2 === 1 ? d : ''}
          </div>
          {weeks.map((wk, i) => {
            const c = wk[row]
            if (!c) return <div key={i} />
            const opacity = c.state === 'hit' ? 0.55 + ((c.date.getDate() * 7 + c.date.getMonth() * 13) % 100) / 100 * 0.45 : 1
            return (
              <div
                key={i}
                className="rounded-[2px]"
                style={{
                  aspectRatio: '1 / 1',
                  background: CELL_COLOR[c.state],
                  opacity,
                  border: c.state === 'today' ? '1px solid #EDEAE3' : 'none',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── MiniChart ───────────────────────────────────────────────────────────────

function MiniChart({ data, accent }: { data: number[]; accent?: boolean }) {
  if (data.length < 2) return null
  const W = 240, H = 60, PAD = 4
  const min = Math.min(...data) - 0.5
  const max = Math.max(...data) + 0.5
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2)
    return [x, y] as [number, number]
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const areaPath = `${linePath} L${pts.at(-1)![0]},${H - PAD} L${pts[0][0]},${H - PAD} Z`
  const color = accent ? '#B0413E' : '#EDEAE3'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60, display: 'block' }}>
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3 : 1.5} fill={color} />
      ))}
    </svg>
  )
}

// ─── Log Measurements Modal ───────────────────────────────────────────────────

type MeasureForm = {
  date: string
  weight: string
  bodyFat: string
  muscleMass: string
  chest: string
  shoulder: string
  biceps: string
  waist: string
  thigh: string
  calf: string
}

function numField(label: string, unit: string, value: string, onChange: (v: string) => void) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]">{label}</label>
      <div className="flex items-center gap-1.5 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-mono text-[15px] text-text min-w-0"
          placeholder="-"
          inputMode="decimal"
        />
        <span className="font-mono text-[11px] text-text-faint uppercase shrink-0">{unit}</span>
      </div>
    </div>
  )
}

function LogModal({
  last,
  onSave,
  onClose,
}: {
  last?: MeasurementEntry
  onSave: (entry: MeasurementEntry) => void
  onClose: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState<MeasureForm>({
    date:       today,
    weight:     last?.weight.toString() ?? '',
    bodyFat:    last?.bodyFat.toString() ?? '',
    muscleMass: last?.muscleMass.toString() ?? '',
    chest:      last?.measurements.chest.toString() ?? '',
    shoulder:   last?.measurements.shoulder.toString() ?? '',
    biceps:     last?.measurements.biceps.toString() ?? '',
    waist:      last?.measurements.waist.toString() ?? '',
    thigh:      last?.measurements.thigh.toString() ?? '',
    calf:       last?.measurements.calf.toString() ?? '',
  })

  const set = (k: keyof MeasureForm) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleSave() {
    const entry: MeasurementEntry = {
      date:       form.date,
      weight:     parseFloat(form.weight) || 0,
      bodyFat:    parseFloat(form.bodyFat) || 0,
      muscleMass: parseFloat(form.muscleMass) || 0,
      bmi:        last?.bmi ?? 0,
      bmr:        last?.bmr ?? 0,
      measurements: {
        neck:           last?.measurements.neck ?? 0,
        shoulder:       parseFloat(form.shoulder) || 0,
        chest:          parseFloat(form.chest) || 0,
        biceps:         parseFloat(form.biceps) || 0,
        forearm:        last?.measurements.forearm ?? 0,
        upperAbdomen:   last?.measurements.upperAbdomen ?? 0,
        lowerAbdomen:   last?.measurements.lowerAbdomen ?? 0,
        waist:          parseFloat(form.waist) || 0,
        hips:           last?.measurements.hips ?? 0,
        thigh:          parseFloat(form.thigh) || 0,
        calf:           parseFloat(form.calf) || 0,
      },
    }
    onSave(entry)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <p className="font-serif text-[20px] font-medium text-text tracking-[-0.03em]">Log measurements</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
          >
            <X size={14} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>
        <Divider />

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date')(e.target.value)}
              className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 font-mono text-[15px] text-text outline-none"
            />
          </div>

          {/* Body metrics */}
          <div>
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-3">Body</p>
            <div className="grid grid-cols-3 gap-2.5">
              {numField('Weight',  'kg', form.weight,     set('weight'))}
              {numField('Body fat','%',  form.bodyFat,    set('bodyFat'))}
              {numField('Muscle',  'kg', form.muscleMass, set('muscleMass'))}
            </div>
          </div>

          {/* Tape */}
          <div>
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-3">Tape (inches)</p>
            <div className="grid grid-cols-3 gap-2.5">
              {numField('Chest',    '″', form.chest,    set('chest'))}
              {numField('Shoulder', '″', form.shoulder, set('shoulder'))}
              {numField('Bicep',    '″', form.biceps,   set('biceps'))}
              {numField('Waist',    '″', form.waist,    set('waist'))}
              {numField('Thigh',    '″', form.thigh,    set('thigh'))}
              {numField('Calf',     '″', form.calf,     set('calf'))}
            </div>
          </div>
        </div>

        <Divider />
        <div className="px-5 pt-4 pb-8 md:py-4 shrink-0">
          <Btn fullWidth onClick={handleSave}>Save measurements</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Progress() {
  const [sessions]     = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [measurements, setMeasurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])
  const [showLog, setShowLog] = useState(false)

  const cells   = useMemo(() => buildHeatmap(sessions), [sessions])
  const hits    = cells.filter(c => c.state === 'hit' || c.state === 'today').length
  const missed  = cells.filter(c => c.state === 'missed').length

  const today   = new Date()
  // startOfWeek handles Sunday correctly; the hand-rolled version resolved to
  // *next* Monday on Sundays and reported zero sessions for the week.
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekSessions = sessions.filter(s => s.finishedAt && parseKey(s.date) >= weekStart).length

  const monthSessions = sessions.filter(s => {
    const d = parseKey(s.date)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && s.finishedAt
  }).length

  const streak = calcStreak(sessions)
  const monthTarget = TRAINING_DAYS_PER_WEEK * 4

  const sortedMs  = [...measurements].sort((a, b) => a.date.localeCompare(b.date))
  const latestMs  = sortedMs.at(-1)
  const weightDelta = sortedMs.length > 1
    ? (sortedMs.at(-1)!.weight - sortedMs[0].weight).toFixed(1)
    : null

  const tapeMonths = sortedMs.slice(-3).map(m => format(parseKey(m.date), 'MMM'))
  const tape3      = sortedMs.slice(-3)

  const TAPE_ROWS: { label: string; key: keyof MeasurementEntry['measurements']; waist?: boolean }[] = [
    { label: 'Chest',    key: 'chest' },
    { label: 'Shoulder', key: 'shoulder' },
    { label: 'Bicep',    key: 'biceps' },
    { label: 'Waist',    key: 'waist',  waist: true },
    { label: 'Thigh',    key: 'thigh' },
    { label: 'Calf',     key: 'calf' },
  ]

  function handleSaveMeasurement(entry: MeasurementEntry) {
    setMeasurements(prev => {
      const filtered = prev.filter(m => m.date !== entry.date)
      return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  return (
    <>
      <div className="pt-6 pb-8 flex flex-col gap-5">
        <PageTitle kicker="Progress · Last 26 weeks" title="Consistency." />

        {/* ── Transformation hero ── */}
        {measurements.length > 0 && <BodyStory ms={measurements} />}

        {/* ── Strength progression + PRs ── */}
        <StrengthSection sessions={sessions} />

        <NutritionSection />

        {/* ── Where the work actually went ── */}
        <MuscleBalance sessions={sessions} />

        {/* ── Streak stats + heatmap ── */}
        <Card>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label="Streak"   value={streak}              unit="DAYS" accent />
            <Stat label="This wk"  value={`${weekSessions}/${TRAINING_DAYS_PER_WEEK}`} />
            <Stat label="This mo"  value={`${monthSessions}/${monthTarget}`}           />
          </div>

          <Heatmap cells={cells} />

          <Divider className="mt-3.5 mb-3" />
          <div className="flex gap-4 font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-accent inline-block" />
              Hit · {hits}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: 'rgba(176,65,62,0.45)' }} />
              Missed · {missed}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#1A1A1E] inline-block" />
              Rest
            </span>
          </div>
        </Card>

        {/* ── Body trends ── */}
        <div>
          <SectionLabel right={sortedMs.length > 1 ? `${format(parseKey(sortedMs[0].date), 'MMM')} → ${format(parseKey(sortedMs.at(-1)!.date), 'MMM')}` : ''}>
            Body
          </SectionLabel>
          {measurements.length === 0 ? (
            <Card>
              <EmptyState
                icon={Scale}
                title="No measurements yet."
                sub="Log your first entry to start tracking weight and body composition."
                action={<Btn onClick={() => setShowLog(true)}>+ Log measurements</Btn>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              <Card>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Weight</p>
                    <p className="font-mono text-[28px] text-text font-medium tracking-[-0.04em] mt-1">
                      {latestMs?.weight.toFixed(1) ?? '–'}
                      <span className="font-sans text-[12px] text-text-dim font-normal ml-1">KG</span>
                    </p>
                  </div>
                  {weightDelta && (
                    <Pill color={parseFloat(weightDelta) >= 0 ? 'success' : 'warn'}>
                      {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta} KG
                    </Pill>
                  )}
                </div>
                <MiniChart data={sortedMs.map(m => m.weight)} accent />
              </Card>

              <div className="grid grid-cols-2 gap-2.5">
                <Card>
                  <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Body fat</p>
                  <p className="font-mono text-[22px] text-text font-medium tracking-[-0.02em] mt-1">
                    {latestMs?.bodyFat.toFixed(1) ?? '–'}
                    <span className="font-sans text-[11px] text-text-dim font-normal ml-0.5">%</span>
                  </p>
                  <div className="mt-2">
                    <MiniChart data={sortedMs.map(m => m.bodyFat)} />
                  </div>
                </Card>
                <Card>
                  <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Muscle</p>
                  <p className="font-mono text-[22px] text-text font-medium tracking-[-0.02em] mt-1">
                    {latestMs?.muscleMass.toFixed(1) ?? '–'}
                    <span className="font-sans text-[11px] text-text-dim font-normal ml-0.5">KG</span>
                  </p>
                  <div className="mt-2">
                    <MiniChart data={sortedMs.map(m => m.muscleMass)} accent />
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* ── Tape table ── */}
        {tape3.length > 0 && (
          <div>
            <SectionLabel right={tapeMonths.join(' · ')}>Tape</SectionLabel>
            <Card noPad>
              <div
                className="grid px-3.5 py-2.5 border-b border-[var(--color-divider)] font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]"
                style={{ gridTemplateColumns: '1fr auto auto auto', columnGap: 14 }}
              >
                <span>Site</span>
                {tapeMonths.map(m => <span key={m}>{m}</span>)}
                {tapeMonths.length < 3 && Array.from({ length: 3 - tapeMonths.length }).map((_, i) => <span key={i} />)}
              </div>

              {TAPE_ROWS.map(({ label, key, waist }, i) => {
                const vals = tape3.map(m => m.measurements[key])
                const delta = vals.length > 1 ? vals.at(-1)! - vals[0] : 0
                const positive = waist ? delta < 0 : delta > 0

                return (
                  <div
                    key={key}
                    className={`grid px-3.5 py-3 items-baseline ${i < TAPE_ROWS.length - 1 ? 'border-b border-[var(--color-divider)]' : ''}`}
                    style={{ gridTemplateColumns: '1fr auto auto auto', columnGap: 14 }}
                  >
                    <span className="font-serif text-[14px] text-text font-medium">{label}</span>
                    {tape3.map((m, mi) => (
                      <span
                        key={mi}
                        className={`font-mono text-[13px] tracking-[-0.02em] ${mi === tape3.length - 1 ? (positive ? 'text-accent font-semibold' : 'text-text') : 'text-text-dim'}`}
                      >
                        {m.measurements[key]}″
                      </span>
                    ))}
                    {tape3.length < 3 && Array.from({ length: 3 - tape3.length }).map((_, j) => (
                      <span key={j} className="text-text-faint font-mono text-[13px]">-</span>
                    ))}
                  </div>
                )
              })}
            </Card>
          </div>
        )}

        <Btn fullWidth onClick={() => setShowLog(true)}>+ Log new measurements</Btn>
      </div>

      {showLog && (
        <LogModal
          last={latestMs}
          onSave={handleSaveMeasurement}
          onClose={() => setShowLog(false)}
        />
      )}
    </>
  )
}
