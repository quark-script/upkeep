import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { PREFIX, KEYS } from './storage'
import { skipped, type BackupFile } from './backup'
import { supabase } from './supabase'

/**
 * Mirrors this device's localStorage to Supabase so the data survives the
 * device. localStorage stays authoritative: nothing here ever writes to local
 * storage except an explicit restore the user asks for.
 *
 * Change detection is a dirty-scan rather than instrumented writes. The app has
 * ~76 localStorage call sites and many bypass the useLocalStorage hook, so
 * hashing every app-owned key and diffing against what was last pushed catches
 * every write path — including ones added later that forget to notify anything.
 *
 * Measured cost of one scan on a desktop core, over the real shape of this data
 * (one growing `sessions` blob plus ~400 day keys): 1.1 ms at 0.27 MB, 2.9 ms at
 * 0.67 MB. A phone several times slower still lands in the low tens of
 * milliseconds every 3 s, which is why the interval stays short — a longer one
 * would only widen the window in which a write is not yet backed up.
 */

const TABLE = 'upkeep_kv'
const SCAN_INTERVAL_MS = 3000
/** Rows per upsert, as a secondary bound behind the byte budget below. */
const MAX_CHUNK_ROWS = 200
/**
 * Byte budget per upsert. Row count alone does not bound a request: a single
 * year-long `sessions` value dwarfs hundreds of day keys put together.
 */
const MAX_CHUNK_BYTES = 512 * 1024
/** Rows per select page when pulling a restore. */
const PAGE = 1000
/** Give up on a scan after this many chunks fail in a row (offline, auth). */
const MAX_CONSECUTIVE_FAILURES = 3

export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email: string | null
  lastPushAt: number | null
  /** Keys known to differ from the cloud copy right now. */
  pending: number
  busy: boolean
  error: string | null
}

export interface Entry {
  hash: string
  updatedAt: string
}

export interface State {
  userId: string
  lastPushAt: number | null
  keys: Record<string, Entry>
}

interface Row {
  user_id: string
  key: string
  raw: string
  deleted: boolean
}

/** A row to push, plus what to record locally once the push succeeds. */
interface Item {
  row: Row
  entry: Entry
}

export interface Diff {
  /** Values that changed locally and must be written. */
  upserts: Item[]
  /** Keys deleted locally, flagged rather than overwritten. */
  tombstones: string[]
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * djb2, with the value's length appended.
 *
 * A 32-bit hash alone would collide often enough to matter across a few hundred
 * keys edited daily for years, and a collision here means a silently unsynced
 * change. Pairing it with the length makes an undetected edit need both the same
 * hash and the same length.
 */
export function hashValue(value: string): string {
  let h = 5381
  for (let i = 0; i < value.length; i++) {
    h = (((h << 5) + h) ^ value.charCodeAt(i)) >>> 0
  }
  return `${h.toString(36)}:${value.length.toString(36)}`
}

// ─── Local state ─────────────────────────────────────────────────────────────

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' && value !== null &&
    typeof (value as Entry).hash === 'string'
  )
}

export function readState(userId: string): State {
  try {
    const stored = localStorage.getItem(KEYS.SYNC_STATE)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<State> | null
      // State written for another account says nothing about this one; starting
      // fresh just re-pushes everything, which is safe.
      if (parsed && parsed.userId === userId && parsed.keys && !Array.isArray(parsed.keys)) {
        const keys: Record<string, Entry> = {}
        // Drop anything malformed rather than trusting it: a bad entry either
        // suppresses a push or invents a tombstone, and both are worse than a
        // redundant upload.
        for (const [key, entry] of Object.entries(parsed.keys)) {
          if (key.startsWith(PREFIX) && isEntry(entry)) keys[key] = entry
        }
        return {
          userId,
          lastPushAt: typeof parsed.lastPushAt === 'number' ? parsed.lastPushAt : null,
          keys,
        }
      }
    }
  } catch {
    // Unreadable state is not worth failing over — re-seed instead.
  }
  return { userId, lastPushAt: null, keys: {} }
}

function statePresent(): boolean {
  try {
    return localStorage.getItem(KEYS.SYNC_STATE) != null
  } catch {
    return false
  }
}

function persist(state: State): boolean {
  try {
    localStorage.setItem(KEYS.SYNC_STATE, JSON.stringify(state))
    return true
  } catch (err) {
    // A persistent failure here means the same rows are re-uploaded on every
    // scan forever, so it belongs in front of the user, not only the console.
    lastError = 'Could not save sync state on this device.'
    console.warn('[sync] could not persist sync state', err)
    return false
  }
}

/**
 * Persist progress, unless this device was wiped while the push was in flight.
 *
 * "Reset all data" and a `replace` restore delete every `upkeep:` key, this one
 * included, and that deletion is what protects the cloud copy: with no state,
 * the next scan sees no known keys and emits no tombstones. Re-creating the
 * state after such a wipe would describe keys that no longer exist locally, and
 * the very next scan would tombstone the entire replica. So a vanished state key
 * means the write is abandoned, not repeated.
 */
function persistProgress(state: State): boolean {
  if (!statePresent()) return false
  return persist(state)
}

export function clearSyncState(): void {
  try {
    localStorage.removeItem(KEYS.SYNC_STATE)
  } catch {
    // Nothing useful to do; the next push simply re-uploads.
  }
}

// ─── Diffing ─────────────────────────────────────────────────────────────────

/** Every app-owned key that belongs in the cloud, by key. */
export function collectLocal(): Map<string, string> {
  const out = new Map<string, string>()
  let keys: string[]
  try {
    keys = Object.keys(localStorage)
  } catch {
    return out
  }
  for (const key of keys) {
    if (!key.startsWith(PREFIX) || skipped(key)) continue
    const value = localStorage.getItem(key)
    if (value != null) out.set(key, value)
  }
  return out
}

export function buildDiff(state: State, local: Map<string, string>, userId: string): Diff {
  const now = new Date().toISOString()
  const upserts: Item[] = []

  for (const [key, value] of local) {
    const hash = hashValue(value)
    if (state.keys[key]?.hash === hash) continue
    upserts.push({
      row: { user_id: userId, key, raw: value, deleted: false },
      entry: { hash, updatedAt: now },
    })
  }

  // Not one app key left while the cloud knows of several: that is a wipe or a
  // storage read that failed, never a user deleting their whole log key by key
  // inside one 3-second tick. Tombstoning here would destroy the backup at the
  // exact moment it is the only copy, so leave the replica alone.
  if (local.size === 0 && Object.keys(state.keys).length > 0) return { upserts, tombstones: [] }

  // Known to the cloud but gone from this device, so a restore should not
  // resurrect it.
  const tombstones = Object.keys(state.keys).filter(key => !local.has(key))
  return { upserts, tombstones }
}

/** Split a list into batches of at most `MAX_CHUNK_ROWS`. */
function batchKeys(keys: string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < keys.length; i += MAX_CHUNK_ROWS) out.push(keys.slice(i, i + MAX_CHUNK_ROWS))
  return out
}

/** Group items into requests bounded by both byte size and row count. */
function chunk(items: Item[]): Item[][] {
  const chunks: Item[][] = []
  let current: Item[] = []
  let bytes = 0
  for (const item of items) {
    // Rough upper bound: JSON escaping and UTF-8 can inflate a string, and the
    // row's own fields add a little. Being wrong high only sends smaller requests.
    const size = item.row.raw.length * 2 + item.row.key.length + 128
    if (current.length > 0 && (current.length >= MAX_CHUNK_ROWS || bytes + size > MAX_CHUNK_BYTES)) {
      chunks.push(current)
      current = []
      bytes = 0
    }
    current.push(item)
    bytes += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

// ─── Status broadcast ────────────────────────────────────────────────────────

let currentUser: User | null = null
let pending = 0
let busy = false
let lastError: string | null = null
let lastPushAt: number | null = null

const listeners = new Set<() => void>()
let snapshot: SyncStatus = {
  configured: supabase != null,
  signedIn: false,
  email: null,
  lastPushAt: null,
  pending: 0,
  busy: false,
  error: null,
}

function notify(): void {
  const next: SyncStatus = {
    configured: supabase != null,
    signedIn: currentUser != null,
    email: currentUser?.email ?? null,
    lastPushAt,
    pending,
    busy,
    error: lastError,
  }
  // The idle scan runs every 3 s forever. Without this check it would hand
  // useSyncExternalStore a new object each time and re-render Settings on a
  // timer for as long as the screen is open.
  const same =
    next.configured === snapshot.configured &&
    next.signedIn === snapshot.signedIn &&
    next.email === snapshot.email &&
    next.lastPushAt === snapshot.lastPushAt &&
    next.pending === snapshot.pending &&
    next.busy === snapshot.busy &&
    next.error === snapshot.error
  if (same) return

  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncStatus(): SyncStatus {
  return snapshot
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus)
}

// ─── Push ────────────────────────────────────────────────────────────────────

let pushing = false

/**
 * Scan, diff, and push what changed.
 *
 * The state map advances only after a chunk lands, which makes the diff itself
 * the outbox: a failed request, a crash mid-flight, or a week offline all leave
 * the hashes stale and the next scan simply offers the same rows again. There is
 * no separate queue that can drift from reality.
 */
export async function flush(): Promise<void> {
  if (!supabase || !currentUser || pushing) return

  pushing = true
  const userId = currentUser.id
  try {
    const state = readState(userId)
    lastPushAt = state.lastPushAt
    const { upserts, tombstones } = buildDiff(state, collectLocal(), userId)
    pending = upserts.length + tombstones.length
    if (pending === 0) {
      lastError = null
      notify()
      return
    }

    // Offline is the normal case at a gym, not an error worth showing.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      lastError = null
      notify()
      return
    }

    // Claim the state key before the first request. From here on its absence
    // means a wipe happened mid-push, which persistProgress refuses to undo.
    if (!statePresent() && !persist(state)) {
      notify()
      return
    }

    busy = true
    notify()

    let firstError: string | null = null
    let consecutiveFailures = 0

    /** Record progress; false means stop (wiped, or signed out). */
    const commit = (keys: string[], entries: Item[] | null): boolean => {
      if (entries) for (const item of entries) state.keys[item.row.key] = item.entry
      else for (const key of keys) delete state.keys[key]
      state.lastPushAt = Date.now()
      if (!persistProgress(state)) return false
      lastPushAt = state.lastPushAt
      pending -= keys.length
      notify()
      return true
    }

    for (const slice of chunk(upserts)) {
      const { error } = await supabase
        .from(TABLE)
        .upsert(slice.map(item => item.row), { onConflict: 'user_id,key' })

      // Sign-out or an account switch during the request: this session's rows
      // are no longer ours to record, and the state it would write has just
      // been cleared on purpose.
      if (!currentUser || currentUser.id !== userId) return

      if (error) {
        // One permanently-rejected row must not strand every later chunk. Keep
        // going, leaving this chunk's hashes stale so it is retried next scan.
        firstError ??= `${error.message} (first stuck key: ${slice[0].row.key})`
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break
        continue
      }
      consecutiveFailures = 0
      if (!commit(slice.map(item => item.row.key), slice)) return
    }

    // Deletions flip the flag and nothing else. Overwriting `raw` with null
    // would make a mistaken tombstone unrecoverable, and this is the only path
    // in the whole module that can destroy data rather than merely fail to
    // save it — `fetchCloudBackup` filters on `deleted`, so the bytes it leaves
    // behind cost nothing and buy a one-line recovery.
    for (const batch of batchKeys(tombstones)) {
      const { error } = await supabase
        .from(TABLE)
        .update({ deleted: true })
        .eq('user_id', userId)
        .in('key', batch)

      if (!currentUser || currentUser.id !== userId) return

      if (error) {
        firstError ??= `${error.message} (first stuck key: ${batch[0]})`
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break
        continue
      }
      consecutiveFailures = 0
      if (!commit(batch, null)) return
    }

    lastError = firstError
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    console.warn('[sync] push failed', err)
  } finally {
    pushing = false
    busy = false
    notify()
  }
}

// ─── Restore ─────────────────────────────────────────────────────────────────

/**
 * Pull the cloud copy as a backup file.
 *
 * Deliberately returns the same JSON shape the Download-backup button produces,
 * so restoring from the cloud goes through the existing, already-tested
 * `restoreBackup()` rather than a second restore implementation.
 */
export async function fetchCloudBackup(): Promise<string> {
  if (!supabase || !currentUser) throw new Error('Not signed in.')

  const data: Record<string, string> = {}
  let from = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from(TABLE)
      .select('key, raw')
      .eq('user_id', currentUser.id)
      .eq('deleted', false)
      .order('key')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) break
    for (const row of rows as { key: string; raw: string | null }[]) {
      if (typeof row.raw === 'string') data[row.key] = row.raw
    }
    // Advance by what actually came back, never by the page size: PostgREST
    // caps responses at the project's `max_rows`, and assuming a full page
    // would silently truncate the restore the moment that cap is lower.
    from += rows.length
  }

  if (Object.keys(data).length === 0) throw new Error('Nothing backed up to this account yet.')

  const file: BackupFile = {
    app: 'Upkeep',
    kind: 'upkeep-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  return JSON.stringify(file)
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function signOutCloud(): Promise<void> {
  if (!supabase) return
  try {
    // Local scope so signing out works with no network. The session is this
    // device's to drop; there is nothing to revoke elsewhere on a single device.
    await supabase.auth.signOut({ scope: 'local' })
  } finally {
    // The next sign-in re-seeds from scratch rather than trusting a map that
    // describes what some other session uploaded.
    clearSyncState()
  }
}

function setUser(user: User | null): void {
  const changed = user?.id !== currentUser?.id
  currentUser = user
  if (changed) {
    // An error from the previous session says nothing about this one.
    lastError = null
    pending = 0
  }
  if (!user) {
    lastPushAt = null
  } else if (changed) {
    lastPushAt = readState(user.id).lastPushAt
    void flush()
  }
  notify()
}

let started = false

/** Start background sync. Safe to call when cloud backup is not configured. */
export function startSync(): void {
  if (!supabase || started) return
  started = true

  void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
  supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void flush()
  }, SCAN_INTERVAL_MS)

  // Leaving the app is the moment most likely to be followed by the tab being
  // discarded, so push immediately rather than waiting for the next tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
  window.addEventListener('online', () => void flush())

  notify()
}
