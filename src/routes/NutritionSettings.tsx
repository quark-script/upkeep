import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Search, X, AlertTriangle, Trash2,
} from 'lucide-react'
import {
  targets, setTargets, clearTargets, userFoods, resolveFoods, saveFood, deleteFood,
  setFoodPrefs, clearFoodPrefs, hasFoodPrefs, searchFoods,
} from '../lib/nutrition'
import { useToast } from '../lib/toast'
import type { Food, MacroTargets, Macros } from '../lib/types'
import { PageTitle, Card, Btn, Pill, Divider } from '../components/ui'

const TARGET_FIELDS: { key: keyof MacroTargets; label: string; unit: string }[] = [
  { key: 'kcal',    label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein',  unit: 'g' },
  { key: 'carbs',   label: 'Carbs',    unit: 'g' },
  { key: 'fat',     label: 'Fat',      unit: 'g' },
]

type TargetForm = Record<keyof MacroTargets, string>

function TargetEditor({ initial, onSaved }: {
  initial: MacroTargets | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<TargetForm>({
    kcal: initial ? String(initial.kcal) : '',
    protein: initial ? String(initial.protein) : '',
    carbs: initial ? String(initial.carbs) : '',
    fat: initial ? String(initial.fat) : '',
  })
  const values: MacroTargets = {
    kcal: parseInt(form.kcal, 10),
    protein: parseInt(form.protein, 10),
    carbs: parseInt(form.carbs, 10),
    fat: parseInt(form.fat, 10),
  }
  const valid = Object.values(values).every(Number.isFinite) &&
    values.kcal > 0 && values.protein >= 0 && values.carbs >= 0 && values.fat >= 0

  const save = () => {
    if (!valid) return
    setTargets(values)
    onSaved()
  }

  const clear = () => {
    clearTargets()
    setForm({ kcal: '', protein: '', carbs: '', fat: '' })
    onSaved()
  }

  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
        Daily targets
      </p>
      <Card>
        <p className="font-sans text-[12.5px] text-text-dim leading-[18px] mb-4">
          Enter targets that fit your own plan. Upkeep will not estimate them for you.
        </p>
        <div className="flex flex-col gap-3.5">
          {TARGET_FIELDS.map(({ key, label, unit }) => (
            <label key={key} className="flex items-center gap-3">
              <span className="flex-1 font-sans text-[13.5px] text-text font-medium">{label}</span>
              <input
                inputMode="numeric"
                value={form[key]}
                onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}
                placeholder="—"
                aria-label={label}
                className="w-[92px] bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2.5 py-2 font-mono text-[15px] text-center text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors"
              />
              <span className="font-mono text-[10px] text-text-faint uppercase w-[34px]">{unit}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Btn onClick={save} disabled={!valid} className="flex-1">
            {initial ? 'Save targets' : 'Set targets'}
          </Btn>
          {initial && <Btn variant="secondary" onClick={clear}>Clear</Btn>}
        </div>
      </Card>
    </div>
  )
}

// ─── Food editor ─────────────────────────────────────────────────────────────

function FoodEditor({ food, onSaved, onClose }: {
  food: Food
  onSaved: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(food.name)
  const [per100, setPer100] = useState({
    kcal: String(food.per100.kcal), protein: String(food.per100.protein),
    carbs: String(food.per100.carbs), fat: String(food.per100.fat),
  })
  const [servings, setServings] = useState(
    food.servings.map(s => ({ ...s, gramsRaw: String(s.grams) })))

  const n = (v: string) => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : 0 }
  const macros: Macros = {
    kcal: n(per100.kcal), protein: n(per100.protein), carbs: n(per100.carbs), fat: n(per100.fat),
  }
  const derived = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
  const mismatch = macros.kcal > 0 && Math.abs(derived - macros.kcal) > Math.max(20, macros.kcal * 0.2)

  const field = 'w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 font-sans text-[14px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors'

  const save = () => {
    const patch = {
      name: name.trim() || food.name,
      per100: macros,
      servings: servings
        .filter(s => s.label.trim() && n(s.gramsRaw) > 0)
        .map(({ gramsRaw, ...s }) => ({ ...s, grams: n(gramsRaw) })),
      // Completing the numbers is exactly what clears the flag.
      needsReview: macros.kcal === 0 && macros.protein === 0,
    }
    // A seed food is corrected through the overlay, never by writing a second
    // record: `resolveFoods` lists SEED_FOODS first, so a saved copy sharing a
    // seed id would be shadowed and the edit would silently vanish.
    if (food.source === 'seed') setFoodPrefs(food.id, patch)
    else saveFood({ ...food, ...patch })
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[86vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em] truncate pr-3">{food.name}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer shrink-0">
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-7 flex flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Food name" className={field} />

          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mt-1">Per 100 g</p>
          <div className="grid grid-cols-4 gap-2">
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => (
              <div key={k}>
                <input
                  inputMode="decimal"
                  value={per100[k]}
                  onChange={e => setPer100(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-2 py-2.5 font-mono text-[14px] text-text text-center outline-none focus:border-accent transition-colors"
                />
                <p className="font-mono text-[9px] text-text-dim uppercase tracking-[0.06em] text-center mt-1">{k}</p>
              </div>
            ))}
          </div>
          {mismatch && (
            <p className="flex items-start gap-1.5 font-sans text-[11.5px] text-warn leading-[15px]">
              <AlertTriangle size={12} strokeWidth={1.8} className="shrink-0 mt-0.5" />
              These work out to {Math.round(derived)} kcal. Save anyway if the label disagrees.
            </p>
          )}

          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mt-1">Portions</p>
          {servings.map((s, i) => (
            <div key={s.id} className="flex gap-2">
              <input
                value={s.label}
                onChange={e => setServings(v => v.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className={`${field} flex-1`}
              />
              <input
                inputMode="decimal"
                value={s.gramsRaw}
                onChange={e => setServings(v => v.map((x, j) => (j === i ? { ...x, gramsRaw: e.target.value } : x)))}
                className={`${field} w-[84px] text-center font-mono`}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <Btn onClick={save} className="flex-1">Save food</Btn>
            {food.source === 'seed' && hasFoodPrefs(food.id) && (
              <Btn
                variant="secondary"
                onClick={() => { clearFoodPrefs(food.id); onSaved(); onClose() }}
                className="flex-1"
              >
                Reset to default
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NutritionSettings() {
  const navigate = useNavigate()
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Food | null>(null)

  const bump = () => setVersion(v => v + 1)
  const t = useMemo(() => targets(), [version])
  const mine = useMemo(() => userFoods(), [version])
  const all = useMemo(() => resolveFoods(), [version])
  const review = useMemo(() => resolveFoods().filter(f => f.needsReview), [version])

  // Every food is editable, seed included — a wrong per-100g value would
  // otherwise silently corrupt every total the app ever shows, with no way to
  // correct it. Yours first, since those are the ones people look for.
  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return [...mine, ...all.filter(f => f.source !== 'custom')]
    const hits = searchFoods(q, 200)
    return [...hits.filter(f => f.source === 'custom'), ...hits.filter(f => f.source !== 'custom')]
  }, [mine, all, query, version])


  return (
    <>
      <div className="pt-6 pb-8 flex flex-col gap-5">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1.5 self-start bg-transparent border-none p-0 font-mono text-[11px] text-text-dim uppercase tracking-[0.08em] cursor-pointer hover:text-text transition-colors"
        >
          <ChevronLeft size={13} strokeWidth={2} /> Settings
        </button>

        <PageTitle kicker="Nutrition" title="Targets & foods." />

        <TargetEditor key={version} initial={t} onSaved={bump} />

        {/* ── Needs review ── */}
        {review.length > 0 && (
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
              Needs review · {review.length}
            </p>
            <Card noPad>
              {review.map((f, i) => (
                <div key={f.id}>
                  {i > 0 && <Divider />}
                  <button
                    onClick={() => setEditing(f)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-warn/10">
                      <AlertTriangle size={15} strokeWidth={1.7} className="text-warn" />
                    </div>
                    <span className="flex-1 min-w-0">
                      <span className="font-sans text-[14px] text-text font-medium block truncate">{f.name}</span>
                      <span className="font-sans text-[11.5px] text-text-dim block mt-0.5">
                        Brought over from your old protein log — add its calories.
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── Your foods ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
            Food library · {all.length}{mine.length > 0 ? ` · ${mine.length} yours` : ''}
          </p>

          <>
              <div className="flex items-center gap-2 bg-panel border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 mb-2.5">
                <Search size={15} strokeWidth={1.8} className="text-text-faint shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search foods…"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[14px] text-text placeholder:text-text-faint"
                />
              </div>
              <Card noPad>
                {filtered.map((f, i) => (
                  <div key={f.id}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-2 pr-3">
                      <button
                        onClick={() => setEditing(f)}
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset/50 transition-colors"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="font-sans text-[13.5px] text-text font-medium block truncate">{f.name}</span>
                          <span className="font-mono text-[10.5px] text-text-dim block mt-0.5">
                            {f.per100.kcal} kcal · {f.per100.protein} g P per 100 g
                          </span>
                        </span>
                        {f.source === 'custom'
                          ? <Pill color="dim">YOURS</Pill>
                          : hasFoodPrefs(f.id) && <Pill color="accent">EDITED</Pill>}
                      </button>
                      {f.source === 'custom' && (
                        <button
                          onClick={() => setConfirmDelete(f)}
                          aria-label={`Delete ${f.name}`}
                          className="w-11 h-11 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-danger transition-colors shrink-0"
                        >
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="font-sans text-[13px] text-text-dim text-center py-5">No matches.</p>
                )}
              </Card>
            </>
        </div>
      </div>

      {editing && (
        <FoodEditor food={editing} onSaved={bump} onClose={() => setEditing(null)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-5">
            <p className="font-serif text-[19px] text-text font-medium tracking-[-0.02em]">
              Delete {confirmDelete.name}?
            </p>
            <p className="font-sans text-[13px] text-text-dim leading-[18px] mt-2">
              Days you already logged it keep their entries and macros — each one stored its own
              numbers at the time. You just won't find it in search any more.
            </p>
            <div className="flex gap-2 mt-4">
              <Btn variant="secondary" onClick={() => setConfirmDelete(null)} className="flex-1">Cancel</Btn>
              <Btn
                onClick={() => {
                  deleteFood(confirmDelete.id)
                  toast({ message: `${confirmDelete.name} deleted` })
                  setConfirmDelete(null)
                  bump()
                }}
                className="flex-1"
              >
                Delete
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
