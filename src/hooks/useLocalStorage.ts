import { useState, useCallback, useRef } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  // The value as of the last write. Functional updates build on it, so rapid
  // consecutive writes chain, and the write to storage happens right away: a state
  // updater only runs on the next render, which never comes for a component that
  // closes as it saves (onboarding finishing, a sheet closing).
  const latest = useRef(storedValue)

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const next = value instanceof Function ? value(latest.current) : value
      latest.current = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch (err) {
        console.warn(`useLocalStorage: failed to write "${key}"`, err)
      }
      setStoredValue(next)
    },
    [key]
  )

  return [storedValue, setValue] as const
}
