import { useState } from 'react'
import { Download, Trash2, Info, ChevronRight, FileJson, FileText, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { PageTitle, Card, Divider, Btn } from '../components/ui'
import { reportToJSON, sessionsToCSV, measurementsToCSV, sleepToCSV, proteinToCSV, buildWeeklyDigest } from '../lib/export'
import type { Session, MeasurementEntry } from '../lib/types'

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
        <p className="font-sans text-[13px] text-text-dim leading-[20px] mb-6">
          This permanently deletes every session, measurement, sleep log, and protein entry. Cannot be undone.
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const [sessions]     = useLocalStorage<Session[]>(KEYS.SESSIONS, [])
  const [measurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])
  const [showReset, setShowReset] = useState(false)
  const [exported, setExported]   = useState<'json' | 'csv' | null>(null)
  const [digestDone, setDigestDone] = useState(false)

  async function handleDigest() {
    const text = buildWeeklyDigest()
    try {
      await navigator.clipboard.writeText(text)
      setDigestDone(true)
      setTimeout(() => setDigestDone(false), 2000)
    } catch {
      downloadFile(text, `gainz-digest-${format(new Date(), 'yyyy-MM-dd')}.md`, 'text/markdown')
    }
  }

  const sessionCount     = sessions.filter(s => s.finishedAt).length
  const measurementCount = measurements.length
  const firstDate        = sessions.length ? format(new Date(Math.min(...sessions.map(s => s.startedAt))), 'MMM yyyy') : null

  function handleExportJSON() {
    downloadFile(reportToJSON(), `gainz-report-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json')
    setExported('json')
    setTimeout(() => setExported(null), 2000)
  }

  function handleExportCSV() {
    const date = format(new Date(), 'yyyy-MM-dd')
    const files = [
      { name: `gainz-sessions-${date}.csv`,     content: sessionsToCSV(sessions)    },
      { name: `gainz-measurements-${date}.csv`,  content: measurementsToCSV(measurements) },
      { name: `gainz-sleep-${date}.csv`,          content: sleepToCSV()               },
      { name: `gainz-protein-${date}.csv`,        content: proteinToCSV()             },
    ]
    files.forEach((f, i) => {
      setTimeout(() => downloadFile(f.content, f.name, 'text/csv'), i * 350)
    })
    setExported('csv')
    setTimeout(() => setExported(null), 2500)
  }

  function handleReset() {
    // Wipe all gainz: keys
    const toDelete = Object.keys(localStorage).filter(k => k.startsWith('gainz:'))
    toDelete.forEach(k => localStorage.removeItem(k))
    setShowReset(false)
    // Reload to reinitialise state
    window.location.href = '/today'
  }

  return (
    <>
      <div className="pt-6 pb-8 flex flex-col gap-5">
        <PageTitle kicker="Settings" title="Data & App." />

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Sessions',     value: sessionCount },
            { label: 'Measurements', value: measurementCount },
            { label: 'Since',        value: firstDate ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-panel border border-[var(--color-panel-border)] rounded-card-lg p-3.5 text-center">
              <p className="font-mono text-[22px] font-medium text-text tracking-[-0.03em]">{value}</p>
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em] mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Share ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">Share</p>
          <Card noPad>
            <RowItem
              icon={ClipboardList}
              label={digestDone ? 'Copied to clipboard!' : 'Copy weekly digest'}
              sub="Last 7 days — for your human or AI trainer"
              onClick={handleDigest}
            />
          </Card>
        </div>

        {/* ── Export ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">Export</p>
          <Card noPad>
            <RowItem
              icon={FileJson}
              label={exported === 'json' ? 'Downloaded!' : 'Export report (JSON)'}
              sub="Trainer/AI-readable — names, notes, units"
              onClick={handleExportJSON}
            />
            <Divider />
            <RowItem
              icon={FileText}
              label={exported === 'csv' ? 'Downloaded!' : 'Export as CSV'}
              sub="Four files — sessions, measurements, sleep, protein"
              onClick={handleExportCSV}
            />
          </Card>
        </div>

        {/* ── Danger ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">Danger zone</p>
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

        {/* ── About ── */}
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium px-1 mb-2.5">About</p>
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-accent flex items-center justify-center shrink-0">
                <span className="font-mono font-bold text-[13px] text-accent-text leading-none">GZ</span>
              </div>
              <div>
                <p className="font-serif text-[16px] text-text font-medium tracking-[-0.02em]">GainZ</p>
                <p className="font-mono text-[11px] text-text-dim tracking-[0.02em] mt-0.5">v0.1.0 · Offline · PWA</p>
              </div>
            </div>
            <Divider className="my-3.5" />
            <div className="flex flex-col gap-2">
              {[
                ['Stack',    'React 18 · Vite 5 · Tailwind 3'],
                ['Storage',  'localStorage · no backend'],
                ['Theme',    'Vault — Graphite + Oxblood'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-baseline">
                  <span className="font-mono text-[10px] text-text-faint uppercase tracking-[0.06em]">{k}</span>
                  <span className="font-mono text-[11px] text-text-dim">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showReset && (
        <ResetModal
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)}
        />
      )}
    </>
  )
}
