import { describe, expect, it } from 'vitest'
import { fingerprint, merge3, type Base } from './merge'

const med = (id: string, name = id, extra: Record<string, unknown> = {}) => ({ id, name, active: true, ...extra })
const j = (v: unknown) => JSON.stringify(v)
const baseOf = (raw: string): Base => fingerprint(raw)

describe('merge3 without a base (first sync of a device)', () => {
  it('keeps the cloud meds when this device only has the empty starter list', () => {
    const local = j([])
    const remote = j([med('a'), med('b')])
    expect(JSON.parse(merge3(null, local, remote))).toEqual([med('a'), med('b')])
  })

  it('unions items from both sides by id', () => {
    const merged = JSON.parse(merge3(null, j([med('a')]), j([med('b')])))
    expect(merged.map((m: { id: string }) => m.id).sort()).toEqual(['a', 'b'])
  })

  it('lets the cloud win a same-item conflict by default', () => {
    const merged = JSON.parse(merge3(null, j([med('a', 'local')]), j([med('a', 'cloud')])))
    expect(merged).toEqual([med('a', 'cloud')])
  })

  it('can prefer this device instead (merge-restore of a file)', () => {
    const merged = JSON.parse(merge3(null, j([med('a', 'local')]), j([med('a', 'cloud')]), 'local'))
    expect(merged).toEqual([med('a', 'local')])
  })

  it('merges objects field by field', () => {
    const merged = JSON.parse(merge3(null, j({ a: true }), j({ b: true })))
    expect(merged).toEqual({ a: true, b: true })
  })

  it('takes the cloud for plain values', () => {
    expect(merge3(null, j(80), j(75))).toBe(j(75))
  })

  it('keys measurements by date and keeps them sorted', () => {
    const merged = JSON.parse(merge3(null,
      j([{ date: '2026-01-03', weight: 80 }]),
      j([{ date: '2026-01-01', weight: 82 }, { date: '2026-01-02', weight: 81 }])))
    expect(merged.map((m: { date: string }) => m.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })
})

describe('merge3 with a base (both devices have synced before)', () => {
  it('takes the cloud when only the cloud changed', () => {
    const base = j([med('a')])
    const remote = j([med('a'), med('b')])
    expect(merge3(baseOf(base), base, remote)).toBe(remote)
  })

  it('keeps this device when only this device changed', () => {
    const base = j([med('a')])
    const local = j([med('a'), med('c')])
    expect(merge3(baseOf(base), local, base)).toBe(local)
  })

  it('keeps additions made on both devices', () => {
    const base = j([med('a')])
    const merged = JSON.parse(merge3(baseOf(base), j([med('a'), med('local')]), j([med('a'), med('cloud')])))
    expect(merged.map((m: { id: string }) => m.id)).toEqual(['a', 'local', 'cloud'])
  })

  it('carries a deletion made on the other device', () => {
    const base = j([med('a'), med('b')])
    const merged = JSON.parse(merge3(baseOf(base), j([med('a'), med('b'), med('c')]), j([med('a')])))
    expect(merged.map((m: { id: string }) => m.id)).toEqual(['a', 'c'])
  })

  it('carries a deletion made on this device', () => {
    const base = j([med('a'), med('b')])
    const merged = JSON.parse(merge3(baseOf(base), j([med('a')]), j([med('a'), med('b'), med('c')])))
    expect(merged.map((m: { id: string }) => m.id)).toEqual(['a', 'c'])
  })

  it('keeps an item edited on one device even if the other deleted it', () => {
    const base = j([med('a')])
    const merged = JSON.parse(merge3(baseOf(base), j([med('a', 'edited')]), j([])))
    expect(merged).toEqual([med('a', 'edited')])
  })

  it('keeps edits to different items from both devices', () => {
    const base = j([med('a'), med('b')])
    const merged = JSON.parse(merge3(baseOf(base),
      j([med('a', 'a-local'), med('b')]),
      j([med('a'), med('b', 'b-cloud')])))
    expect(merged).toEqual([med('a', 'a-local'), med('b', 'b-cloud')])
  })

  it('merges ticks on the same day from both devices', () => {
    const base = j({})
    const merged = JSON.parse(merge3(baseOf(base), j({ a: true }), j({ b: true })))
    expect(merged).toEqual({ a: true, b: true })
  })

  it('carries an untick made on the other device', () => {
    const base = j({ a: true, b: true })
    const merged = JSON.parse(merge3(baseOf(base), j({ a: true, b: true }), j({ a: true })))
    expect(merged).toEqual({ a: true })
  })

  it('ignores key order when comparing items', () => {
    const base = j([{ id: 'a', name: 'x', active: true }])
    const local = j([{ active: true, name: 'x', id: 'a' }])
    const remote = j([{ id: 'a', name: 'x', active: true }, med('b')])
    const merged = JSON.parse(merge3(baseOf(base), local, remote))
    expect(merged.map((m: { id: string }) => m.id)).toEqual(['a', 'b'])
  })

  it('falls back to the cloud value for text that is not JSON', () => {
    expect(merge3(baseOf('x'), 'y', 'z')).toBe('z')
    expect(merge3(baseOf('x'), 'y', 'x')).toBe('y')
  })
})
