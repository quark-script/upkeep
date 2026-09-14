import { useMemo, useState } from 'react'
import { subDays } from 'date-fns'
import { Pill as PillIcon, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { dateKey, parseKey, todayKey } from '../lib/date'
import {
  isDue, scheduleLabel, nextDueLabel, adherence, SLOT_ORDER, SLOT_LABELS,
} from '../lib/routines'
import { ScheduleEditor } from './ScheduleEditor'
import type { Medicine, MedForm, DaySlot } from '../lib/types'
import { Card, Btn, Pill } from './ui'

const FORMS: MedForm[] = ['tablet', 'capsule', 'sachet', 'drops', 'injection', 'other']

function readChecks(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

// ─── Editor sheet ─────────────────────────────────────────────────────────────

function MedEditor({
  med,
  onSave,
  onDelete,
  onClose,
}: {
  med: Medicine
  onSave: (m: Medicine) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Medicine>(med)
  const set = <K extends keyof Medicine>(k: K, v: Medicine[K]) => setDraft(d => ({ ...d, [k]: v }))

  const field =
    'w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3 font-sans text-[15px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">
            {onDelete ? 'Edit medicine' : 'Add medicine'}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer"
          >
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Name</label>
            <input
              autoFocus={!onDelete}
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Medication name"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Dose</label>
              <input
                value={draft.dose ?? ''}
                onChange={e => set('dose', e.target.value)}
                placeholder="250 mg"
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Form</label>
              <select
                value={draft.form ?? 'tablet'}
                onChange={e => set('form', e.target.value as MedForm)}
                className={`${field} capitalize`}
              >
                {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">When</label>
            <div className="grid grid-cols-5 gap-1.5">
              {SLOT_ORDER.map(s => (
                <button
                  key={s}
                  onClick={() => set('slot', s)}
                  className={[
                    'py-2 rounded-card border font-sans text-[10px] font-semibold uppercase tracking-[0.02em] cursor-pointer transition-colors',
                    draft.slot === s
                      ? 'bg-[var(--color-accent-soft)] border-accent text-accent'
                      : 'bg-panel-inset border-[var(--color-panel-border)] text-text-dim',
                  ].join(' ')}
                >
                  {SLOT_LABELS[s].slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          <ScheduleEditor value={draft.schedule} onChange={s => set('schedule', s)} />

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Note</label>
            <input
              value={draft.note ?? ''}
              onChange={e => set('note', e.target.value)}
              placeholder="e.g. with food"
              className={field}
            />
          </div>

          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-2 py-3 rounded-card bg-transparent border border-danger/40 text-danger font-sans text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer"
            >
              <Trash2 size={13} strokeWidth={1.8} /> Delete
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-7 shrink-0 border-t border-[var(--color-divider)]">
          <Btn fullWidth disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            Save
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function MedicinesCard({ date, isToday }: { date: string; isToday: boolean }) {
  // An empty list is a valid regimen for someone who does not take medicines.
  const [meds, setMeds] = useLocalStorage<Medicine[]>(KEYS.MEDICINES, [])
  const [taken, setTaken] = useLocalStorage<Record<string, boolean>>(KEYS.medsDay(date), {})
  const [editing, setEditing] = useState<Medicine | null>(null)
  const [adding, setAdding] = useState(false)

  const active = meds.filter(m => m.active)
  const dueToday = active.filter(m => isDue(m.schedule, date) && !(m.startedOn && date < m.startedOn))
  const notToday = active.filter(m => !dueToday.includes(m))
  const takenCount = dueToday.filter(m => taken[m.id]).length

  // 30-day adherence across everything scheduled.
  const stats = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => dateKey(subDays(parseKey(date), i)))
    const checks: Record<string, Record<string, boolean>> = {}
    days.forEach(d => { checks[d] = d === date ? taken : readChecks(KEYS.medsDay(d)) })
    return meds.filter(m => m.active).reduce(
      (acc, m) => {
        const a = adherence(m.schedule, checks, m.id, days, m.startedOn)
        return { taken: acc.taken + a.taken, expected: acc.expected + a.expected }
      },
      { taken: 0, expected: 0 },
    )
  }, [meds, date, taken])

  const pct = stats.expected > 0 ? Math.round((stats.taken / stats.expected) * 100) : null

  const upsert = (m: Medicine) => {
    setMeds(prev => (prev.some(x => x.id === m.id) ? prev.map(x => (x.id === m.id ? m : x)) : [...prev, m]))
    setEditing(null)
    setAdding(false)
  }

  const remove = (id: string) => {
    setMeds(prev => prev.filter(x => x.id !== id))
    setEditing(null)
  }

  const row = (m: Medicine, due: boolean, isLast: boolean) => {
    const on = !!taken[m.id]
    return (
      <div
        key={m.id}
        className={[
          'w-full flex items-center gap-3 px-[18px] transition-colors',
          on ? 'bg-[var(--color-accent-soft)]' : 'bg-transparent',
          !isLast ? 'border-b border-[var(--color-divider)]' : '',
        ].join(' ')}
      >
        <button
          onClick={() => setTaken(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
          className="flex-1 min-w-0 flex items-center gap-3.5 py-3.5 text-left bg-transparent border-none cursor-pointer"
        >
          <span
            className={[
              'w-[22px] h-[22px] rounded-card flex items-center justify-center shrink-0 transition-colors',
              on ? 'bg-accent' : due ? 'bg-transparent border border-[var(--color-panel-border)]' : 'bg-transparent border border-dashed border-[var(--color-panel-border)]',
            ].join(' ')}
          >
            {on && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#EDEAE3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-1.5">
              <span className={`font-sans text-[14px] font-medium truncate ${on ? 'text-text-dim line-through decoration-text-faint' : 'text-text'}`}>
                {m.name}
              </span>
              {m.dose && <span className="font-mono text-[11px] text-accent shrink-0">{m.dose}</span>}
            </span>
            <span className="block font-mono text-[10px] text-text-dim tracking-[0.03em] mt-0.5 truncate">
              {due ? scheduleLabel(m.schedule) : nextDueLabel(m.schedule, date) ?? 'As needed'}
              {m.note ? ` · ${m.note}` : ''}
            </span>
          </span>
        </button>
        <button
          onClick={() => setEditing(m)}
          aria-label={`Edit ${m.name}`}
          className="w-7 h-7 flex items-center justify-center bg-transparent border-none cursor-pointer text-text-faint hover:text-text transition-colors shrink-0"
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
      </div>
    )
  }

  return (
    <Card noPad>
      <div className="px-[18px] pt-[18px] pb-3.5 flex items-center gap-3.5 border-b border-[var(--color-divider)]">
        <div className="w-10 h-10 rounded-card bg-panel-inset border border-[var(--color-panel-border)] flex items-center justify-center shrink-0">
          <PillIcon size={18} strokeWidth={1.6} className="text-text" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.12em]">
            {isToday ? 'Medicines today' : 'Medicines'}
          </p>
          <p className="font-serif text-[22px] text-text font-medium tracking-[-0.03em] mt-0.5">
            {dueToday.length === 0
              ? 'Nothing due.'
              : takenCount === dueToday.length ? 'All taken.' : `${dueToday.length - takenCount} to take.`}
          </p>
        </div>
        {pct != null && (
          <Pill color={pct >= 90 ? 'success' : pct >= 70 ? 'warn' : 'danger'}>{pct}% · 30D</Pill>
        )}
      </div>

      {dueToday.map((m, i) => row(m, true, i === dueToday.length - 1 && notToday.length === 0))}

      {notToday.length > 0 && (
        <>
          <div className="px-[18px] py-2 bg-panel-inset/40 border-y border-[var(--color-divider)]">
            <p className="font-mono text-[9px] text-text-faint uppercase tracking-[0.1em]">Not scheduled today</p>
          </div>
          {notToday.map((m, i) => row(m, false, i === notToday.length - 1))}
        </>
      )}

      {active.length === 0 && (
        <p className="font-sans text-[13px] text-text-dim text-center px-6 py-8 leading-[19px]">
          No medicines yet. Add what you take and how often — Upkeep tracks the rest.
        </p>
      )}

      <button
        onClick={() => setAdding(true)}
        className="w-full py-3 px-[18px] bg-transparent border-none border-t border-dashed border-[var(--color-divider)] flex items-center justify-center gap-2 text-text-dim font-sans text-[12px] uppercase tracking-[0.08em] font-medium cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.8} /> Add medicine
      </button>

      {editing && (
        <MedEditor
          med={editing}
          onSave={upsert}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <MedEditor
          med={{
            id: crypto.randomUUID(),
            name: '',
            form: 'tablet',
            schedule: { kind: 'daily' },
            slot: 'morning' as DaySlot,
            startedOn: todayKey(),
            active: true,
          }}
          onSave={upsert}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  )
}
