import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, X, ChevronLeft, AlertTriangle } from 'lucide-react'
import {
  searchFoods, recentFoods, macrosFor, saveFood, userFoods, foodById,
  MEAL_SLOTS, SLOT_LABELS, slotForNow,
} from '../lib/nutrition'
import { searchOFF, offStatus } from '../lib/off'
import type { Food, FoodEntry, Macros, MealSlot, Serving } from '../lib/types'
import { Btn, Pill } from './ui'

interface Props {
  open: boolean
  /** Prefill for the slot selector; defaults to whatever suits the clock. */
  slot?: MealSlot
  /** Editing an existing entry rather than adding a new one. */
  editing?: FoodEntry | null
  onAdd: (entry: FoodEntry) => void
  onClose: () => void
}

const OFF_NOTES: Record<ReturnType<typeof offStatus>, string> = {
  ready: '',
  offline: 'Offline: searching your foods only.',
  throttled: 'Packaged search paused for a minute.',
  // Tier 4 is CORS-blocked from a browser, so there is nothing useful to say
  // about it during a normal search: the empty-result line already tells the
  // user what to do next.
  unsupported: '',
}

function newId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

/** The four numbers, in the order everyone reads them. */
function MacroRow({ macros, grams }: { macros: Macros; grams: number }) {
  const cells: [string, string][] = [
    ['kcal', String(macros.kcal)],
    ['P', `${macros.protein} g`],
    ['C', `${macros.carbs} g`],
    ['F', `${macros.fat} g`],
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map(([label, value]) => (
        <div key={label} className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card py-2 text-center">
          <p className="font-mono text-[15px] text-text font-medium tabular-nums">{value}</p>
          <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.08em] mt-0.5">{label}</p>
        </div>
      ))}
      <p className="col-span-4 font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] text-center">
        {grams} g total
      </p>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-pill border font-mono text-[10.5px] uppercase tracking-[0.04em] font-medium cursor-pointer transition-colors ${
        on ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
           : 'bg-transparent border-[var(--color-panel-border)] text-text-dim'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Quantity step ───────────────────────────────────────────────────────────

function QuantityStep({ food, initial, defaultSlot, onConfirm, onBack }: {
  food: Food
  initial?: FoodEntry | null
  defaultSlot?: MealSlot
  onConfirm: (entry: FoodEntry) => void
  onBack: () => void
}) {
  const [servingId, setServingId] = useState<string | undefined>(
    initial ? initial.servingId : food.defaultServingId)
  const [qty, setQty] = useState<number>(initial?.qty ?? 1)
  const [slot, setSlot] = useState<MealSlot>(initial?.slot ?? defaultSlot ?? slotForNow())
  const [raw, setRaw] = useState(String(initial?.qty ?? 1))

  const byGrams = servingId === undefined
  const step = byGrams ? 10 : 0.5
  const { grams, macros } = macrosFor(food, servingId, qty)

  const setQuantity = (v: number) => {
    const next = Math.max(step, Math.round(v * 100) / 100)
    setQty(next)
    setRaw(String(next))
  }

  // Switching between servings and raw grams rescales rather than resetting, so
  // "1 bowl" becomes "150 g" instead of "1 g".
  const chooseServing = (next: string | undefined) => {
    const target = next ? food.servings.find(s => s.id === next) : undefined
    const nextQty = target ? Math.max(0.5, Math.round((grams / target.grams) * 2) / 2) : Math.round(grams)
    setServingId(next)
    setQty(nextQty)
    setRaw(String(nextQty))
  }

  const stepBtn = 'w-11 h-11 rounded-card flex items-center justify-center bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer text-text-dim disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="px-5 pb-7 flex flex-col gap-4 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 self-start bg-transparent border-none p-0 font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] cursor-pointer"
      >
        <ChevronLeft size={12} strokeWidth={2} /> Back
      </button>

      <div>
        <p className="font-serif text-[20px] text-text font-medium tracking-[-0.02em]">{food.name}</p>
        {food.brand && <p className="font-sans text-[12px] text-text-dim mt-0.5">{food.brand}</p>}
      </div>

      <MacroRow macros={macros} grams={grams} />

      <div>
        <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-2">Portion</p>
        <div className="flex flex-wrap gap-1.5">
          {food.servings.map(s => (
            <Chip key={s.id} on={servingId === s.id} onClick={() => chooseServing(s.id)}>
              {s.label}
            </Chip>
          ))}
          <Chip on={byGrams} onClick={() => chooseServing(undefined)}>
            {food.liquid ? 'ml' : 'grams'}
          </Chip>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className={stepBtn} disabled={qty <= step} onClick={() => setQuantity(qty - step)} aria-label="Less">
          <X size={13} strokeWidth={2} className="rotate-45" />
        </button>
        <input
          inputMode="decimal"
          value={raw}
          onChange={e => {
            setRaw(e.target.value)
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v > 0) setQty(v)
          }}
          onBlur={() => setRaw(String(qty))}
          onFocus={e => e.target.select()}
          className="flex-1 min-w-0 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 font-mono text-[18px] text-text text-center outline-none focus:border-accent transition-colors"
        />
        <button className={stepBtn} onClick={() => setQuantity(qty + step)} aria-label="More">
          <Plus size={13} strokeWidth={2} />
        </button>
      </div>
      <p className="font-sans text-[11.5px] text-text-faint text-center -mt-2">
        {byGrams
          ? `${qty} ${food.liquid ? 'ml' : 'g'}`
          : `${qty} × ${food.servings.find(s => s.id === servingId)?.label ?? 'serving'}`}
      </p>

      <div>
        <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-2">Meal</p>
        <div className="flex flex-wrap gap-1.5">
          {MEAL_SLOTS.map(s => (
            <Chip key={s} on={slot === s} onClick={() => setSlot(s)}>{SLOT_LABELS[s]}</Chip>
          ))}
        </div>
      </div>

      <Btn
        fullWidth
        onClick={() => {
          // Copy-on-select: an OpenFoodFacts result only works offline once it
          // lives in the user's own library.
          if (food.source === 'off' && !userFoods().some(f => f.id === food.id)) saveFood(food)
          onConfirm({
            id: initial?.id ?? newId(),
            foodId: food.id,
            name: food.name,
            servingId,
            qty,
            grams,
            macros,
            slot,
            at: initial?.at ?? Date.now(),
          })
        }}
      >
        {initial ? 'Save changes' : 'Add'} · {macros.kcal} kcal
      </Btn>
    </div>
  )
}

// ─── Create-food step ────────────────────────────────────────────────────────

function CreateStep({ initialName, onCreated, onBack }: {
  initialName: string
  onCreated: (food: Food) => void
  onBack: () => void
}) {
  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState('')
  const [per100, setPer100] = useState({ kcal: '', protein: '', carbs: '', fat: '' })
  const [servings, setServings] = useState<{ label: string; grams: string }[]>([{ label: '', grams: '' }])

  const n = (v: string) => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : 0 }
  const macros: Macros = {
    kcal: n(per100.kcal), protein: n(per100.protein), carbs: n(per100.carbs), fat: n(per100.fat),
  }
  const derived = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
  // A hint, never a blocker: packaged labels genuinely disagree sometimes.
  const mismatch = macros.kcal > 0 && Math.abs(derived - macros.kcal) > Math.max(20, macros.kcal * 0.2)

  const field = 'w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 font-sans text-[14px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors'

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `custom:${slug || Date.now()}`
    const list: Serving[] = servings
      .filter(s => s.label.trim() && n(s.grams) > 0)
      .map(s => ({ id: `${id}:${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label: s.label.trim(), grams: n(s.grams) }))
    if (!list.some(s => s.grams === 100)) list.push({ id: `${id}:100-g`, label: '100 g', grams: 100 })
    const food: Food = {
      id, name: clean,
      brand: brand.trim() || undefined,
      per100: macros,
      servings: list,
      defaultServingId: list[0].id,
      source: 'custom',
      createdAt: Date.now(),
    }
    saveFood(food)
    onCreated(food)
  }

  return (
    <div className="px-5 pb-7 flex flex-col gap-3 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 self-start bg-transparent border-none p-0 font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] cursor-pointer"
      >
        <ChevronLeft size={12} strokeWidth={2} /> Back
      </button>

      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Food name" className={field} />
      <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand (optional)" className={field} />

      <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mt-1">Per 100 g</p>
      <div className="grid grid-cols-4 gap-2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => (
          <div key={k}>
            <input
              inputMode="decimal"
              value={per100[k]}
              onChange={e => setPer100(p => ({ ...p, [k]: e.target.value }))}
              placeholder="0"
              className="w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2 py-2.5 font-mono text-[14px] text-text text-center outline-none focus:border-accent placeholder:text-text-faint transition-colors"
            />
            <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.06em] text-center mt-1">{k}</p>
          </div>
        ))}
      </div>
      {mismatch && (
        <p className="flex items-start gap-1.5 font-sans text-[11.5px] text-warn leading-[15px]">
          <AlertTriangle size={12} strokeWidth={1.8} className="shrink-0 mt-0.5" />
          These don't quite add up: the macros work out to {Math.round(derived)} kcal. Save anyway if the label says otherwise.
        </p>
      )}

      <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mt-1">Portions</p>
      {servings.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={s.label}
            onChange={e => setServings(v => v.map((x, n2) => (n2 === i ? { ...x, label: e.target.value } : x)))}
            placeholder="1 bowl"
            className={`${field} flex-1`}
          />
          <input
            inputMode="decimal"
            value={s.grams}
            onChange={e => setServings(v => v.map((x, n2) => (n2 === i ? { ...x, grams: e.target.value } : x)))}
            placeholder="150"
            className={`${field} w-[84px] text-center font-mono`}
          />
        </div>
      ))}
      <button
        onClick={() => setServings(v => [...v, { label: '', grams: '' }])}
        className="self-start bg-transparent border-none p-0 font-mono text-[10px] text-text-dim uppercase tracking-[0.06em] cursor-pointer"
      >
        + Another portion
      </button>
      <p className="font-sans text-[11.5px] text-text-faint leading-[15px]">
        A 100 g portion is always added, so you can log by weight too.
      </p>

      <Btn fullWidth onClick={save} disabled={!name.trim()}>Save food</Btn>
    </div>
  )
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

export function FoodSheet({ open, slot, editing, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [offResults, setOffResults] = useState<Food[]>([])

  const local = useMemo(() => (open && query.trim() ? searchFoods(query) : []), [query, open])
  const recent = useMemo(() => (open && !query.trim() ? recentFoods().slice(0, 12) : []), [query, open])
  const status = offStatus()

  // Tier 4 is additive and must never delay the local tiers: debounced, aborted
  // on every keystroke, and only when local results are thin.
  useEffect(() => {
    setOffResults([])
    if (query.trim().length < 3 || local.length >= 5) return
    const ctrl = new AbortController()
    const t = setTimeout(() => { searchOFF(query, ctrl.signal).then(setOffResults) }, 500)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, local.length])

  // Editing an existing entry skips the search step entirely: the food is
  // already known, only the portion is in question.
  useEffect(() => {
    if (!open) { setQuery(''); setPicked(null); setCreating(false); setOffResults([]); return }
    if (editing) setPicked(foodById(editing.foodId) ?? null)
  }, [open, editing])

  if (!open) return null

  const title = picked ? 'Portion' : creating ? 'New food' : editing ? 'Edit entry' : 'Add food'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[86vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">{title}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer shrink-0">
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        {picked ? (
          <QuantityStep
            food={picked}
            defaultSlot={slot}
            initial={editing && editing.foodId === picked.id ? editing : null}
            onConfirm={entry => { onAdd(entry); onClose() }}
            onBack={editing ? onClose : () => setPicked(null)}
          />
        ) : creating ? (
          <CreateStep
            initialName={query}
            onCreated={f => { setCreating(false); setPicked(f) }}
            onBack={() => setCreating(false)}
          />
        ) : (
          <>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5">
                <Search size={15} strokeWidth={1.8} className="text-text-faint shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search foods…"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[14px] text-text placeholder:text-text-faint"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Clear search" className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-text-faint shrink-0">
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto px-3 pb-3 flex-1">
              {!query.trim() && recent.length === 0 && (
                <p className="text-center font-sans text-[13px] text-text-dim py-8 px-4 leading-[19px]">
                  Search for a food to log it. What you eat often will show up here
                  for one-tap logging.
                </p>
              )}

              {recent.length > 0 && (
                <>
                  <p className="font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] px-2.5 pb-2">Recent</p>
                  <div className="grid grid-cols-2 gap-2 px-1.5 pb-3">
                    {recent.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setPicked(f)}
                        className="px-3 py-2.5 rounded-card bg-panel-inset border border-[var(--color-panel-border)] text-left cursor-pointer hover:border-accent transition-colors"
                      >
                        <span className="font-sans text-[13px] text-text font-medium block truncate">{f.name}</span>
                        <span className="font-mono text-[10px] text-text-dim block mt-0.5 truncate">
                          {f.servings.find(s => s.id === f.defaultServingId)?.label ?? '100 g'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {local.map(f => (
                <button
                  key={f.id}
                  onClick={() => setPicked(f)}
                  className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-card text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset transition-colors"
                >
                  <Plus size={14} strokeWidth={2} className="text-text-faint shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="font-sans text-[14px] text-text font-medium block truncate">{f.name}</span>
                    {f.brand && <span className="font-sans text-[11.5px] text-text-dim block truncate">{f.brand}</span>}
                  </span>
                  {f.needsReview && <Pill color="warn">CHECK</Pill>}
                  {f.source === 'custom' && !f.needsReview && <Pill color="dim">YOURS</Pill>}
                  <span className="font-mono text-[10px] text-text-dim tracking-[0.04em] shrink-0">
                    {f.per100.kcal} kcal
                  </span>
                </button>
              ))}

              {query.trim().length > 0 && local.length === 0 && (
                <p className="text-center font-sans text-[13px] text-text-dim py-6">
                  {status === 'unsupported'
                    ? 'Nothing matched. Create it below and it stays in your library.'
                    : OFF_NOTES[status] || 'Nothing matched. Create it below and it stays in your library.'}
                </p>
              )}

              {offResults.length > 0 && (
                <>
                  <p className="font-mono text-[10px] text-text-faint uppercase tracking-[0.08em] px-2.5 pt-3 pb-2">
                    Packaged foods
                  </p>
                  {offResults.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setPicked(f)}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-card text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset transition-colors"
                    >
                      <Plus size={14} strokeWidth={2} className="text-text-faint shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="font-sans text-[14px] text-text font-medium block truncate">{f.name}</span>
                        {f.brand && <span className="font-sans text-[11.5px] text-text-dim block truncate">{f.brand}</span>}
                      </span>
                      <Pill color="dim">OFF</Pill>
                    </button>
                  ))}
                </>
              )}

              {query.trim().length >= 3 && local.length > 0 && offResults.length === 0 && status === 'offline' && (
                <p className="font-sans text-[11.5px] text-text-faint leading-[16px] px-2.5 pt-3">
                  {OFF_NOTES.offline}
                </p>
              )}
            </div>

            <button
              onClick={() => setCreating(true)}
              className="flex items-center justify-center gap-2 px-5 pt-4 pb-7 border-t border-[var(--color-divider)] bg-transparent border-x-0 border-b-0 font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] font-medium cursor-pointer shrink-0"
            >
              <Plus size={13} strokeWidth={1.8} /> Create food
            </button>
          </>
        )}
      </div>
    </div>
  )
}
