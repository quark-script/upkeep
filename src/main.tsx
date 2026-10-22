import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { migrateLegacyKeys } from './lib/storage'
import { runMigrations } from './lib/migrations'
import { startSync, markMounted } from './lib/sync'
import './index.css'

// Both must run before any component reads storage, and in this order:
// the rename decides whether a key already exists under the current prefix, and
// the data migrations then read those renamed keys.
migrateLegacyKeys()
runMigrations()

// Cloud sync starts after the local data is in its final shape and is inert
// until signed in. Wait briefly for the first pull so screens mount with this device already up
// to date; anything that lands later reloads the page instead (see sync.ts).
void startSync().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
  markMounted()
})
