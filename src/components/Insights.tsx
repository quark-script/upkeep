import { format, startOfWeek } from 'date-fns'
import { Trophy, Activity } from 'lucide-react'
import { EXERCISES, COMPOUND_IDS, MUSCLE_LABELS } from '../lib/data'
import { parseKey } from '../lib/date'
import { bestE1RM, latestBodyWeightKg, logUnit, setVolume } from '../lib/stats'
import type { Session, MeasurementEntry, ExerciseLog, MuscleGroup } from '../lib/types'
import { Card, SectionLabel, Pill, Divider } from './ui'

// ─── Shared ───────────────────────────────────────────────────────────────────

const NAME_BY_ID = new Map(EXERCISES.map(e => [e.id, e.name]))
function exName(log: ExerciseLog): string {
  return log.name ?? NAME_BY_ID.get(log.exerciseId) ?? log.exerciseId
}

function Spark({ data, color = '#B0413E' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-[34px]" />
  const W = 200, H = 34, PAD = 3
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (v - min) / span) * (H - PAD * 2)
    return [x, y] as [number, number]
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 34, display: 'block' }}>
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2.5} fill={color} />
    </svg>
  )
}

// ─── Body transformation story ──────────────────────────────────────────────────

type PartKey = keyof MeasurementEntry['measurements']
const PARTS: { key: PartKey; label: string; waist?: boolean }[] = [
  { key: 'chest',    label: 'Chest' },
  { key: 'shoulder', label: 'Shoulders' },
  { key: 'biceps',   label: 'Arms' },
  { key: 'waist',    label: 'Waist', waist: true },
  { key: 'thigh',    label: 'Legs' },
  { key: 'calf',     label: 'Calves' },
]

// Fill style for a silhouette region given its change since baseline.
function regionStyle(delta: number | null, waist = false): { fill: string; opacity: number } {
  if (delta == null || Math.abs(delta) < 0.05) return { fill: '#26262b', opacity: 1 }
  const good = waist ? delta < 0 : delta > 0
  const mag = Math.min(Math.abs(delta) / 2.5, 1)   // ~2.5" change = full intensity
  const color = waist ? (good ? '#9CB084' : '#D5A45F') : (good ? '#B0413E' : '#D5A45F')
  return { fill: color, opacity: 0.3 + mag * 0.7 }
}

function deltaText(delta: number | null, waist = false): { text: string; cls: string } {
  if (delta == null) return { text: '—', cls: 'text-text-faint' }
  const good = waist ? delta < 0 : delta > 0
  const sign = delta > 0 ? '+' : ''
  const cls = Math.abs(delta) < 0.05 ? 'text-text-dim' : good ? 'text-accent' : 'text-warn'
  return { text: `${sign}${delta.toFixed(1)}″`, cls }
}

export function BodyStory({ ms }: { ms: MeasurementEntry[] }) {
  const sorted = [...ms].sort((a, b) => a.date.localeCompare(b.date))
  const base = sorted[0]
  const latest = sorted.at(-1)!
  const has2 = sorted.length > 1

  const delta = (k: PartKey): number | null =>
    has2 ? latest.measurements[k] - base.measurements[k] : null

  const weeks = has2
    ? Math.max(1, Math.round((parseKey(latest.date).getTime() - parseKey(base.date).getTime()) / (7 * 864e5)))
    : 0
  const muscleD = has2 ? latest.muscleMass - base.muscleMass : null
  const fatD = has2 ? latest.bodyFat - base.bodyFat : null

  const sty = {
    shoulder: regionStyle(delta('shoulder')),
    chest:    regionStyle(delta('chest')),
    biceps:   regionStyle(delta('biceps')),
    waist:    regionStyle(delta('waist'), true),
    thigh:    regionStyle(delta('thigh')),
    calf:     regionStyle(delta('calf')),
  }
  const stroke = 'rgba(255,255,255,0.10)'

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Your transformation</p>
          <p className="font-serif text-[22px] text-text font-medium tracking-[-0.03em] mt-0.5">
            {has2 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} in.` : 'Your starting point.'}
          </p>
        </div>
        {has2 && (
          <div className="text-right font-mono text-[11px] leading-[16px]">
            {muscleD != null && (
              <p className={muscleD >= 0 ? 'text-accent' : 'text-warn'}>
                ▲ {muscleD >= 0 ? '+' : ''}{muscleD.toFixed(1)}kg muscle
              </p>
            )}
            {fatD != null && (
              <p className={fatD <= 0 ? 'text-success' : 'text-warn'}>
                ▼ {fatD > 0 ? '+' : ''}{fatD.toFixed(1)}% fat
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4 items-center">
        {/* Silhouette */}
        <svg viewBox="0 0 120 240" style={{ width: 104, height: 208, flexShrink: 0 }}>
          <g stroke={stroke} strokeWidth={1}>
            {/* head + neck (neutral) */}
            <circle cx="60" cy="20" r="12" fill="#26262b" />
            <rect x="55" y="30" width="10" height="9" rx="2" fill="#26262b" />
            {/* shoulders */}
            <rect x="30" y="38" width="60" height="15" rx="7" fill={sty.shoulder.fill} fillOpacity={sty.shoulder.opacity} />
            {/* arms (biceps) */}
            <rect x="21" y="52" width="12" height="50" rx="6" fill={sty.biceps.fill} fillOpacity={sty.biceps.opacity} />
            <rect x="87" y="52" width="12" height="50" rx="6" fill={sty.biceps.fill} fillOpacity={sty.biceps.opacity} />
            {/* chest */}
            <rect x="40" y="51" width="40" height="34" rx="5" fill={sty.chest.fill} fillOpacity={sty.chest.opacity} />
            {/* waist / core */}
            <rect x="44" y="85" width="32" height="24" rx="3" fill={sty.waist.fill} fillOpacity={sty.waist.opacity} />
            {/* hips (neutral) */}
            <rect x="42" y="109" width="36" height="14" rx="4" fill="#26262b" />
            {/* thighs (legs) */}
            <rect x="43" y="123" width="15" height="48" rx="6" fill={sty.thigh.fill} fillOpacity={sty.thigh.opacity} />
            <rect x="62" y="123" width="15" height="48" rx="6" fill={sty.thigh.fill} fillOpacity={sty.thigh.opacity} />
            {/* calves */}
            <rect x="45" y="172" width="12" height="46" rx="5" fill={sty.calf.fill} fillOpacity={sty.calf.opacity} />
            <rect x="63" y="172" width="12" height="46" rx="5" fill={sty.calf.fill} fillOpacity={sty.calf.opacity} />
          </g>
        </svg>

        {/* Per-part stats */}
        <div className="flex-1 flex flex-col gap-2">
          {PARTS.map(p => {
            const d = delta(p.key)
            const dt = deltaText(d, p.waist)
            const mag = d == null ? 0 : Math.min(Math.abs(d) / 2.5, 1)
            const good = d != null && (p.waist ? d < 0 : d > 0)
            return (
              <div key={p.key} className="flex items-center gap-2.5">
                <span className="font-sans text-[12px] text-text-dim w-[64px] shrink-0">{p.label}</span>
                <div className="flex-1 h-[6px] rounded-pill bg-panel-inset overflow-hidden">
                  <div
                    className="h-full rounded-pill"
                    style={{ width: `${mag * 100}%`, background: good ? (p.waist ? '#9CB084' : '#B0413E') : '#D5A45F' }}
                  />
                </div>
                <span className={`font-mono text-[12px] tracking-[-0.01em] w-[44px] text-right shrink-0 ${dt.cls}`}>
                  {dt.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {!has2 && (
        <p className="font-sans text-[12px] text-text-dim text-center mt-3.5 leading-[18px]">
          Log measurements again in a few weeks — your silhouette fills in as each area grows.
        </p>
      )}
    </Card>
  )
}

// ─── Strength progression + PR timeline ─────────────────────────────────────────

function topE1RM(s: Session, exId: string, bw: number): number | null {
  const ex = s.exercises.find(e => e.exerciseId === exId)
  return ex ? bestE1RM(ex, bw) : null
}

interface PREvent { date: string; name: string; value: number }

function prTimeline(sessions: Session[], bw: number): PREvent[] {
  const finished = sessions.filter(s => s.finishedAt).sort((a, b) => a.startedAt - b.startedAt)
  const best: Record<string, number> = {}
  const events: PREvent[] = []
  for (const s of finished) {
    for (const ex of s.exercises) {
      const v = bestE1RM(ex, bw)
      if (v == null) continue
      const prev = best[ex.exerciseId]
      if (prev == null) { best[ex.exerciseId] = v; continue }   // first time isn't a PR
      if (v > prev + 0.5) {
        best[ex.exerciseId] = v
        events.push({ date: s.date, name: exName(ex), value: v })
      }
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
}

export function StrengthSection({ sessions }: { sessions: Session[] }) {
  const finished = sessions.filter(s => s.finishedAt).sort((a, b) => a.startedAt - b.startedAt)
  const bw = latestBodyWeightKg()

  const lifts = [...COMPOUND_IDS]
    .map(id => {
      const series = finished
        .map(s => topE1RM(s, id, bw))
        .filter((v): v is number => v != null)
      return { id, name: NAME_BY_ID.get(id) ?? id, series }
    })
    .filter(l => l.series.length > 0)

  const prs = prTimeline(sessions, bw)

  if (lifts.length === 0 && prs.length === 0) return null

  return (
    <>
      {lifts.length > 0 && (
        <div>
          <SectionLabel right="EST. 1RM · KG">Strength</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {lifts.map(l => {
              const cur = l.series.at(-1)!
              const delta = l.series.length > 1 ? cur - l.series[0] : 0
              return (
                <Card key={l.id}>
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <p className="font-serif text-[14px] text-text font-medium leading-[17px]">{l.name}</p>
                    {delta > 0.5 && <Pill color="accent">+{Math.round(delta)}</Pill>}
                  </div>
                  <p className="font-mono text-[22px] text-text font-medium tracking-[-0.03em]">
                    {Math.round(cur)}<span className="font-sans text-[11px] text-text-dim font-normal ml-0.5">KG</span>
                  </p>
                  <div className="mt-2">
                    <Spark data={l.series.map(v => Math.round(v))} />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {prs.length > 0 && (
        <div>
          <SectionLabel right={`${prs.length} RECENT`}>PR timeline</SectionLabel>
          <Card noPad>
            {prs.map((pr, i) => (
              <div key={`${pr.date}-${pr.name}-${i}`}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-card bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                    <Trophy size={13} strokeWidth={1.7} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13px] text-text font-medium truncate">{pr.name}</p>
                    <p className="font-mono text-[10px] text-text-dim tracking-[0.03em] mt-0.5">
                      {format(parseKey(pr.date), 'EEE d MMM')}
                    </p>
                  </div>
                  <span className="font-mono text-[15px] text-accent font-semibold tracking-[-0.02em] shrink-0">
                    {Math.round(pr.value)} <span className="text-text-dim font-normal text-[11px]">kg</span>
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {lifts.length === 0 && prs.length === 0 && (
        <Card>
          <div className="flex items-center gap-2 text-text-dim">
            <Activity size={15} strokeWidth={1.7} />
            <span className="font-sans text-[13px]">Log a few workouts to see strength trends.</span>
          </div>
        </Card>
      )}
    </>
  )
}

// ─── Muscle-group balance ───────────────────────────────────────────────────────

const GROUP_BY_ID = new Map<string, MuscleGroup[]>(
  EXERCISES.filter(e => e.groups?.length).map(e => [e.id, e.groups!]),
)

const GROUP_ORDER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core']

const BALANCE_WEEKS = 4

// Where the work actually went over the last few weeks. Catches the classic
// drift — chest and arms every session, legs and core quietly skipped.
export function MuscleBalance({ sessions }: { sessions: Session[] }) {
  const bw = latestBodyWeightKg()
  const start = startOfWeek(new Date(), { weekStartsOn: 1 })
  start.setDate(start.getDate() - 7 * (BALANCE_WEEKS - 1))

  const totals = new Map<MuscleGroup, { volume: number; sets: number }>(
    GROUP_ORDER.map(g => [g, { volume: 0, sets: 0 }]),
  )
  let anyWork = false

  for (const s of sessions) {
    if (!s.finishedAt || parseKey(s.date) < start) continue
    for (const ex of s.exercises) {
      const groups = GROUP_BY_ID.get(ex.exerciseId)
      if (!groups) continue                       // custom lift — no group mapping
      const unit = logUnit(ex)
      const done = ex.sets.filter(st => st.done)
      if (done.length === 0) continue
      const volume = done.reduce((a, st) => a + setVolume(st, unit, bw), 0)
      anyWork = true
      for (const g of groups) {
        const t = totals.get(g)!
        t.volume += volume / groups.length
        t.sets += done.length / groups.length
      }
    }
  }

  if (!anyWork) return null

  const rows = GROUP_ORDER.map(g => ({ group: g, ...totals.get(g)! }))
  const maxSets = Math.max(...rows.map(r => r.sets), 1)
  const worked = rows.filter(r => r.sets > 0)
  const laggard = worked.length === GROUP_ORDER.length
    ? rows.reduce((min, r) => (r.sets < min.sets ? r : min))
    : rows.find(r => r.sets === 0) ?? null

  return (
    <div>
      <SectionLabel right={`LAST ${BALANCE_WEEKS} WEEKS`}>Balance</SectionLabel>
      <Card>
        <div className="flex flex-col gap-2.5">
          {rows.map(r => {
            const pct = (r.sets / maxSets) * 100
            const lagging = laggard?.group === r.group
            return (
              <div key={r.group} className="flex items-center gap-2.5">
                <span className="font-sans text-[12px] text-text-dim w-[68px] shrink-0">
                  {MUSCLE_LABELS[r.group]}
                </span>
                <div className="flex-1 h-[6px] rounded-pill bg-panel-inset overflow-hidden">
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{ width: `${pct}%`, background: lagging ? '#D5A45F' : '#B0413E' }}
                  />
                </div>
                <span className="font-mono text-[11px] text-text-dim tracking-[-0.01em] w-[54px] text-right shrink-0">
                  {Math.round(r.sets)} sets
                </span>
              </div>
            )
          })}
        </div>
        {laggard && (
          <p className="font-sans text-[12px] text-text-dim leading-[18px] mt-3.5 pt-3 border-t border-[var(--color-divider)]">
            <span className="text-warn font-medium">{MUSCLE_LABELS[laggard.group]}</span>{' '}
            {laggard.sets === 0
              ? `had no logged sets in ${BALANCE_WEEKS} weeks.`
              : `is your least-trained group — ${Math.round(laggard.sets)} sets in ${BALANCE_WEEKS} weeks.`}
          </p>
        )}
      </Card>
    </div>
  )
}
