import { createContext, useContext, useState, type ReactNode } from 'react'
import { todayKey } from './date'

interface LogDateValue {
  activeDate: string                 // yyyy-MM-dd — the day being logged/viewed
  setActiveDate: (d: string) => void
  isToday: boolean
}

const LogDateContext = createContext<LogDateValue | null>(null)

export function LogDateProvider({ children }: { children: ReactNode }) {
  // Defaults to today; not persisted — a fresh app launch starts on today.
  const [activeDate, setActiveDate] = useState<string>(todayKey())
  const value: LogDateValue = {
    activeDate,
    setActiveDate,
    isToday: activeDate === todayKey(),
  }
  return <LogDateContext.Provider value={value}>{children}</LogDateContext.Provider>
}

export function useLogDate(): LogDateValue {
  const v = useContext(LogDateContext)
  if (!v) throw new Error('useLogDate must be used within LogDateProvider')
  return v
}
