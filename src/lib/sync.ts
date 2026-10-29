import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { PREFIX, KEYS } from './storage'
import { skipped, type BackupFile } from './backup'
import { fingerprint, hashValue, merge3, type Base } from './merge'
import { supabase } from './supabase'

export { hashValue }

/**
 * Two-way sync of this device's localStorage with Supabase.
 *
 * Every cycle is pull → merge → push:
 *
 *   - Pull fetches cloud rows this device has not seen (by per-row version) and
 *     merges each into the local value with `merge3`, using the last-synced cloud
 *     value as the base. Lists merge item by item, so a medicine added on one
 *     device and a session logged on another both survive.
 *   - Push writes local values that differ from the last-synced cloud value, but
 *     only against the version this device last saw (`upkeep_kv_put`). If another
 *     device got there first the write is refused, the newer row is pulled and
 *     merged, and the merged value is pushed instead.
 *
 * A device never pushes before its first full pull. That is the bug this design
 * replaces: a freshly signed-in device used to upload its empty starter lists
 * over the real data in the cloud before ever reading it.
 *
 * Screens read localStorage once at mount, so a pull that changes local values
 * after the app has mounted reloads the page (immediately if visible, otherwise
 * on return). Pulls happen at startup, on sign-in and on returning to the app,
 * never on the 3-second timer, so a reload is never sprung on someone mid-tap
 * unless two devices edited the same thing at the same moment.
 */

const TABLE = 'upkeep_kv'
const SCAN_INTERVAL_MS = 3000
/** How long startup waits for the first pull before showing the app anyway. */
const STARTUP_WAIT_MS = 2500
/** Re-read rows this far behind the cursor, in case of clock or commit skew. */
const CURSOR_OVERLAP_MS = 60_000
/** Rows per write, as a secondary bound behind the byte budget below. */
const MAX_CHUNK_ROWS = 200
/**
 * Byte budget per write. Row count alone does not bound a request: a single
 * year-long `sessions` value dwarfs hundreds of day keys put together.
 */
const MAX_CHUNK_BYTES = 512 * 1024
/** Rows per select page when pulling. */
const PAGE = 1000
/** Pull-merge-push rounds before giving up on a key that keeps conflicting. */
const MAX_ROUNDS = 3
/** Stop a push after this many chunks fail in a row (offline, auth). */
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

/** The cloud value this device last synced with, for one key. */
export interface Entry extends Base {
  version: number
  deleted?: boolean
}

export interface State {
  userId: string
  lastPushAt: number | null
  /** True once this device has pulled and merged the whole cloud copy. */
  reconciled: boolean
  /** Latest `updated_at` seen from the cloud; pulls ask for rows after it. */
  cursor: string | null
  keys: Record<string, Entry>
}

/** A row as read from the cloud. */
export interface CloudRow {
  key: string
  raw: string | null
  deleted: boolean
  version: number
  updated_at: string
}

/** A conditional write, as sent to `upkeep_kv_put`. */
export interface Put {
  key: string
  raw: string | null
  deleted: boolean
  /** Version this write is based on; null = only create if absent. */
  base: number | null
}

export interface PutResult {
  k: string
  v: number | null
  ok: boolean
}

/** The slice of localStorage the sync logic needs, so tests can supply a fake. */
export interface Store {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  keys(): string[]
}

export const browserStore: Store = {
  get: key => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: key => localStorage.removeItem(key),
  keys: () => Object.keys(localStorage),
}

// ─── Local state ─────────────────────────────────────────────────────────────

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' && value !== null &&
    typeof (value as Entry).hash === 'string' &&
    typeof (value as Entry).version === 'number'
  )
}

export function readState(userId: string, store: Store = browserStore): State {
  try {
    const stored = store.get(KEYS.SYNC_STATE)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<State> | null
      // State written for another account says nothing about this one. State
      // from the old push-only sync has no versions; both start over with a
      // full pull, which merges rather than overwrites, so that is safe.
      if (parsed && parsed.userId === userId && parsed.keys && !Array.isArray(parsed.keys)) {
        const keys: Record<string, Entry> = {}
        for (const [key, entry] of Object.entries(parsed.keys)) {
          if (key.startsWith(PREFIX) && isEntry(entry)) keys[key] = entry
        }
        const reconciled = parsed.reconciled === true && Object.keys(keys).length === Object.keys(parsed.keys).length
        return {
          userId,
          lastPushAt: typeof parsed.lastPushAt === 'number' ? parsed.lastPushAt : null,
          reconciled,
          cursor: reconciled && typeof parsed.cursor === 'string' ? parsed.cursor : null,
          keys: reconciled ? keys : {},
        }
      }
    }
  } catch {
    // Unreadable state is not worth failing over: start over with a full pull.
  }
  return { userId, lastPushAt: null, reconciled: false, cursor: null, keys: {} }
}

function statePresent(store: Store): boolean {
  try {
    return store.get(KEYS.SYNC_STATE) != null
  } catch {
    return false
  }
}

function persist(state: State, store: Store): boolean {
  try {
    store.set(KEYS.SYNC_STATE, JSON.stringify(state))
    return true
  } catch (err) {
    // A persistent failure here means the same rows are re-sent on every
    // cycle forever, so it belongs in front of the user, not only the console.
    lastError = 'Could not save sync state on this device.'
    console.warn('[sync] could not persist sync state', err)
    return false
  }
}

/**
 * Persist progress, unless this device was wiped while a request was in flight.
 *
 * "Reset all data" and a `replace` restore delete every `upkeep:` key, this one
 * included. Re-creating the state after such a wipe would describe keys that no
 * longer exist locally, and the next push would tombstone the entire replica. So
 * a vanished state key means the cycle is abandoned, not completed.
 */
function persistProgress(state: State, store: Store): boolean {
  if (!statePresent(store)) return false
  return persist(state, store)
}

export function clearSyncState(): void {
  try {
    localStorage.removeItem(KEYS.SYNC_STATE)
    localStorage.removeItem(KEYS.SYNC_OVERWRITE)
  } catch {
    // Nothing useful to do; the next sign-in starts with a full pull.
  }
}

/**
 * Make this device's data the cloud copy on the next sync: local values win
 * every key, and keys this device does not have are deleted from the cloud
 * (recoverably, tombstones keep the old value). Used after a `replace` restore,
 * whose whole point is that the restored data is the truth.
 */
export function markThisDeviceAuthoritative(): void {
  if (!currentUser) return
  try {
    localStorage.removeItem(KEYS.SYNC_STATE)
    localStorage.setItem(KEYS.SYNC_OVERWRITE, JSON.stringify(currentUser.id))
  } catch {
    // Without the marker the next sync merges instead, which loses nothing.
  }
}

// ─── Pure sync logic ─────────────────────────────────────────────────────────

/** Every app-owned key that belongs in the cloud, by key. */
export function collectLocal(store: Store = browserStore): Map<string, string> {
  const out = new Map<string, string>()
  let keys: string[]
  try {
    keys = store.keys()
  } catch {
    return out
  }
  for (const key of keys) {
    if (!key.startsWith(PREFIX) || skipped(key)) continue
    const value = store.get(key)
    if (value != null) out.set(key, value)
  }
  return out
}

function entryFor(raw: string | null, version: number): Entry {
  return raw == null ? { hash: '', version, deleted: true } : { ...fingerprint(raw), version }
}

/**
 * Decide this device's value for one key, given the cloud's.
 * `null` means the key should not exist locally.
 */
export function resolve(entry: Entry | undefined, local: string | null, remote: string | null): string | null {
  const base = entry && !entry.deleted ? entry : null
  if (remote == null) {
    if (local == null) return null
    // Deleted on another device and untouched here: delete here too.
    if (base && hashValue(local) === base.hash) return null
    return local
  }
  if (local == null) {
    // Deleted here and unchanged in the cloud: stays deleted (push tombstones it).
    if (base && hashValue(remote) === base.hash) return null
    return remote
  }
  return merge3(base, local, remote)
}

/**
 * Merge pulled rows into local storage and record them as the new base.
 *
 * In `overwrite` mode local values are left exactly as they are: only the
 * versions are learned, so the next push replaces the cloud copy.
 *
 * Returns the keys whose local value changed.
 */
export function applyRows(
  state: State,
  rows: CloudRow[],
  store: Store,
  mode: 'merge' | 'overwrite' = 'merge',
): string[] {
  const changed: string[] = []
  for (const row of rows) {
    if (!row.key.startsWith(PREFIX) || skipped(row.key)) continue
    if (state.cursor == null || row.updated_at > state.cursor) state.cursor = row.updated_at

    const entry = state.keys[row.key]
    if (entry && entry.version >= row.version) continue

    const remote = row.deleted || typeof row.raw !== 'string' ? null : row.raw
    if (mode === 'merge') {
      const local = store.get(row.key)
      const next = resolve(entry, local, remote)
      if (next !== local) {
        if (next == null) store.remove(row.key)
        else store.set(row.key, next)
        changed.push(row.key)
      }
    }
    state.keys[row.key] = entryFor(remote, row.version)
  }
  return changed
}

/** Local values that differ from what this device last synced. */
export function buildPuts(state: State, local: Map<string, string>): Put[] {
  const puts: Put[] = []
  for (const [key, value] of local) {
    const entry = state.keys[key]
    if (entry && !entry.deleted && entry.hash === hashValue(value)) continue
    puts.push({ key, raw: value, deleted: false, base: entry ? entry.version : null })
  }

  // Not one app key left while the cloud holds several: that is a wipe or a
  // storage read that failed, never a user deleting their whole log key by key
  // inside one tick. Tombstoning here would destroy the backup at the exact
  // moment it is the only copy, so leave the replica alone.
  const live = Object.entries(state.keys).filter(([, e]) => !e.deleted)
  if (local.size === 0 && live.length > 0) return puts

  for (const [key, entry] of live) {
    if (!local.has(key)) puts.push({ key, raw: null, deleted: true, base: entry.version })
  }
  return puts
}

/** Record accepted writes; returns the keys the cloud refused (stale base). */
export function recordPuts(state: State, sent: Put[], results: PutResult[]): string[] {
  const conflicts: string[] = []
  const byKey = new Map(results.map(r => [r.k, r]))
  for (const put of sent) {
    const result = byKey.get(put.key)
    if (result?.ok && typeof result.v === 'number') {
      state.keys[put.key] = entryFor(put.deleted ? null : put.raw, result.v)
    } else {
      conflicts.push(put.key)
    }
  }
  return conflicts
}

/** Group writes into requests bounded by both byte size and row count. */
function chunk(puts: Put[]): Put[][] {
  const chunks: Put[][] = []
  let current: Put[] = []
  let bytes = 0
  for (const put of puts) {
    // Rough upper bound: JSON escaping and UTF-8 can inflate a string, and the
    // row's own fields add a little. Being wrong high only sends smaller requests.
    const size = (put.raw?.length ?? 0) * 2 + put.key.length + 128
    if (current.length > 0 && (current.length >= MAX_CHUNK_ROWS || bytes + size > MAX_CHUNK_BYTES)) {
      chunks.push(current)
      current = []
      bytes = 0
    }
    current.push(put)
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

// ─── Network ─────────────────────────────────────────────────────────────────

const COLUMNS = 'key, raw, deleted, version, updated_at'

/** Every row (cursor null), or rows changed since the cursor. */
async function fetchRows(userId: string, cursor: string | null): Promise<CloudRow[]> {
  if (!supabase) return []
  const out: CloudRow[] = []
  const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null
  let from = 0
  for (;;) {
    let query = supabase.from(TABLE).select(COLUMNS).eq('user_id', userId)
    if (since) query = query.gt('updated_at', since)
    const { data, error } = await query
      .order('updated_at')
      .order('key')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...(data as CloudRow[]))
    // Advance by what actually came back, never by the page size: PostgREST
    // caps responses at the project's `max_rows`.
    from += data.length
  }
  return out
}

async function fetchKeys(userId: string, keys: string[]): Promise<CloudRow[]> {
  if (!supabase) return []
  const out: CloudRow[] = []
  for (let i = 0; i < keys.length; i += MAX_CHUNK_ROWS) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('user_id', userId)
      .in('key', keys.slice(i, i + MAX_CHUNK_ROWS))
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as CloudRow[]))
  }
  return out
}

async function sendPuts(puts: Put[]): Promise<PutResult[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('upkeep_kv_put', { p_rows: puts })
  if (error) throw new Error(error.message)
  return (data ?? []) as PutResult[]
}

// ─── Cycle ───────────────────────────────────────────────────────────────────

type Reason = 'pull' | 'push'

let mounted = false
let reloadOnVisible = false

/** Local values changed under mounted screens: they must re-read storage. */
function localChanged(): void {
  if (!mounted) return
  if (document.visibilityState === 'visible') window.location.reload()
  else reloadOnVisible = true
}

/** Abandon a cycle whose session ended or whose device was wiped mid-flight. */
class Abandoned extends Error {}

async function runCycle(reason: Reason): Promise<void> {
  if (!supabase || !currentUser) return
  // Offline is the normal case at a gym, not an error worth showing.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const store = browserStore
  const userId = currentUser.id
  const state = readState(userId, store)
  lastPushAt = state.lastPushAt

  const check = () => {
    if (!currentUser || currentUser.id !== userId) throw new Abandoned()
  }
  const save = () => {
    if (!persistProgress(state, store)) throw new Abandoned()
  }
  let changed = false
  let sendError: string | null = null

  try {
    // Nothing to send and nothing asked for: skip the network entirely.
    if (state.reconciled && reason === 'push') {
      const count = buildPuts(state, collectLocal(store)).length
      pending = count
      if (count === 0) {
        lastError = null
        return
      }
    }

    busy = true
    notify()

    // Claim the state key before the first request. From here on its absence
    // means a wipe happened mid-cycle, which `save` refuses to undo.
    if (!statePresent(store) && !persist(state, store)) return

    if (!state.reconciled) {
      const overwrite = store.get(KEYS.SYNC_OVERWRITE) === JSON.stringify(userId)
      const rows = await fetchRows(userId, null)
      check()
      if (applyRows(state, rows, store, overwrite ? 'overwrite' : 'merge').length) changed = true
      state.reconciled = true
      save()
      store.remove(KEYS.SYNC_OVERWRITE)
    } else if (reason === 'pull') {
      const rows = await fetchRows(userId, state.cursor)
      check()
      if (applyRows(state, rows, store).length) changed = true
      save()
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const puts = buildPuts(state, collectLocal(store))
      pending = puts.length
      notify()
      if (puts.length === 0) break

      const conflicts: string[] = []
      let failuresInARow = 0
      for (const slice of chunk(puts)) {
        let results: PutResult[]
        try {
          results = await sendPuts(slice)
        } catch (err) {
          // One permanently-rejected chunk must not strand every later one, and
          // chunks go out in the same order every cycle. Keep going; this
          // chunk's keys stay unsynced and are offered again next cycle.
          check()
          sendError ??= `${err instanceof Error ? err.message : String(err)} (first stuck key: ${slice[0].key})`
          if (++failuresInARow >= MAX_CONSECUTIVE_FAILURES) break
          continue
        }
        failuresInARow = 0
        check()
        conflicts.push(...recordPuts(state, slice, results))
        state.lastPushAt = Date.now()
        save()
        lastPushAt = state.lastPushAt
      }
      if (sendError) break
      if (conflicts.length === 0) break

      // Another device wrote these first: take its value, merge, go again.
      const rows = await fetchKeys(userId, conflicts)
      check()
      if (applyRows(state, rows, store).length) changed = true
      save()
    }

    pending = buildPuts(state, collectLocal(store)).length
    lastError = sendError ??
      (pending > 0 ? 'Some changes keep conflicting with another device; will retry.' : null)
  } catch (err) {
    if (!(err instanceof Abandoned)) {
      lastError = err instanceof Error ? err.message : String(err)
      console.warn('[sync] cycle failed', err)
    }
  } finally {
    busy = false
    notify()
    if (changed) localChanged()
  }
}

let running: Promise<void> | null = null
let queued: Reason | null = null

/** Run a sync cycle, or queue one behind the cycle already running. */
export function sync(reason: Reason = 'push'): Promise<void> {
  if (running) {
    if (queued !== 'pull') queued = reason
    return running
  }
  running = (async () => {
    let next: Reason | null = reason
    while (next) {
      queued = null
      await runCycle(next)
      next = queued
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** Push anything that changed locally. Kept for callers of the old API. */
export function flush(): Promise<void> {
  return sync('push')
}

// ─── Restore ─────────────────────────────────────────────────────────────────

/**
 * Pull the cloud copy as a backup file.
 *
 * Deliberately returns the same JSON shape the Download-backup button produces,
 * so restoring from the cloud goes through the existing `restoreBackup()`.
 */
export async function fetchCloudBackup(): Promise<string> {
  if (!supabase || !currentUser) throw new Error('Not signed in.')

  const data: Record<string, string> = {}
  for (const row of await fetchRows(currentUser.id, null)) {
    if (!row.deleted && typeof row.raw === 'string') data[row.key] = row.raw
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
    // Local scope so signing out works with no network.
    await supabase.auth.signOut({ scope: 'local' })
  } finally {
    // The next sign-in starts with a full pull rather than trusting a map that
    // describes what some other session synced.
    clearSyncState()
  }
}

function setUser(user: User | null): Promise<void> {
  const changed = user?.id !== currentUser?.id
  currentUser = user
  if (changed) {
    // An error from the previous session says nothing about this one.
    lastError = null
    pending = 0
  }
  notify()
  if (!user) {
    lastPushAt = null
    notify()
    return Promise.resolve()
  }
  if (!changed) return Promise.resolve()
  lastPushAt = readState(user.id).lastPushAt
  return sync('pull')
}

/** Call once the app has rendered: from then on, pulled changes need a reload. */
export function markMounted(): void {
  mounted = true
}

let started = false

/**
 * Start background sync. Safe to call when cloud backup is not configured.
 *
 * Resolves once the first pull has landed (or after a short wait), so the app
 * can render with this device already up to date instead of reloading moments
 * after it appears.
 */
export function startSync(): Promise<void> {
  if (!supabase || started) return Promise.resolve()
  started = true

  const first = supabase.auth.getSession()
    .then(({ data }) => setUser(data.session?.user ?? null))
    // The auth listener below may have started the first cycle already, in
    // which case setUser above saw no change; wait for that cycle either way.
    .then(() => running ?? undefined)
    .catch(err => console.warn('[sync] could not read session', err))

  supabase.auth.onAuthStateChange((_event, session) => {
    void setUser(session?.user ?? null)
  })

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void sync('push')
  }, SCAN_INTERVAL_MS)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Leaving the app is the moment most likely to be followed by the tab
      // being discarded, so push immediately rather than waiting for the timer.
      void sync('push')
    } else if (reloadOnVisible) {
      window.location.reload()
    } else {
      // Back in the app: pick up whatever other devices did meanwhile.
      void sync('pull')
    }
  })
  window.addEventListener('online', () => void sync('pull'))

  notify()
  return Promise.race([
    first,
    new Promise<void>(resolve => window.setTimeout(resolve, STARTUP_WAIT_MS)),
  ])
}
