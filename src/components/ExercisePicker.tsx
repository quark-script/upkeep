import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { resolveLibrary, searchLibrary, upsertCustom } from '../lib/library'
import type { Exercise, WorkoutType } from '../lib/types'
import { Pill, Btn } from './ui'

interface Props {
  open: boolean
  type: WorkoutType
  /** Ids already on the screen, offered as a jump-to rather than hidden. */
  present: Set<string>
  title?: string
  /** `wasExisting` distinguishes "found your lift" from "created a new one". */
  onPick: (ex: Exercise, wasExisting: boolean) => void
  onClose: () => void
}

export function ExercisePicker({ open, type, present, title = 'Add exercise', onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [newExName, setNewExName] = useState('')

  // The component stays mounted with `open` as a prop, and callers can close it
  // without going through `close()` (picking a lift does), so reopening would
  // otherwise show the last query or a half-filled custom-name form.
  useEffect(() => {
    if (!open) { setQuery(''); setAddingCustom(false); setNewExName('') }
  }, [open])

  if (!open) return null

  const close = () => { setQuery(''); setAddingCustom(false); setNewExName(''); onClose() }

  const handleAddCustom = () => {
    const name = newExName.trim()
    if (!name) return
    // Snapshot first: upsertCustom silently returns an existing lift when the
    // name (or one of its aliases) is already known, and the caller needs to be
    // able to say so instead of appearing to do nothing.
    const beforeIds = new Set(resolveLibrary().map(e => e.id))
    const ex = upsertCustom(name)
    onPick(ex, beforeIds.has(ex.id))
  }

  const list = searchLibrary(query, type).filter(e => !present.has(e.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md bg-panel border border-[var(--color-panel-border)] rounded-t-[24px] md:rounded-card-lg shadow-card flex flex-col max-h-[78vh] mb-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em]">{title}</p>
          <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-full bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer">
            <X size={13} strokeWidth={2} className="text-text-dim" />
          </button>
        </div>

        {addingCustom ? (
          <div className="px-5 pb-6 flex flex-col gap-3">
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em]">Custom exercise name</p>
            <input
              autoFocus
              value={newExName}
              onChange={e => setNewExName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); if (e.key === 'Escape') setAddingCustom(false) }}
              placeholder="e.g. Cable Pullover"
              className="bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3 font-sans text-[15px] text-text outline-none focus:border-accent placeholder:text-text-faint transition-colors"
            />
            <p className="font-sans text-[12px] text-text-faint leading-[17px]">
              Saved to your library. It'll be searchable next time, and its history stays with it.
            </p>
            <div className="flex gap-2">
              <Btn onClick={handleAddCustom} disabled={!newExName.trim()} className="flex-1">Add</Btn>
              <Btn variant="secondary" onClick={() => { setAddingCustom(false); setNewExName('') }} className="flex-1">Back</Btn>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5">
                <Search size={15} strokeWidth={1.8} className="text-text-faint shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search exercises…"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-sans text-[14px] text-text placeholder:text-text-faint"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-text-faint shrink-0"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto px-3 pb-3 flex-1">
              {list.length === 0 ? (
                <p className="text-center font-sans text-[13px] text-text-dim py-8">
                  No matches. Add it as a custom exercise below.
                </p>
              ) : (
                list.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => onPick(ex, true)}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-card text-left bg-transparent border-none cursor-pointer hover:bg-panel-inset transition-colors"
                  >
                    <Plus size={14} strokeWidth={2} className="text-text-faint shrink-0" />
                    <span className="flex-1 min-w-0 font-sans text-[14px] text-text font-medium truncate">{ex.name}</span>
                    {ex.custom
                      ? <Pill color="dim">YOURS</Pill>
                      : !ex.day.includes(type) && ex.day[0] && <Pill color="dim">{ex.day[0]}</Pill>}
                    <span className="font-mono text-[10px] text-text-dim tracking-[0.04em] shrink-0">{ex.defaultReps}</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => { setAddingCustom(true); setNewExName(query) }}
              className="flex items-center justify-center gap-2 px-5 pt-4 pb-7 border-t border-[var(--color-divider)] bg-transparent border-x-0 border-b-0 font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] font-medium cursor-pointer"
            >
              <Plus size={13} strokeWidth={1.8} /> Custom exercise
            </button>
          </>
        )}
      </div>
    </div>
  )
}
