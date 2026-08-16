import {
  createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode,
} from 'react'

interface ToastSpec {
  message: string
  /** Optional single action, e.g. "Undo". Tapping it dismisses the toast. */
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

interface ToastItem extends ToastSpec { id: number }

const ToastContext = createContext<((t: ToastSpec) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(1)

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setToast(null)
  }, [])

  const show = useCallback((spec: ToastSpec) => {
    if (timer.current) clearTimeout(timer.current)
    const item = { ...spec, id: nextId.current++ }
    setToast(item)
    timer.current = setTimeout(() => setToast(null), spec.durationMs ?? 4500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed left-0 right-0 bottom-[92px] md:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            className="pointer-events-auto max-w-[420px] w-full bg-panel border border-[var(--color-panel-border)] rounded-card shadow-card flex items-center gap-3 pl-4 pr-2 py-2.5"
          >
            <span className="flex-1 min-w-0 font-sans text-[13px] text-text leading-[18px]">
              {toast.message}
            </span>
            {toast.actionLabel && (
              <button
                onClick={() => { toast.onAction?.(); clear() }}
                className="shrink-0 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-accent bg-transparent border-none cursor-pointer px-3 py-1.5"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const v = useContext(ToastContext)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
