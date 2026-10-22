import type { CloudRow, Put, PutResult } from '../sync'

/** In-memory stand-in for the `upkeep_kv` table and `upkeep_kv_put`. */
export class FakeCloud {
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
