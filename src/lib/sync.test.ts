import { describe, expect, it } from 'vitest'
import {
  applyRows, buildPuts, collectLocal, recordPuts,
  type CloudRow, type Put, type PutResult, type State, type Store,
} from './sync'
import { KEYS } from './storage'

/** In-memory stand-in for the `upkeep_kv` table and `upkeep_kv_put`. */
class FakeCloud {
  rows = new Map<string, CloudRow>()
  private clock = 0

  put(puts: Put[]): PutResult[] {
    return puts.map(p => {
      const row = this.rows.get(p.key)
      if (p.base == null ? row != null : row?.version !== p.base) return { k: p.key, v: null, ok: false }
      const version = (row?.version ?? 0) + 1
      this.rows.set(p.key, {
        key: p.key,
        raw: p.deleted ? row?.raw ?? null : p.raw,
        deleted: p.deleted,
        version,
        updated_at: new Date(1_700_000_000_000 + ++this.clock * 1000).toISOString(),
      })
      return { k: p.key, v: version, ok: true }
    })
  }

  since(cursor: string | null): CloudRow[] {
    return [...this.rows.values()].filter(r => cursor == null || r.updated_at > cursor)
  }

  value(key: string): unknown {
    const row = this.rows.get(key)
    return row && !row.deleted && row.raw != null ? JSON.parse(row.raw) : undefined
  }
}

class Device implements Store {
  data = new Map<string, string>()
  state: State = { userId: 'u', lastPushAt: null, reconciled: false, cursor: null, keys: {} }
  constructor(private cloud: FakeCloud) {}

  get(key: string) { return this.data.get(key) ?? null }
  set(key: string, value: string) { this.data.set(key, value) }
  remove(key: string) { this.data.delete(key) }
  keys() { return [...this.data.keys()] }

  write(key: string, value: unknown) { this.set(key, JSON.stringify(value)) }
  read(key: string): unknown {
    const raw = this.get(key)
    return raw == null ? undefined : JSON.parse(raw)
  }

  /** Mirrors runCycle: full pull first time, then pull → push with conflict retry. */
  sync(mode: 'merge' | 'overwrite' = 'merge') {
    applyRows(this.state, this.cloud.since(this.state.reconciled ? this.state.cursor : null), this, mode)
    this.state.reconciled = true
    for (let round = 0; round < 3; round++) {
      const puts = buildPuts(this.state, collectLocal(this))
      if (puts.length === 0) return
      const conflicts = recordPuts(this.state, puts, this.cloud.put(puts))
      if (conflicts.length === 0) return
      applyRows(this.state, [...this.cloud.rows.values()].filter(r => conflicts.includes(r.key)), this)
    }
    throw new Error('did not converge')
  }
}

const med = (id: string, name = id) => ({ id, name, active: true })
const ids = (v: unknown) => (v as { id: string }[]).map(x => x.id)

function setup() {
  const cloud = new FakeCloud()
  const a = new Device(cloud)
  const b = new Device(cloud)
  return { cloud, a, b }
}

describe('two-device sync', () => {
  it('a newly signed-in device receives the meds instead of overwriting them', () => {
    const { cloud, a, b } = setup()
    a.write(KEYS.MEDICINES, [med('vitd'), med('omega')])
    a.write(KEYS.medsDay('2026-10-22'), { vitd: true })
    a.sync()

    // The second device finished onboarding, which writes an empty list.
    b.write(KEYS.MEDICINES, [])
    b.write(KEYS.PROFILE, { name: 'fresh-default' })
    b.sync()

    expect(ids(b.read(KEYS.MEDICINES))).toEqual(['vitd', 'omega'])
    expect(b.read(KEYS.medsDay('2026-10-22'))).toEqual({ vitd: true })
    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['vitd', 'omega'])

    a.sync()
    expect(ids(a.read(KEYS.MEDICINES))).toEqual(['vitd', 'omega'])
  })

  it('keeps sessions logged on both devices between syncs', () => {
    const { a, b } = setup()
    a.write(KEYS.SESSIONS, [{ id: 's1' }])
    a.sync()
    b.sync()

    a.write(KEYS.SESSIONS, [{ id: 's1' }, { id: 's2' }])
    b.write(KEYS.SESSIONS, [{ id: 's1' }, { id: 's3' }])
    a.sync()
    b.sync() // conflicts, pulls a's version, merges, pushes
    a.sync()

    expect(ids(a.read(KEYS.SESSIONS)).sort()).toEqual(['s1', 's2', 's3'])
    expect(ids(b.read(KEYS.SESSIONS)).sort()).toEqual(['s1', 's2', 's3'])
  })

  it('carries a deleted medicine to the other device', () => {
    const { a, b } = setup()
    a.write(KEYS.MEDICINES, [med('x'), med('y')])
    a.sync()
    b.sync()

    b.write(KEYS.MEDICINES, [med('x')])
    b.sync()
    a.sync()

    expect(ids(a.read(KEYS.MEDICINES))).toEqual(['x'])
  })

  it('carries a deleted key to the other device', () => {
    const { a, b } = setup()
    // A device with nothing else left looks like a wipe and is deliberately
    // not allowed to delete; a real device always holds other keys.
    a.write(KEYS.SETTINGS, { theme: 'vault' })
    a.write(KEYS.workoutDraft('2026-10-23'), { date: '2026-10-23' })
    a.sync()
    b.sync()
    expect(b.read(KEYS.workoutDraft('2026-10-23'))).toBeDefined()

    a.remove(KEYS.workoutDraft('2026-10-23'))
    a.sync()
    b.sync()
    expect(b.read(KEYS.workoutDraft('2026-10-23'))).toBeUndefined()
  })

  it('pushes edits made on a device whose hashes already matched the cloud', () => {
    const { a, b } = setup()
    a.write(KEYS.SETTINGS, { theme: 'vault' })
    a.sync()
    b.sync()

    b.write(KEYS.SETTINGS, { theme: 'ledger' })
    b.sync()
    a.sync()
    expect(a.read(KEYS.SETTINGS)).toEqual({ theme: 'ledger' })
  })

  it('does nothing when both devices are already in step', () => {
    const { a, b } = setup()
    a.write(KEYS.MEDICINES, [med('x')])
    a.sync()
    b.sync()
    expect(buildPuts(a.state, collectLocal(a))).toEqual([])
    expect(buildPuts(b.state, collectLocal(b))).toEqual([])
  })

  it('never tombstones the cloud when this device has been wiped', () => {
    const { cloud, a } = setup()
    a.write(KEYS.MEDICINES, [med('x')])
    a.sync()
    a.data.clear()
    expect(buildPuts(a.state, collectLocal(a))).toEqual([])
    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['x'])
  })

  it('overwrite mode makes the cloud an exact copy of this device', () => {
    const { cloud, a, b } = setup()
    a.write(KEYS.MEDICINES, [med('x'), med('y')])
    a.write(KEYS.SKINCARE, [{ id: 'k' }])
    a.sync()

    // b restored an older backup with "replace".
    b.write(KEYS.MEDICINES, [med('x')])
    b.sync('overwrite')

    expect(ids(cloud.value(KEYS.MEDICINES))).toEqual(['x'])
    expect(cloud.value(KEYS.SKINCARE)).toBeUndefined()
    a.sync()
    expect(ids(a.read(KEYS.MEDICINES))).toEqual(['x'])
    expect(a.read(KEYS.SKINCARE)).toBeUndefined()
  })

  it('leaves device-only keys out of the cloud', () => {
    const { cloud, a } = setup()
    a.write(KEYS.SYNC_STATE, {})
    a.write(KEYS.SYNC_OVERWRITE, 'u')
    a.write(KEYS.REST_END, 1)
    a.sync()
    expect(cloud.rows.size).toBe(0)
  })
})
