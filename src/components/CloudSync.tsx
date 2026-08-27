import { useState } from 'react'
import { Cloud, CloudOff, Download, LogOut, ChevronRight } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Card, Divider, Btn } from './ui'
import { useToast } from '../lib/toast'
import { requestSignInCode, verifySignInCode } from '../lib/supabase'
import { useSyncStatus, fetchCloudBackup, signOutCloud } from '../lib/sync'

const inputClass =
  'w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3 py-2.5 ' +
  'font-sans text-[13px] text-text outline-none focus:border-accent transition-colors'

function Row({
  icon: Icon,
  label,
  sub,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer transition-colors hover:bg-panel-inset/50 disabled:opacity-50"
    >
      <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${danger ? 'bg-danger/10' : 'bg-panel-inset'}`}>
        <Icon size={16} strokeWidth={1.6} className={danger ? 'text-danger' : 'text-text-dim'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-sans text-[14px] font-medium ${danger ? 'text-danger' : 'text-text'}`}>{label}</p>
        {sub && <p className="font-mono text-[11px] text-text-dim mt-0.5 tracking-[0.02em]">{sub}</p>}
      </div>
      <ChevronRight size={14} strokeWidth={1.6} className="text-text-faint shrink-0" />
    </button>
  )
}

/**
 * Sign-in and status for the cloud replica.
 *
 * Restoring is handed back to Settings rather than done here, so the cloud copy
 * goes through the same confirm-then-restore path as a backup file.
 */
export default function CloudSync({ onRestore }: { onRestore: (name: string, text: string) => void }) {
  const toast = useToast()
  const status = useSyncStatus()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [working, setWorking] = useState(false)

  if (!status.configured) {
    return (
      <div>
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
          Cloud backup
        </p>
        <Card>
          <div className="flex items-center gap-2.5">
            <CloudOff size={15} strokeWidth={1.7} className="text-text-dim shrink-0" />
            <p className="font-sans text-[13px] text-text-dim leading-[19px]">
              Not configured on this build — no cloud keys. Backup files still work.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  async function handleSendCode() {
    if (!email.trim()) return
    setWorking(true)
    try {
      await requestSignInCode(email)
      setCodeSent(true)
      toast({ message: 'Code sent. Check your email.' })
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't send a code." })
    } finally {
      setWorking(false)
    }
  }

  async function handleVerify() {
    if (!code.trim()) return
    setWorking(true)
    try {
      await verifySignInCode(email, code)
      setCode('')
      setCodeSent(false)
      toast({ message: 'Signed in. Backing up in the background.' })
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'That code did not work.' })
    } finally {
      setWorking(false)
    }
  }

  async function handleRestore() {
    setWorking(true)
    try {
      onRestore('cloud backup', await fetchCloudBackup())
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Couldn't reach the cloud backup." })
    } finally {
      setWorking(false)
    }
  }

  async function handleSignOut() {
    setWorking(true)
    try {
      await signOutCloud()
      toast({ message: 'Signed out. This device keeps its data.' })
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Sign out failed.' })
    } finally {
      setWorking(false)
    }
  }

  const subtitle = (() => {
    if (status.error) return 'Sync failed — will retry'
    if (status.busy) return 'Backing up…'
    if (status.pending > 0) return `${status.pending} change${status.pending === 1 ? '' : 's'} waiting`
    if (status.lastPushAt) return `Backed up ${formatDistanceToNowStrict(status.lastPushAt)} ago`
    return 'Nothing backed up yet'
  })()

  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">
        Cloud backup
      </p>

      {status.signedIn ? (
        <>
          <Card noPad>
            <div className="w-full flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-panel-inset">
                {status.error
                  ? <CloudOff size={16} strokeWidth={1.6} className="text-warn" />
                  : <Cloud size={16} strokeWidth={1.6} className="text-text-dim" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[14px] font-medium text-text truncate">{status.email ?? 'Signed in'}</p>
                <p className="font-mono text-[11px] text-text-dim mt-0.5 tracking-[0.02em]">{subtitle}</p>
              </div>
            </div>
            <Divider />
            <Row
              icon={Download}
              label="Restore from cloud"
              sub="Merge into what's here, or replace it"
              onClick={() => void handleRestore()}
              disabled={working}
            />
            <Divider />
            <Row icon={LogOut} label="Sign out" sub="Stops backing up this device" onClick={() => void handleSignOut()} danger disabled={working} />
          </Card>
          {status.error && (
            <p className="font-sans text-[12px] text-warn leading-[17px] px-1 mt-2">{status.error}</p>
          )}
        </>
      ) : (
        <Card>
          <p className="font-sans text-[13px] text-text-dim leading-[19px] mb-3">
            Sign in to keep an encrypted-in-transit copy of your data off this device. Clearing site
            data or losing the phone stops meaning losing the log.
          </p>
          {!codeSent ? (
            <div className="flex flex-col gap-2.5">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
              />
              <Btn onClick={() => void handleSendCode()} disabled={working || !email.trim()} fullWidth>
                {working ? 'Sending…' : 'Email me a code'}
              </Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={code}
                onChange={e => setCode(e.target.value)}
                className={`${inputClass} font-mono tracking-[0.3em] text-center`}
              />
              <Btn onClick={() => void handleVerify()} disabled={working || !code.trim()} fullWidth>
                {working ? 'Checking…' : 'Sign in'}
              </Btn>
              <button
                onClick={() => { setCodeSent(false); setCode('') }}
                className="font-sans text-[12px] text-text-dim bg-transparent border-none cursor-pointer py-1"
              >
                Use a different email
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
