import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KEYS } from './storage'
import { FakeCloud } from './__fixtures__/fakeCloud'
import type { CloudRow, Put } from './sync'

/**
 * Drives the real sync cycle (`startSync` → `runCycle`) against a fake Supabase
 * client backed by FakeCloud, covering the moments that decide whether data
 * survives: a device's first run, and a replace that must win.
 */

const USER = { id: 'user-1', email: 'me@example.com' }

const env = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  get supabase() { return env.client },
}))

function fakeClient(cloud: FakeCloud, sent: Put[][]) {
  const query = () => {
    let since: string | null = null
    let keys: string[] | null = null
    let from = 0
    let to = Infinity
    const b = {
      select: () => b,
      eq: () => b,
      order: () => b,
      gt: (_c: string, v: string) => { since = v; return b },
      in: (_c: string, ks: string[]) => { keys = ks; return b },
      range: (a: number, z: number) => { from = a; to = z; return b },
      then: (resolve: (v: { data: CloudRow[]; error: null }) => unknown) => {
        const rows = [...cloud.rows.values()]
          .filter(r => since == null || r.updated_at > since)
          .filter(r => keys == null || keys.includes(r.key))
          .sort((x, y) => x.updated_at.localeCompare(y.updated_at) || x.key.localeCompare(y.key))
          .slice(from, to + 1)
        return Promise.resolve({ data: rows, error: null }).then(resolve)
      },
    }
    return b
  }
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: USER } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => query(),
    rpc: async (_fn: string, args: { p_rows: Put[] }) => {
      sent.push(args.p_rows)
      return { data: cloud.put(args.p_rows), error: null }
    },
  }
}

/** localStorage whose stored keys show up in Object.keys, like the real one. */
function memoryStorage(): Storage {
  const store = {} as Record<string, string>
  const methods = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(store, name, { value: fn, enumerable: false })
  }
  Object.defineProperty(store, 'length', { get: () => Object.keys(store).length, enumerable: false })
  return store as unknown as Storage
}

let cloud: FakeCloud
let sent: Put[][]
let reload: ReturnType<typeof vi.fn>

const get = (key: string) => {
  const raw = localStorage.getItem(key)
  return raw == null ? undefined : JSON.parse(raw)
}
const set = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))
const ids = (v: unknown) => (v as { id: string }[]).map(x => x.id)

async function boot() {
  vi.resetModules()
  const sync = await import('./sync')
  await sync.startSync()
  return sync
}

beforeEach(() => {
  cloud = new FakeCloud()
  sent = []
  reload = vi.fn()
  env.client = fakeClient(cloud, sent)
  const storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {} })
  vi.stubGlobal('window', {
    setInterval: () => 0,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    addEventListener: () => {},
    location: { reload },
  })
})

describe('sync cycle', () => {
  it('a fresh device pulls the meds before uploading anything', async () => {
    cloud.put([{ key: KEYS.MEDICINES, raw: JSON.stringify([{ id: 'vitd' }]), deleted: false, base: null }])
    set(KEYS.MEDICINES, [])   // onboarding's empty starter list

    await boot()

    expect(ids(get(KEYS.MEDICINES))).toEqual(['vitd'])
    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['vitd'])
    // Nothing was ever offered to the cloud as an empty list.
    const offered = sent.flat().filter(p => p.key === KEYS.MEDICINES).map(p => p.raw)
    expect(offered).not.toContain('[]')
    expect(reload).not.toHaveBeenCalled()   // pulled before mount: no reload needed
  })

  it("the original device's first run on new code keeps its own meds", async () => {
    // Cloud was polluted by another device's empty list under the old code.
    cloud.put([{ key: KEYS.MEDICINES, raw: '[]', deleted: false, base: null }])
    set(KEYS.MEDICINES, [{ id: 'vitd' }, { id: 'omega' }])
    // Sync state left behind by the old push-only code: hashes, no versions.
    set(KEYS.SYNC_STATE, { userId: USER.id, lastPushAt: 1, keys: { [KEYS.MEDICINES]: { hash: 'x:1', updatedAt: 'y' } } })

    await boot()

    expect(ids(get(KEYS.MEDICINES))).toEqual(['vitd', 'omega'])
    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['vitd', 'omega'])
    expect(get(KEYS.SYNC_STATE).reconciled).toBe(true)
  })

  it('replace makes the cloud an exact copy of this device', async () => {
    cloud.put([
      { key: KEYS.MEDICINES, raw: JSON.stringify([{ id: 'a' }, { id: 'b' }]), deleted: false, base: null },
      { key: KEYS.SKINCARE, raw: JSON.stringify([{ id: 'k' }]), deleted: false, base: null },
    ])
    const sync = await boot()
    expect(ids(get(KEYS.MEDICINES))).toEqual(['a', 'b'])

    // What Settings does for a replace restore.
    localStorage.clear()
    set(KEYS.MEDICINES, [{ id: 'a' }])
    set(KEYS.SETTINGS, { theme: 'vault' })
    sync.markThisDeviceAuthoritative()
    await sync.sync('pull')

    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['a'])
    expect(cloud.value(KEYS.SKINCARE)).toBeUndefined()
    expect(cloud.value(KEYS.SETTINGS)).toEqual({ theme: 'vault' })
    expect(ids(get(KEYS.MEDICINES))).toEqual(['a'])
    expect(localStorage.getItem(KEYS.SYNC_OVERWRITE)).toBeNull()
  })

  it('reloads the open app when a later pull changes local data', async () => {
    set(KEYS.SETTINGS, { theme: 'vault' })
    const sync = await boot()
    sync.markMounted()

    // Another device adds a medicine.
    cloud.put([{ key: KEYS.MEDICINES, raw: JSON.stringify([{ id: 'new' }]), deleted: false, base: null }])
    await sync.sync('pull')

    expect(ids(get(KEYS.MEDICINES))).toEqual(['new'])
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
