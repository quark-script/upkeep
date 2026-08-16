import {
  createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode,
} from 'react'
import { KEYS } from './storage'
import type { Settings } from './types'

export const REST_DEFAULT = 90 // seconds

function readSettings(): Settings | null {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SETTINGS) ?? 'null') as Settings | null
  } catch {
    return null
  }
}

export function restDefaultSeconds(): number {
  const s = readSettings()?.restSeconds
  return typeof s === 'number' && s > 0 ? s : REST_DEFAULT
}

// Off by default: sets often get logged in batches (a whole exercise at once,
// or several sets after the fact), where a countdown firing is just noise.
export function restAutoStart(): boolean {
  return readSettings()?.restAuto === true
}

// Two short blips. Built on demand — the caller is always inside a tap handler,
// so the AudioContext is allowed to start.
function chime() {
  if (readSettings()?.restSound === false) return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const now = ctx.currentTime
    ;[0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 0 ? 660 : 880
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    })
    setTimeout(() => ctx.close().catch(() => {}), 800)
  } catch {}
}

interface RestTimerValue {
  /** Seconds left, or null when no rest is running. */
  remaining: number | null
  /** Total seconds the current rest was started with (for the progress ring). */
  total: number
  start: (seconds?: number) => void
  stop: () => void
  add: (deltaSeconds: number) => void
}

const RestTimerContext = createContext<RestTimerValue | null>(null)

interface RestState {
  /** Absolute end timestamp, so the countdown stays true across route changes,
   *  backgrounding and reloads. Null when no rest is running. */
  endAt: number | null
  /** What the current rest started at, for the progress fill. */
  total: number
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestState>(() => {
    try {
      const raw = localStorage.getItem(KEYS.REST_END)
      if (!raw) return { endAt: null, total: REST_DEFAULT }
      const saved = JSON.parse(raw) as Partial<RestState>
      const total = typeof saved.total === 'number' && saved.total > 0 ? saved.total : REST_DEFAULT
      const endAt = typeof saved.endAt === 'number' && saved.endAt > Date.now() ? saved.endAt : null
      return { endAt, total }
    } catch {
      return { endAt: null, total: REST_DEFAULT }
    }
  })
  const [remaining, setRemaining] = useState<number | null>(null)
  // Guards against chiming twice for one rest if the effect re-runs.
  const chimedFor = useRef<number | null>(null)

  const { endAt, total } = state

  useEffect(() => {
    try {
      if (endAt == null) localStorage.removeItem(KEYS.REST_END)
      else localStorage.setItem(KEYS.REST_END, JSON.stringify({ endAt, total }))
    } catch {}
  }, [endAt, total])

  useEffect(() => {
    if (endAt == null) { setRemaining(null); return }
    const tick = () => {
      const rem = Math.round((endAt - Date.now()) / 1000)
      setRemaining(Math.max(0, rem))
      if (rem <= 0) {
        if (chimedFor.current !== endAt) {
          chimedFor.current = endAt
          navigator.vibrate?.([60, 40, 60])
          chime()
        }
        setState(s => (s.endAt === endAt ? { ...s, endAt: null } : s))
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endAt])

  // Every updater below is pure — StrictMode invokes them twice, so mutating a
  // ref in here would double-apply the change.
  const start = useCallback((seconds?: number) => {
    const secs = seconds ?? restDefaultSeconds()
    setState({ endAt: Date.now() + secs * 1000, total: secs })
  }, [])

  const stop = useCallback(() => {
    setState(s => ({ ...s, endAt: null }))
  }, [])

  const add = useCallback((delta: number) => {
    setState(s => ({
      endAt: Math.max(Date.now() + 1000, (s.endAt ?? Date.now()) + delta * 1000),
      total: Math.max(s.total + delta, 5),
    }))
  }, [])

  return (
    <RestTimerContext.Provider value={{ remaining, total, start, stop, add }}>
      {children}
    </RestTimerContext.Provider>
  )
}

export function useRestTimer(): RestTimerValue {
  const v = useContext(RestTimerContext)
  if (!v) throw new Error('useRestTimer must be used within RestTimerProvider')
  return v
}
