import { useNavigate } from 'react-router-dom'
import { Pill as PillIcon, Sparkles, Check, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { isDue } from '../lib/routines'
import type { Medicine, SkinStep } from '../lib/types'
import { Card, Divider } from './ui'

interface Line {
  key: 'meds' | 'skin'
  label: string
  Icon: typeof PillIcon
  done: number
  total: number
}

// Today's non-training obligations at a glance, the things easiest to forget.
export function RoutineSummary({ date }: { date: string }) {
  const navigate = useNavigate()
  const [meds] = useLocalStorage<Medicine[]>(KEYS.MEDICINES, [])
  const [skin] = useLocalStorage<SkinStep[]>(KEYS.SKINCARE, [])
  const [medsDone] = useLocalStorage<Record<string, boolean>>(KEYS.medsDay(date), {})
  const [skinDone] = useLocalStorage<Record<string, boolean>>(KEYS.skinDay(date), {})
  const [, setSection] = useLocalStorage<string>(KEYS.DAILY_SECTION, 'food')

  const medsDue = meds.filter(
    m => m.active && isDue(m.schedule, date) && !(m.startedOn && date < m.startedOn),
  )
  const skinDue = skin.filter(s => s.active && isDue(s.schedule, date))

  const lines: Line[] = ([
    { key: 'meds', label: 'Medicines', Icon: PillIcon, done: medsDue.filter(m => medsDone[m.id]).length, total: medsDue.length },
    { key: 'skin', label: 'Skincare',  Icon: Sparkles, done: skinDue.filter(s => skinDone[s.id]).length, total: skinDue.length },
  ] satisfies Line[]).filter(l => l.total > 0)

  if (lines.length === 0) return null

  const open = (key: Line['key']) => {
    setSection(key)
    navigate('/daily')
  }

  return (
    <Card noPad>
      {lines.map((l, i) => {
        const complete = l.done === l.total
        return (
          <div key={l.key}>
            {i > 0 && <Divider />}
            <button
              onClick={() => open(l.key)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer"
            >
              <span
                className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${complete ? 'bg-[var(--color-accent-soft)]' : 'bg-panel-inset'}`}
              >
                {complete
                  ? <Check size={15} strokeWidth={2} className="text-accent" />
                  : <l.Icon size={15} strokeWidth={1.7} className="text-text-dim" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-sans text-[13px] text-text font-medium block">{l.label}</span>
                <span className="font-mono text-[11px] text-text-dim tracking-[0.02em] block mt-0.5">
                  {complete ? 'Done for today' : `${l.total - l.done} left`}
                </span>
              </span>
              <span className="font-mono text-[13px] text-text-dim tracking-[0.02em] shrink-0">
                {l.done}/{l.total}
              </span>
              <ChevronRight size={14} strokeWidth={1.6} className="text-text-faint shrink-0" />
            </button>
          </div>
        )
      })}
    </Card>
  )
}
