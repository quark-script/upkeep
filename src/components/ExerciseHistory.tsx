import { format } from 'date-fns'
import { X, Trophy } from 'lucide-react'
import { parseKey } from '../lib/date'
import { bestE1RM, latestBodyWeightKg, logUnit, formatSet, topSet, isBetterSet } from '../lib/stats'
import type { Session, ExerciseLog, LoadUnit, SetEntry } from '../lib/types'
import { Divider } from './ui'

interface Appearance {
  date: string
  log: ExerciseLog
  e1rm: number | null
  isPR: boolean
}

// Every logged appearance of one lift, oldest → newest, with PRs marked.
export function exerciseAppearances(
  sessions: Session[],
  exerciseId: string,
  bw = latestBodyWeightKg(),
): Appearance[] {
  const out: Appearance[] = []
  let best = -Infinity
  const chronological = sessions
    .filter(s => s.finishedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt)

  for (const s of chronological) {
    const log = s.exercises.find(e => e.exerciseId === exerciseId)
    if (!log || log.sets.every(st => !st.done)) continue
    const v = bestE1RM(log, bw)
    // A lift's first appearance is a baseline, not a personal record.
    const isPR = v != null && best !== -Infinity && v > best + 0.5
    if (v != null && v > best) best = v
    out.push({ date: s.date, log, e1rm: v, isPR })
  }
  return out
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const W = 260, H = 56, PAD = 5
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [
    PAD + (i / (data.length - 1)) * (W - PAD * 2),
    PAD + (1 - (v - min) / span) * (H - PAD * 2),
  ] as [number, number])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 56, display: 'block' }}>
      <path d={area} fill="#B0413E" opacity={0.1} />
      <path d={line} stroke="#B0413E" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3 : 1.5} fill="#B0413E" />
      ))}
    </svg>
  )
}

// Bottom sheet: the full story of one lift — every session, top sets, PRs.
export function ExerciseHistorySheet({
  name,
  exerciseId,
  unit,
  sessions,
  onClose,
}: {
  name: string
  exerciseId: string
  unit: LoadUnit
  sessions: Session[]
  onClose: () => void
}) {
  const bw = latestBodyWeightKg()
  const appearances = exerciseAppearances(sessions, exerciseId, bw)
  const newestFirst = [...appearances].reverse()
  const series = appearances.map(a => a.e1rm).filter((v): v is number => v != null)
  const bestEver = series.length ? Math.max(...series) : null
  // Weight alone can't rank these: for timed holds and unloaded bodyweight
  // lifts every set weighs the same, so reps have to break the tie.
  const heaviest = appearances
    .map(a => topSet(a.log))
    .filter((s): s is SetEntry => s != null)
    .reduce<SetEntry | null>((best, s) => (best == null || isBetterSet(s, best) ? s : best), null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[82vh]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3.5 shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">Lift history</p>
            <p className="font-serif text-[20px] font-medium text-text tracking-[-0.03em] mt-0.5 leading-[24px]">
              {name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer shrink-0"
          >
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        {appearances.length === 0 ? (
          <p className="font-sans text-[13px] text-text-dim text-center px-6 pb-10 pt-4 leading-[19px]">
            No completed sets logged yet. Finish a session with this lift and its history appears here.
          </p>
        ) : (
          <>
            <div className="px-5 pb-4 shrink-0">
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                {[
                  { label: 'Sessions', value: String(appearances.length) },
                  {
                    label: unit === 'time' ? 'Best hold' : 'Best set',
                    value: heaviest ? formatSet(heaviest, unit) : '—',
                  },
                  {
                    label: 'Est. 1RM',
                    value: bestEver != null ? `${Math.round(bestEver)} kg` : '—',
                  },
                ].map(s => (
                  <div key={s.label} className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2.5 py-2.5">
                    <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.06em]">{s.label}</p>
                    <p className="font-mono text-[14px] text-text font-medium tracking-[-0.02em] mt-1 truncate">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              {series.length > 1 && <Sparkline data={series} />}
            </div>

            <Divider />

            <div className="overflow-y-auto flex-1 pb-6">
              {newestFirst.map((a, i) => {
                const top = topSet(a.log)
                const doneCount = a.log.sets.filter(st => st.done).length
                return (
                  <div key={`${a.date}-${i}`}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="w-[52px] shrink-0">
                        <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.05em]">
                          {format(parseKey(a.date), 'EEE')}
                        </p>
                        <p className="font-mono text-[13px] text-text tracking-[-0.02em]">
                          {format(parseKey(a.date), 'd MMM')}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-[13px] text-text font-medium flex items-center gap-1.5">
                          {top ? formatSet(top, logUnit(a.log)) : '—'}
                          {a.isPR && <Trophy size={12} strokeWidth={2} className="text-accent shrink-0" />}
                        </p>
                        <p className="font-mono text-[10px] text-text-dim tracking-[0.03em] mt-0.5">
                          {doneCount} set{doneCount === 1 ? '' : 's'}
                          {a.log.note ? ` · ${a.log.note}` : ''}
                        </p>
                      </div>
                      {a.e1rm != null && (
                        <span className="font-mono text-[12px] text-text-dim tracking-[-0.01em] shrink-0">
                          {Math.round(a.e1rm)} kg
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
