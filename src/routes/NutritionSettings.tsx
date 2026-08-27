import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Search, X, AlertTriangle, Trash2,
} from 'lucide-react'
import {
  targets, setTargets, clearTarget, userFoods, resolveFoods, saveFood, deleteFood,
  setFoodPrefs, clearFoodPrefs, hasFoodPrefs, searchFoods,
  DEFAULT_ACTIVITY, DEFAULT_GOAL_DELTA,
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
  const [showWorking, setShowWorking] = useState(false)
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

  const reconciles = Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) <= 5

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

        {/* ── Targets ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
            Daily targets
          </p>
          <Card>
            <div className="flex flex-col gap-3.5">
              {TARGET_FIELDS.map(({ key, label, unit }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13.5px] text-text font-medium flex items-center gap-2">
                      {label}
                      {t.derived[key] ? <Pill color="dim">AUTO</Pill> : <Pill color="accent">SET</Pill>}
                    </p>
                    {!t.derived[key] && (
                      <button
                        onClick={() => { clearTarget(key); bump() }}
                        className="mt-0.5 bg-transparent border-none p-0 font-mono text-[10px] text-text-faint uppercase tracking-[0.06em] cursor-pointer hover:text-text-dim transition-colors"
                      >
                        Back to auto
                      </button>
                    )}
                  </div>
                  <input
                    inputMode="numeric"
                    defaultValue={String(t[key])}
                    key={`${key}-${version}`}
                    onBlur={e => {
                      const v = parseInt(e.target.value, 10)
                      if (Number.isFinite(v) && v > 0 && v !== t[key]) { setTargets({ [key]: v }); bump() }
                      else e.target.value = String(t[key])
                    }}
                    className={`w-[92px] bg-panel-inset border rounded-card px-2.5 py-2 font-mono text-[15px] text-center outline-none focus:border-accent transition-colors ${
                      t.derived[key] ? 'border-[var(--color-panel-border)] text-text-dim' : 'border-accent text-text'
                    }`}
                  />
                  <span className="font-mono text-[10px] text-text-faint uppercase w-[34px]">{unit}</span>
                </div>
              ))}
            </div>

            <Divider className="my-4" />

            <button
              onClick={() => setShowWorking(o => !o)}
              className="w-full flex items-center justify-between bg-transparent border-none p-0 cursor-pointer"
            >
              <span className="font-sans text-[12.5px] text-text-dim">How calories are calculated</span>
              {showWorking
                ? <ChevronUp size={14} strokeWidth={1.8} className="text-text-faint" />
                : <ChevronDown size={14} strokeWidth={1.8} className="text-text-faint" />}
            </button>

            {showWorking && (
              <div className="mt-3 flex flex-col gap-3.5">
                <p className="font-mono text-[11.5px] text-text-dim leading-[17px]">
                  {t.basis.bmr > 0
                    ? `BMR ${t.basis.bmr} × ${t.basis.activityFactor} ${t.basis.goalDelta >= 0 ? '+' : '−'} ${Math.abs(t.basis.goalDelta)} = `
                    : `No BMR logged — using 1500 × ${t.basis.activityFactor} ${t.basis.goalDelta >= 0 ? '+' : '−'} ${Math.abs(t.basis.goalDelta)} = `}
                  <span className="text-text">{Math.round((t.basis.bmr > 0 ? t.basis.bmr : 1500) * t.basis.activityFactor + t.basis.goalDelta)} kcal</span>
                  {!t.derived.kcal && <span className="text-text-faint"> (overridden above)</span>}
                </p>

                <div>
                  <div className="flex justify-between font-mono text-[11px] text-text-dim mb-1.5">
                    <span>Activity</span>
                    <span className="text-text">{t.basis.activityFactor.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range" min={1.2} max={1.9} step={0.1}
                    value={t.basis.activityFactor}
                    onChange={e => { setTargets({ activityFactor: parseFloat(e.target.value) }); bump() }}
                    className="w-full accent-accent"
                  />
                  <p className="font-sans text-[11px] text-text-faint mt-1">
                    1.2 desk-bound · 1.5 training most days · 1.9 heavy labour
                  </p>
                </div>

                <div>
                  <div className="flex justify-between font-mono text-[11px] text-text-dim mb-1.5">
                    <span>Goal</span>
                    <span className="text-text">
                      {t.basis.goalDelta > 0 ? '+' : ''}{t.basis.goalDelta} kcal
                    </span>
                  </div>
                  <input
                    type="range" min={-500} max={500} step={50}
                    value={t.basis.goalDelta}
                    onChange={e => { setTargets({ goalDelta: parseInt(e.target.value, 10) }); bump() }}
                    className="w-full accent-accent"
                  />
                  <p className="font-sans text-[11px] text-text-faint mt-1">
                    Below maintenance to cut, above to build.
                  </p>
                </div>

                {(t.basis.activityFactor !== DEFAULT_ACTIVITY || t.basis.goalDelta !== DEFAULT_GOAL_DELTA) && (
                  <button
                    onClick={() => { clearTarget('activityFactor'); clearTarget('goalDelta'); bump() }}
                    className="self-start bg-transparent border-none p-0 font-mono text-[10px] text-text-faint uppercase tracking-[0.06em] cursor-pointer"
                  >
                    Reset to {DEFAULT_ACTIVITY}× and +{DEFAULT_GOAL_DELTA}
                  </button>
                )}

                <p className="font-sans text-[11.5px] text-text-faint leading-[16px]">
                  Carbs fill whatever calories protein and fat leave over, so the four always agree
                  {reconciles ? '.' : ' — pin fewer of them if they stop adding up.'}
                </p>
              </div>
            )}
          </Card>
        </div>

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
