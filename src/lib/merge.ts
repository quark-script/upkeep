/**
 * Three-way merge of one localStorage value between this device and the cloud.
 *
 * Every app value is one of a few shapes, and each merges naturally:
 *   - lists of records with an `id` (sessions, medicines, food entries…) merge
 *     item by item, keyed by id
 *   - lists of records keyed by `date` (measurements) merge the same way
 *   - plain objects (profile, a day's med ticks, migrations…) merge field by field
 *   - anything else is a single value: one side wins
 *
 * The base is a fingerprint of the cloud value this device last synced with. It
 * is what tells "deleted over there" apart from "added over here". Without one
 * (a device's first sync) nothing is ever treated as deleted: both sides are
 * unioned, and a true conflict goes to `prefer`.
 */

export type Prefer = 'remote' | 'local'

type Kind = 'id' | 'date' | 'obj' | 'empty'

/** What this device remembers about the last synced cloud value. */
export interface Base {
  /** Hash of the whole raw string. */
  hash: string
  kind?: Kind
  /** Per-item (or per-field) hashes, for keyed shapes. */
  parts?: Record<string, string>
}

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

/** JSON with object keys sorted, so two devices hash the same item the same way. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().filter(k => obj[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const hashOf = (value: unknown) => hashValue(stable(value))

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function kindOf(value: unknown): Kind | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty'
    for (const field of ['id', 'date'] as const) {
      if (!value.every(v => isRecord(v) && typeof v[field] === 'string')) continue
      // Duplicate keys cannot be merged by key without dropping one, so such a
      // list is treated as a single value rather than silently losing an item.
      const keys = new Set(value.map(v => (v as Record<string, string>)[field]))
      return keys.size === value.length ? field : null
    }
    return null
  }
  return isRecord(value) ? 'obj' : null
}

function entries(value: unknown, kind: Kind): Map<string, unknown> {
  const out = new Map<string, unknown>()
  if (kind === 'obj') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out.set(k, v)
  } else if (kind !== 'empty') {
    for (const item of value as Record<string, unknown>[]) out.set(item[kind] as string, item)
  }
  return out
}

/** Fingerprint a raw value, to be stored as the base for the next merge. */
export function fingerprint(raw: string): Base {
  const hash = hashValue(raw)
  const value = parse(raw)
  const kind = value === undefined ? null : kindOf(value)
  if (!kind) return { hash }
  const parts: Record<string, string> = {}
  for (const [k, v] of entries(value, kind)) parts[k] = hashOf(v)
  return { hash, kind, parts }
}

export function merge3(base: Base | null, local: string, remote: string, prefer: Prefer = 'remote'): string {
  if (local === remote) return local
  const winner = prefer === 'local' ? local : remote

  // Only one side moved since the last sync: take it whole.
  if (base) {
    if (hashValue(local) === base.hash) return remote
    if (hashValue(remote) === base.hash) return local
  }

  const l = parse(local)
  const r = parse(remote)
  if (l === undefined || r === undefined) return winner

  const lk = kindOf(l)
  const rk = kindOf(r)
  let kind: Kind | null
  if (lk === rk) kind = lk
  else if (lk === 'empty' && (rk === 'id' || rk === 'date')) kind = rk
  else if (rk === 'empty' && (lk === 'id' || lk === 'date')) kind = lk
  else kind = null
  if (!kind) return winner

  const baseUsable = base?.parts && base.kind &&
    (base.kind === kind || (base.kind === 'empty' && kind !== 'obj'))
  const bp = baseUsable ? base.parts! : null

  const lm = entries(l, kind)
  const rm = entries(r, kind)
  const out = new Map<string, unknown>()

  for (const [k, lv] of lm) {
    if (rm.has(k)) {
      const rv = rm.get(k)
      const hl = hashOf(lv)
      const hr = hashOf(rv)
      if (hl === hr) out.set(k, lv)
      else if (bp && hl === bp[k]) out.set(k, rv)        // only the cloud edited it
      else if (bp && hr === bp[k]) out.set(k, lv)        // only this device edited it
      else out.set(k, prefer === 'local' ? lv : rv)      // both edited it
    } else if (bp && k in bp && hashOf(lv) === bp[k]) {
      // Was synced, untouched here, and is gone from the cloud: deleted there.
    } else {
      out.set(k, lv)
    }
  }
  for (const [k, rv] of rm) {
    if (lm.has(k)) continue
    // Was synced, unchanged in the cloud, and is gone here: deleted here.
    if (bp && k in bp && hashOf(rv) === bp[k]) continue
    out.set(k, rv)
  }

  if (kind === 'obj') return JSON.stringify(Object.fromEntries(out))
  const list = [...out.values()]
  if (kind === 'date') list.sort((a, b) => String((a as { date: string }).date).localeCompare((b as { date: string }).date))
  return JSON.stringify(list)
}
