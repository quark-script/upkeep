import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'upkeep:install-dismissed'

// Chrome fires `beforeinstallprompt` only when the app is installable and not
// already installed, so this stays hidden once Upkeep is on the home screen.
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!evt || hidden) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    setHidden(true)
  }

  return (
    <div className="bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-[10px] bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
        <Download size={16} strokeWidth={1.7} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[13px] text-text font-medium">Install Upkeep</p>
        <p className="font-sans text-[12px] text-text-dim leading-[17px] mt-0.5">
          Add it to your home screen — full screen, works offline.
        </p>
      </div>
      <button
        onClick={() => { void evt.prompt(); setEvt(null) }}
        className="shrink-0 px-3.5 py-2 rounded-card bg-accent text-accent-text font-sans text-[11px] font-semibold uppercase tracking-[0.06em] border-none cursor-pointer"
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 w-6 h-6 flex items-center justify-center bg-transparent border-none cursor-pointer text-text-faint"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
