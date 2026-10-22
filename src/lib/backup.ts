import { KEYS, PREFIX } from './storage'
import type { Session, MeasurementEntry } from './types'
import { merge3 } from './merge'

const LEGACY_PREFIX = 'gainz:'

// Transient state — never worth carrying between devices or restores.
//
// `SYNC_STATE` is load-bearing here: it records which keys this device has
// already pushed to the cloud. Carrying it onto another device — or restoring
// it onto a fresh install — would convince that device everything was already
// uploaded, and it would never seed.
const SKIP_KEYS = new Set<string>([KEYS.REST_END, KEYS.LAST_BACKUP, KEYS.SYNC_STATE, KEYS.SYNC_OVERWRITE])

// Pre-migration snapshots are a local undo buffer, not portable data: they hold
// a full copy of everything else in this file, so carrying them would roughly
// double every backup for no gain on the other device.
// `KEYS.MIGRATIONS` is deliberately NOT skipped — without it a restore onto a
// fresh install would re-run every migration against already-migrated data.
const SKIP_PREFIXES = [`${PREFIX}snapshot:`]

/** True for keys that stay on this device: transient state and local snapshots. */
export function skipped(key: string): boolean {
  return SKIP_KEYS.has(key) || SKIP_PREFIXES.some(p => key.startsWith(p))
}

export interface BackupFile {
  app: string
  /** `gainz-backup` files predate the rename and are still accepted. */
  kind: 'upkeep-backup' | 'gainz-backup'
  version: 1
  exportedAt: string
  /** Raw localStorage entries, values still JSON-encoded. Lossless by design. */
  data: Record<string, string>
}

/** Bring a key from any backup vintage onto the current prefix. */
function currentKey(key: string): string | null {
  if (key.startsWith(PREFIX)) return key
  if (key.startsWith(LEGACY_PREFIX)) return PREFIX + key.slice(LEGACY_PREFIX.length)
  return null
}

export type RestoreMode = 'replace' | 'merge'

export interface RestoreResult {
  sessions: number
  measurements: number
  otherKeys: number
}

// A verbatim dump of every app-owned key. The JSON/CSV reports are for reading;
// this is the one that can actually put the app back the way it was.
export function buildBackup(): BackupFile {
  const data: Record<string, string> = {}
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX) || skipped(key)) continue
    const value = localStorage.getItem(key)
    if (value != null) data[key] = value
  }
  return {
    app: 'Upkeep',
    kind: 'upkeep-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function backupToJSON(): string {
  return JSON.stringify(buildBackup(), null, 2)
}

export function markBackedUp() {
  try { localStorage.setItem(KEYS.LAST_BACKUP, JSON.stringify(Date.now())) } catch {}
}

export function lastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(KEYS.LAST_BACKUP)
    const n = raw ? (JSON.parse(raw) as number) : null
    return typeof n === 'number' ? n : null
  } catch {
    return null
  }
}

function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  const b = parsed as Partial<BackupFile>
  const known = b?.kind === 'upkeep-backup' || b?.kind === 'gainz-backup'
  if (!known || typeof b.data !== 'object' || b.data == null) {
    throw new Error('Not an Upkeep backup file. Use a file created by "Download backup".')
  }
  return b as BackupFile
}

function readArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

// Restore a backup file.
//   replace — wipe local data first; the backup becomes the whole truth
//   merge   — keep everything local, add only what's missing (by session id /
//             measurement date / absent day-key), so nothing already here is lost
export function restoreBackup(text: string, mode: RestoreMode): RestoreResult {
  const backup = parseBackup(text)
  const incoming = backup.data
  const result: RestoreResult = { sessions: 0, measurements: 0, otherKeys: 0 }

  if (mode === 'replace') {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX) || key.startsWith(LEGACY_PREFIX)) localStorage.removeItem(key)
    }
  }

  for (const [rawKey, value] of Object.entries(incoming)) {
    // Old backups carry `gainz:` keys; land them on the current prefix.
    const key = currentKey(rawKey)
    if (key == null || skipped(key)) continue

    if (mode === 'replace') {
      localStorage.setItem(key, value)
      if (key === KEYS.SESSIONS) result.sessions = readArray<Session>(value).length
      else if (key === KEYS.MEASUREMENTS) result.measurements = readArray<MeasurementEntry>(value).length
      else result.otherKeys++
      continue
    }

    // ── merge ──
    if (key === KEYS.SESSIONS) {
      const mine = readArray<Session>(localStorage.getItem(KEYS.SESSIONS) ?? undefined)
      const seen = new Set(mine.map(s => s.id))
      const added = readArray<Session>(value).filter(s => s?.id && !seen.has(s.id))
      if (added.length) {
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify([...mine, ...added]))
        result.sessions = added.length
      }
    } else if (key === KEYS.MEASUREMENTS) {
      const mine = readArray<MeasurementEntry>(localStorage.getItem(KEYS.MEASUREMENTS) ?? undefined)
      const seen = new Set(mine.map(m => m.date))
      const added = readArray<MeasurementEntry>(value).filter(m => m?.date && !seen.has(m.date))
      if (added.length) {
        const merged = [...mine, ...added].sort((a, b) => a.date.localeCompare(b.date))
        localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify(merged))
        result.measurements = added.length
      }
    } else {
      const mine = localStorage.getItem(key)
      // An existing key used to be skipped outright, so a device holding only
      // the empty starter medicines list never received the backup's real one.
      // Merge instead: lists by item id, objects by field, and this device wins
      // only where both hold a different value for the same item.
      const merged = mine == null ? value : merge3(null, mine, value, 'local')
      if (merged !== mine) {
        localStorage.setItem(key, merged)
        result.otherKeys++
      }
    }
  }

  return result
}
