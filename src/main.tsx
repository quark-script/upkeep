import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { migrateLegacyKeys } from './lib/storage'
import { seedRoutineDefaults } from './lib/routines'
import './index.css'

// Both must run before any component reads storage, and in this order — the
// migration decides whether a key already exists under the current prefix.
migrateLegacyKeys()
seedRoutineDefaults()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
