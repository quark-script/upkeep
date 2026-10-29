import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Pencil } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import {
  targets, foodById, touchFood, groupBySlot, MEAL_SLOTS, SLOT_LABELS,
} from '../lib/nutrition'
import type { FoodEntry, Macros, MealSlot } from '../lib/types'
import { Card } from './ui'
import { FoodSheet } from './FoodSheet'

// ─── Calorie ring ────────────────────────────────────────────────────────────
// Colours come from Tailwind's stroke-*/fill-* utilities so the SVG stays tied
// to the palette in tailwind.config.ts rather than repeating hex values.

function CalorieRing({ value, total, size = 84, stroke = 5 }: {
  value: number; total: number; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(1, value / total) : 0
  const hit = total > 0 && value >= total
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-panel-inset" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        strokeWidth={stroke} className={hit ? 'stroke-success' : 'stroke-accent'}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%" y="45%" dominantBaseline="central" textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize={size * 0.26}
        fontWeight="500" className="fill-text"
      >
        {Math.round(value)}
      </text>
      <text
        x="50%" y="67%" dominantBaseline="central" textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize={size * 0.13}
        className="fill-text-dim"
      >
        /{total} KCAL
      </text>
    </svg>
  )
}

function MacroBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const hit = target > 0 && value >= target
  return (
    <div>
      <div className="flex justify-between items-baseline font-mono text-[10px] tracking-[0.06em] mb-1">
        <span className="text-text-dim uppercase">{label}</span>
        <span className={hit ? 'text-success' : 'text-text-dim'}>
          <span className="text-text">{Math.round(value)}</span>/{target} g
        </span>
      </div>
      <div className="h-[3px] rounded-pill bg-panel-inset overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${hit ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function FoodDay({ date, isToday, label }: { date: string; isToday: boolean; label: string }) {
  const [entries, setEntries] = useLocalStorage<FoodEntry[]>(KEYS.foodDay(date), [])
  const [sheetFor, setSheetFor] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const t = useMemo(() => targets(), [])

  // Totals come from the entries themselves, never re-derived from the food,
  // correcting a food's macros must not silently rewrite what was already eaten.
  const total = useMemo(
    () => entries.reduce<Macros>((a, e) => ({
      kcal: a.kcal + e.macros.kcal,
      protein: Math.round((a.protein + e.macros.protein) * 10) / 10,
      carbs: Math.round((a.carbs + e.macros.carbs) * 10) / 10,
      fat: Math.round((a.fat + e.macros.fat) * 10) / 10,
    }), { ...ZERO }),
    [entries],
  )

  const bySlot = useMemo(() => groupBySlot(entries), [entries])
  const remaining = t ? Math.max(0, t.kcal - total.kcal) : null

  const upsert = (entry: FoodEntry) => {
    setEntries(prev => prev.some(e => e.id === entry.id)
      ? prev.map(e => (e.id === entry.id ? entry : e))
      : [...prev, entry])
    // Without this the Recent tier stays empty forever and the food sheet opens
    // on a blank list, the one-tap path the whole feature is built around.
    touchFood(entry.foodId)
  }

  // Undo rather than a confirm: deleting one row is cheap to reverse and a
  // dialog on every tap would make correcting a day tedious.
  const remove = (id: string) => {
    const gone = entries.find(e => e.id === id)
    setEntries(prev => prev.filter(e => e.id !== id))
    if (!gone) return
    toast({
      message: `${gone.name} removed`,
      actionLabel: 'Undo',
      onAction: () => setEntries(prev =>
        prev.some(e => e.id === gone.id) ? prev : [...prev, gone]),
    })
  }

  const portionLabel = (e: FoodEntry): string => {
    if (!e.servingId) return `${e.grams} g`
    const s = foodById(e.foodId)?.servings.find(x => x.id === e.servingId)
    // The food may have been edited or deleted since; the entry's own grams are
    // the fact that survives.
    if (!s) return `${e.grams} g`
    return e.qty === 1 ? s.label : `${e.qty} × ${s.label}`
  }

  const openSheet = (slot: MealSlot | null, entry: FoodEntry | null = null) => {
    setSheetFor(slot); setEditing(entry); setOpen(true)
  }

  return (
    <Card noPad>
      {/* Header */}
      <div className="px-[18px] pt-[18px] pb-4 border-b border-[var(--color-divider)]">
        {t ? (
          <div className="flex items-center gap-4">
            <CalorieRing value={total.kcal} total={t.kcal} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">
                {isToday ? 'Food today' : `Food · ${label}`}
              </p>
              <p className="font-serif text-[24px] text-text font-medium tracking-[-0.03em] mt-1">
                {remaining === 0 ? 'Target hit.' : `${remaining} kcal to go.`}
              </p>
              <div className="flex flex-col gap-2 mt-2.5">
                <MacroBar label="Protein" value={total.protein} target={t.protein} />
                <MacroBar label="Carbs" value={total.carbs} target={t.carbs} />
                <MacroBar label="Fat" value={total.fat} target={t.fat} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">
                {isToday ? 'Food today' : `Food · ${label}`}
              </p>
              <p className="font-serif text-[22px] text-text font-medium tracking-[-0.03em] mt-1">
                Set your targets.
              </p>
              <p className="font-sans text-[12px] text-text-dim mt-1">
                Food logging still works without them.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/nutrition')}
              className="shrink-0 bg-accent text-accent-text rounded-pill px-3.5 py-2 font-sans text-[11px] uppercase tracking-[0.06em] font-medium cursor-pointer"
            >
              Set targets
            </button>
          </div>
        )}
      </div>

      {/* Meals. An empty slot renders nothing at all: a quiet day should look
          calm, not like four unfinished chores. */}
      {entries.length === 0 ? (
        <p className="px-[18px] py-7 text-center font-sans text-[13px] text-text-dim">
          Nothing logged {isToday ? 'yet today' : 'this day'}.
        </p>
      ) : (
        MEAL_SLOTS.filter(s => bySlot[s].length > 0).map(slot => (
          <div key={slot}>
            <div className="px-[18px] py-2 bg-panel-inset/40 border-y border-[var(--color-divider)] flex items-center justify-between">
              <p className="font-mono text-[9px] text-text-faint uppercase tracking-[0.1em]">{SLOT_LABELS[slot]}</p>
              <button
                onClick={() => openSheet(slot)}
                aria-label={`Add to ${SLOT_LABELS[slot]}`}
                className="bg-transparent border-none p-0 font-mono text-[9px] text-text-faint uppercase tracking-[0.1em] cursor-pointer hover:text-text-dim transition-colors"
              >
                + Add
              </button>
            </div>
            {bySlot[slot].map(e => (
              <div key={e.id} className="px-[18px] py-2.5 flex items-center gap-3 border-b border-[var(--color-divider)] last:border-b-0">
                <button
                  onClick={() => openSheet(e.slot, e)}
                  aria-label={`Edit ${e.name}`}
                  className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer group"
                >
                  <span className="font-sans text-[14px] text-text block truncate">{e.name}</span>
                  <span className="font-mono text-[10.5px] text-text-dim block mt-0.5 flex items-center gap-1">
                    {portionLabel(e)}
                    <Pencil size={9} strokeWidth={1.8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </button>
                <span className="font-mono text-[11px] text-text-dim tracking-[0.02em] shrink-0 text-right">
                  <span className="text-text">{e.macros.kcal}</span> kcal
                  <span className="block text-[10px]">{e.macros.protein} g P</span>
                </span>
                <button
                  onClick={() => remove(e.id)}
                  aria-label={`Remove ${e.name}`}
                  className="w-6 h-6 flex items-center justify-center bg-transparent border-none cursor-pointer text-text-faint hover:text-danger transition-colors shrink-0"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      <button
        onClick={() => openSheet(null)}
        className="w-full py-3 px-[18px] bg-transparent border-none border-t border-dashed border-[var(--color-divider)] flex items-center justify-center gap-2 text-text-dim font-sans text-[12px] uppercase tracking-[0.08em] font-medium cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.8} /> Add food
      </button>

      <FoodSheet
        open={open}
        slot={sheetFor ?? undefined}
        editing={editing}
        onAdd={upsert}
        onClose={() => { setOpen(false); setEditing(null); setSheetFor(null) }}
      />
    </Card>
  )
}
