import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trash2, ChevronRight, FileJson, FileText, ClipboardList,
  Save, Upload, Dumbbell, Apple, History, AlertTriangle,
} from 'lucide-react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS, PREFIX } from '../lib/storage'
import { PageTitle, Card, Divider, Btn, SectionLabel } from '../components/ui'
import { GitHubMark } from '../components/Navigation'
import { reportToJSON, sessionsToCSV, measurementsToCSV, sleepToCSV, foodToCSV, buildWeeklyDigest } from '../lib/export'
import { backupToJSON, markBackedUp, lastBackupAt, restoreBackup, type RestoreMode } from '../lib/backup'
import { snapshots, restoreSnapshot, discardSnapshot, migrationFailures, type SnapshotInfo } from '../lib/migrations'
import { useToast } from '../lib/toast'
import CloudSync from '../components/CloudSync'
import { markThisDeviceAuthoritative, signOutCloud } from '../lib/sync'
import type { Session, MeasurementEntry, Profile } from '../lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RowItem({
  icon: Icon,
  label,
  sub,
  onClick,
  danger,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left bg-transparent border-none cursor-pointer transition-colors hover:bg-panel-inset/50"
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

// ─── Reset confirm modal ──────────────────────────────────────────────────────

function ResetModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-24 md:p-4 md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-6">
        <p className="font-serif text-[22px] font-medium text-text tracking-[-0.03em] mb-2">Reset all data?</p>
        <p className="font-sans text-[13px] text-text-dim leading-[20px] mb-4">
          This permanently deletes every session, measurement, sleep log, and food entry on this device. Cannot be undone. This device is signed out of cloud backup; the cloud copy is not affected.
        </p>
        <p className="font-sans text-[12px] text-warn leading-[18px] mb-6">
          Download a backup first if there's any chance you'll want this data back.
        </p>
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={onCancel} className="flex-1">Cancel</Btn>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-card bg-danger text-accent-text font-sans font-semibold text-[13px] uppercase tracking-[0.04em] border-none cursor-pointer transition-all active:scale-[0.98]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Restore confirm modal ────────────────────────────────────────────────────

function RestoreModal({
  filename,
  onChoose,
  onCancel,
}: {
  filename: string
  onChoose: (mode: RestoreMode) => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-24 md:p-4 md:items-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-6">
        <p className="font-serif text-[22px] font-medium text-text tracking-[-0.03em] mb-1">Restore backup</p>
        <p className="font-mono text-[11px] text-text-dim tracking-[0.02em] mb-5 truncate">{filename}</p>

        <button
          onClick={() => onChoose('merge')}
          className="w-full text-left px-4 py-3.5 rounded-card bg-panel-inset border border-[var(--color-panel-border)] cursor-pointer mb-2.5"
        >
          <p className="font-sans text-[14px] text-text font-medium">Merge</p>
          <p className="font-sans text-[12px] text-text-dim leading-[17px] mt-0.5">
            Keeps everything already here and adds only what's missing. Nothing is overwritten.
          </p>
        </button>

        <button
          onClick={() => onChoose('replace')}
          className="w-full text-left px-4 py-3.5 rounded-card bg-transparent border border-danger/40 cursor-pointer mb-5"
        >
          <p className="font-sans text-[14px] text-danger font-medium">Replace everything</p>
          <p className="font-sans text-[12px] text-text-dim leading-[17px] mt-0.5">
            Wipes current data first, then restores the backup exactly as saved. If you're signed in, the cloud copy is replaced too.
          </p>
        </button>

        <Btn variant="secondary" fullWidth onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const toast = useToast()
  const [sessions]     = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [measurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])
  const [profile, setProfile] = useLocalStorage<Profile | null>(KEYS.PROFILE, null)
  const [nameDraft, setNameDraft] = useState(profile?.name ?? '')
  const [showReset, setShowReset] = useState(false)
  const navigate = useNavigate()
  const [snaps, setSnaps] = useState<SnapshotInfo[]>(() => snapshots())
  const [confirmRestore, setConfirmRestore] = useState<SnapshotInfo | null>(null)
  const failed = migrationFailures()
  const [exported, setExported]   = useState<'json' | 'csv' | null>(null)
  const [digestDone, setDigestDone] = useState(false)
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)
  const [backupAt, setBackupAt] = useState<number | null>(() => lastBackupAt())
  const fileRef = useRef<HTMLInputElement>(null)

  function saveName() {
    const name = nameDraft.trim()
    if (!name) { setNameDraft(profile?.name ?? ''); return }
    if (name === profile?.name) return
    setProfile({ ...(profile ?? {}), name })
    setNameDraft(name)
    toast({ message: 'Name saved.' })
  }

  function handleBackup() {
    downloadFile(backupToJSON(), `upkeep-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json')
    markBackedUp()
    setBackupAt(Date.now())
    toast({ message: 'Backup downloaded. Keep it somewhere off this device.' })
  }

  async function handleFilePicked(file: File | undefined) {
    if (!file) return
    try {
      setPending({ name: file.name, text: await file.text() })
    } catch {
      toast({ message: "Couldn't read that file." })
    }
  }

  function handleRestore(mode: RestoreMode) {
    if (!pending) return
    try {
      const r = restoreBackup(pending.text, mode)
      // Replace means "this is the truth now": without this, sync would merge
      // the cloud's copy straight back in on the next load.
      if (mode === 'replace') markThisDeviceAuthoritative()
      setPending(null)
      const parts = [
        `${r.sessions} session${r.sessions === 1 ? '' : 's'}`,
        `${r.measurements} measurement${r.measurements === 1 ? '' : 's'}`,
      ]
      // Reload so every screen re-reads storage from scratch.
      sessionStorage.setItem('upkeep:restore-note', `Restored ${parts.join(' and ')}.`)
      window.location.href = '/today'
    } catch (err) {
      setPending(null)
      toast({ message: err instanceof Error ? err.message : 'Restore failed.' })
    }
  }

  async function handleDigest() {
    const text = buildWeeklyDigest()
    try {
      await navigator.clipboard.writeText(text)
      setDigestDone(true)
      setTimeout(() => setDigestDone(false), 2000)
    } catch {
      downloadFile(text, `upkeep-digest-${format(new Date(), 'yyyy-MM-dd')}.md`, 'text/markdown')
    }
  }

  const sessionCount     = sessions.filter(s => s.finishedAt).length
  const measurementCount = measurements.length
  const firstDate        = sessions.length ? format(new Date(Math.min(...sessions.map(s => s.startedAt))), 'MMM yyyy') : null

  function handleExportJSON() {
    downloadFile(reportToJSON(), `upkeep-report-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json')
    setExported('json')
    setTimeout(() => setExported(null), 2000)
  }

  function handleExportCSV() {
    const date = format(new Date(), 'yyyy-MM-dd')
    const files = [
      { name: `upkeep-sessions-${date}.csv`,     content: sessionsToCSV(sessions)    },
      { name: `upkeep-measurements-${date}.csv`,  content: measurementsToCSV(measurements) },
      { name: `upkeep-sleep-${date}.csv`,          content: sleepToCSV()               },
      { name: `upkeep-food-${date}.csv`,           content: foodToCSV()                },
    ]
    files.forEach((f, i) => {
      setTimeout(() => downloadFile(f.content, f.name, 'text/csv'), i * 350)
    })
    setExported('csv')
    setTimeout(() => setExported(null), 2500)
  }

  async function handleReset() {
    // Sign this device out first. Sync is two-way, so a device still signed in
    // would pull the cloud copy straight back after the wipe. Signing out
    // leaves the cloud backup untouched, as the dialog promises.
    try { await signOutCloud() } catch (err) { console.warn('[reset] sign-out failed', err) }
    // Wipe every key this app owns, including any left under the old name
    const toDelete = Object.keys(localStorage).filter(k => k.startsWith(PREFIX) || k.startsWith('gainz:'))
    toDelete.forEach(k => localStorage.removeItem(k))
    setShowReset(false)
    // Reload to reinitialise state
    window.location.href = '/today'
  }

  return (
    <>
      <div className="pt-6 pb-8 flex flex-col gap-5">
        <PageTitle kicker="Profile, data and sync" title="Settings." />

        {/* ── Profile ── */}
        <div>
          <SectionLabel>Profile</SectionLabel>
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-pill bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0 font-mono text-[13px] text-accent font-semibold">
                {(profile?.name || 'UK').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="profile-name" className="font-mono text-[11px] text-text-dim uppercase tracking-[0.08em]">Name</label>
                <input
                  id="profile-name"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                  placeholder="Your first name"
                  className="w-full bg-transparent border-none outline-none font-serif text-[18px] text-text p-0 mt-0.5 placeholder:text-text-faint"
                />
              </div>
            </div>
            <Divider className="my-3.5" />
            <p className="font-mono text-[11px] text-text-dim tracking-[0.02em]">
              {sessionCount} session{sessionCount === 1 ? '' : 's'} · {measurementCount} measurement{measurementCount === 1 ? '' : 's'}
              {firstDate ? ` · since ${firstDate}` : ''}
            </p>
          </Card>
        </div>

        {/* ── Tracking ── */}
        <div>
          <SectionLabel>Tracking</SectionLabel>
          <Card noPad>
            <RowItem
              icon={Dumbbell}
              label="Exercises"
              sub="Day plans, rep ranges, custom lifts"
              onClick={() => navigate('/settings/exercises')}
            />
            <Divider />
            <RowItem
              icon={Apple}
              label="Nutrition"
              sub="Calorie and macro targets, your foods"
              onClick={() => navigate('/settings/nutrition')}
            />
          </Card>
        </div>

        {failed.length > 0 && (
          <div>
            <SectionLabel>Attention</SectionLabel>
            <Card>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-warn/10">
                  <AlertTriangle size={15} strokeWidth={1.7} className="text-warn" />
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[14px] text-text font-medium">
                    A data update didn't finish
                  </p>
                  <p className="font-sans text-[12.5px] text-text-dim leading-[17px] mt-1">
                    Some of your older records may still look wrong. Nothing was lost: the app
                    will try again next time you open it. Download a backup first if you plan to
                    keep using it today.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Cloud backup ── */}
        <CloudSync onRestore={(name, text) => setPending({ name, text })} />

        {/* ── Backup and export ── */}
        <div>
          <SectionLabel>Backup and export</SectionLabel>
          <Card noPad>
            <RowItem
              icon={Save}
              label="Download backup"
              sub={backupAt ? `Last backup ${formatDistanceToNowStrict(backupAt)} ago` : 'Never backed up'}
              onClick={handleBackup}
            />
            <Divider />
            <RowItem
              icon={Upload}
              label="Restore from backup"
              sub="Merge into what's here, or replace it"
              onClick={() => fileRef.current?.click()}
            />
            <Divider />
            <RowItem
              icon={ClipboardList}
              label={digestDone ? 'Copied to clipboard!' : 'Copy weekly digest'}
              sub="Last 7 days in Markdown, for a coach or an AI"
              onClick={handleDigest}
            />
            <Divider />
            <RowItem
              icon={FileJson}
              label={exported === 'json' ? 'Downloaded!' : 'Export report (JSON)'}
              sub="Readable by people and AI: names, notes, units"
              onClick={handleExportJSON}
            />
            <Divider />
            <RowItem
              icon={FileText}
              label={exported === 'csv' ? 'Downloaded!' : 'Export as CSV'}
              sub="Four files: sessions, measurements, sleep, food"
              onClick={handleExportCSV}
            />
          </Card>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => { void handleFilePicked(e.target.files?.[0]); e.target.value = '' }}
          />
          {!backupAt && sessions.length > 0 && (
            <p className="font-sans text-[12px] text-warn leading-[17px] px-1 mt-2">
              Everything lives in this browser's storage. Clearing site data wipes it, so keep a backup file.
            </p>
          )}
        </div>

        {/* ── Restore points ── */}
        {snaps.length > 0 && (
          <div>
            <SectionLabel>Advanced: restore points</SectionLabel>
            <Card noPad>
              {snaps.map((snap, i) => (
                <div key={snap.id}>
                  {i > 0 && <Divider />}
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 bg-panel-inset">
                      <History size={15} strokeWidth={1.6} className="text-text-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[14px] text-text font-medium truncate">
                        Before {snap.id.replace(/-v\d+$/, '').replace(/-/g, ' ')}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim mt-0.5">
                        {format(snap.at, 'MMM d')} · {Math.round(snap.bytes / 1024)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmRestore(snap)}
                      className="px-3 py-2 rounded-card bg-transparent border border-[var(--color-panel-border)] font-sans text-[11px] uppercase tracking-[0.04em] text-text-dim cursor-pointer shrink-0"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        discardSnapshot(snap.id)
                        setSnaps(snapshots())
                        toast({ message: 'Restore point deleted' })
                      }}
                      aria-label="Delete restore point"
                      className="w-11 h-11 flex items-center justify-center rounded-card bg-transparent border-none cursor-pointer text-text-faint hover:text-danger transition-colors shrink-0"
                    >
                      <Trash2 size={14} strokeWidth={1.7} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
            <p className="font-sans text-[11.5px] text-text-faint leading-[16px] px-1 mt-2">
              Saved automatically before the app reorganised your old records. Delete them once
              everything looks right. They take up real space.
            </p>
          </div>
        )}

        {/* ── About ── */}
        <div>
          <SectionLabel>About</SectionLabel>
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-accent flex items-center justify-center shrink-0">
                <span className="font-mono font-bold text-[13px] text-accent-text leading-none">UK</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-[16px] text-text font-medium tracking-[-0.02em]">Upkeep</p>
                <p className="font-mono text-[11px] text-text-dim tracking-[0.02em] mt-0.5">v0.1.0 · Works offline · AGPL-3.0</p>
              </div>
            </div>
            <Divider className="my-3.5" />
            <a
              href="https://github.com/quark-script/upkeep"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 font-sans text-[14px] text-text hover:text-accent transition-colors"
            >
              <GitHubMark size={16} />
              <span className="flex-1">Open source on GitHub</span>
              <ChevronRight size={14} strokeWidth={1.6} className="text-text-faint" />
            </a>
          </Card>
        </div>

        {/* ── Danger ── */}
        <div>
          <SectionLabel>Danger zone</SectionLabel>
          <Card noPad>
            <RowItem
              icon={Trash2}
              label="Reset all data"
              sub="Permanently delete every record"
              onClick={() => setShowReset(true)}
              danger
            />
          </Card>
        </div>
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setConfirmRestore(null)} />
          <div className="relative w-full max-w-sm bg-panel border border-[var(--color-panel-border)] rounded-card-lg shadow-card p-5">
            <p className="font-serif text-[19px] text-text font-medium tracking-[-0.02em]">
              Roll back to this point?
            </p>
            <p className="font-sans text-[13px] text-text-dim leading-[18px] mt-2">
              Everything goes back to how it was on {format(confirmRestore.at, 'MMM d')}, before the
              app reorganised your records. <span className="text-text">Anything you logged since
              then is deleted.</span> Download a backup first if you're not sure.
            </p>
            <div className="flex gap-2 mt-4">
              <Btn variant="secondary" onClick={() => setConfirmRestore(null)} className="flex-1">Cancel</Btn>
              <Btn
                onClick={() => {
                  const ok = restoreSnapshot(confirmRestore.id)
                  setConfirmRestore(null)
                  if (!ok) { toast({ message: "That restore point couldn't be read." }); return }
                  // A rollback is "this is the truth now"; without this, sync
                  // would merge the newer cloud copy straight back in.
                  markThisDeviceAuthoritative()
                  // Migrations run at startup, so the app has to come back up to
                  // re-apply them against the restored data.
                  sessionStorage.setItem('upkeep:restore-note', 'Rolled back to the earlier version.')
                  window.location.reload()
                }}
                className="flex-1"
              >
                Roll back
              </Btn>
            </div>
          </div>
        </div>
      )}

      {showReset && (
        <ResetModal
          onConfirm={() => void handleReset()}
          onCancel={() => setShowReset(false)}
        />
      )}

      {pending && (
        <RestoreModal
          filename={pending.name}
          onChoose={handleRestore}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}
