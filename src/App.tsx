import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar, BottomBar } from './components/Navigation'
import Today from './routes/Today'
import Workout from './routes/Workout'
import Progress from './routes/Progress'
import Daily from './routes/Daily'
import History from './routes/History'
import Settings from './routes/Settings'
import Onboarding from './routes/Onboarding'
import { useLocalStorage } from './hooks/useLocalStorage'
import { KEYS } from './lib/storage'
import { LogDateProvider } from './lib/dateContext'
import { RestTimerProvider } from './lib/restTimer'
import { ToastProvider } from './lib/toast'
import { RestTimerBar } from './components/RestTimerBar'
import type { Profile } from './lib/types'

export default function App() {
  const [profile] = useLocalStorage<Profile | null>(KEYS.PROFILE, null)
  const [boarded, setBoarded] = useState(false)

  const showOnboarding = !profile && !boarded

  return (
    <LogDateProvider>
      <RestTimerProvider>
        <ToastProvider>
          {showOnboarding && <Onboarding onComplete={() => setBoarded(true)} />}

          <div className="flex h-full overflow-hidden bg-vault text-text">
            <Sidebar />

            <main className="flex-1 overflow-y-auto pb-36 md:pb-0">
              <div className="max-w-[720px] mx-auto px-4 md:px-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/today" replace />} />
                  <Route path="/today"    element={<Today />} />
                  <Route path="/workout"  element={<Workout />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/daily"    element={<Daily />} />
                  <Route path="/history"  element={<History />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </main>

            <RestTimerBar />
            <BottomBar />
          </div>
        </ToastProvider>
      </RestTimerProvider>
    </LogDateProvider>
  )
}
