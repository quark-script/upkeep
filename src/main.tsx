import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { migrateLegacyKeys } from './lib/storage'
import { runMigrations } from './lib/migrations'
import { seedRoutineDefaults } from './lib/routines'
import { startSync } from './lib/sync'
import './index.css'

// All three must run before any component reads storage, and in this order:
// the rename decides whether a key already exists under the current prefix, and
// the data migrations then read those renamed keys.
migrateLegacyKeys()
runMigrations()
seedRoutineDefaults()

// Cloud backup runs behind everything else and is inert until signed in, so it
// starts after the local data is in its final shape and never blocks the mount.
startSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
