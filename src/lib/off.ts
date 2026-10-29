import type { Food, Macros } from './types'

// Full-text search is NOT in the OpenFoodFacts v2 API; it lives in a separate
// service, search-a-licious.
const SEARCH_URL = 'https://search.openfoodfacts.org/search'

/**
 * Whether packaged-food search can actually run from a browser. Currently false.
 *
 * Measured 2026-08-26: `search.openfoodfacts.org/search` answers 200 with a
 * correct JSON body but sends no `Access-Control-Allow-Origin` header (only
 * `access-control-allow-credentials`), so every browser blocks the response
 * before our code sees it. The legacy `world.openfoodfacts.org/cgi/search.pl`
 * fallback answers 503. By contrast `world.openfoodfacts.org/api/v2/product/...`
 * does send `Access-Control-Allow-Origin: *`, so a future barcode scanner is
 * viable even though full-text search is not.
 *
 * Everything below is kept and tested so that re-enabling this is a one-line
 * change the day OFF adds the header. Until then the app is tiers 1-3, which
 * the spec always required it to be.
 */
const SEARCH_SUPPORTED = false

// Their documented ceiling is 10 search req/min/IP, with IP bans for abuse. We
// cap below it because a browser cannot send the custom User-Agent their docs
// require, so we have no way to identify ourselves if we get it wrong.
const MAX_PER_MIN = 8
const WINDOW_MS = 60_000
const MIN_QUERY = 3
const PAGE_SIZE = 12

let hits: number[] = []
let inFlight: AbortController | null = null

function underLimit(): boolean {
  const now = Date.now()
  hits = hits.filter(t => now - t < WINDOW_MS)
  return hits.length < MAX_PER_MIN
}

export type OffStatus = 'ready' | 'offline' | 'throttled' | 'unsupported'

export function offStatus(): OffStatus {
  if (!SEARCH_SUPPORTED) return 'unsupported'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  return underLimit() ? 'ready' : 'throttled'
}

function offAvailable(): boolean {
  return offStatus() === 'ready'
}

/** Results are cached for the tab's lifetime: the same query must never cost
 *  a second request against a 10/min budget. */
const cache = new Map<string, Food[]>()

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** `brands` is an array from the search service and a comma-joined string from
 *  the v2 API. Reading it naively threw, and the throw took the whole tier down
 *  silently, because searchOFF catches everything. */
function firstBrand(brands: unknown): string | undefined {
  const first = Array.isArray(brands) ? brands[0] : String(brands ?? '').split(',')[0]
  const name = String(first ?? '').trim()
  return name || undefined
}

/**
 * Map one OFF product to a Food. Exported so the mapping stays verifiable while
 * search itself is CORS-blocked, and so a future barcode lookup can reuse it.
 *
 * OFF nutriments are per 100 g under the `_100g` suffix; anything missing
 * becomes 0 and the food is flagged for review rather than quietly logging as
 * zero-calorie.
 */
export function mapOffProduct(p: any): Food | null {
  const name: string = p?.product_name || p?.generic_name || ''
  if (!name.trim()) return null

  const n = p.nutriments ?? {}
  const per100: Macros = {
    kcal: Math.round(num(n['energy-kcal_100g']) || num(n.energy_100g) / 4.184),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
  }

  const id = `off:${p.code ?? name.toLowerCase().replace(/\W+/g, '-')}`
  const servings = [{ id: `${id}:100g`, label: '100 g', grams: 100 }]
  const size = num(p.serving_quantity)
  if (size > 0) servings.unshift({ id: `${id}:serving`, label: p.serving_size || '1 serving', grams: size })

  return {
    id,
    name: name.trim(),
    brand: firstBrand(p.brands),
    per100,
    servings,
    defaultServingId: servings[0].id,
    source: 'off',
    barcode: p.code ? String(p.code) : undefined,
    needsReview: per100.kcal === 0 && per100.protein === 0,
    createdAt: Date.now(),
  }
}

/**
 * Tier-4 search. Returns [] rather than throwing for every failure mode
 * (offline, throttled, HTTP error, malformed JSON) because this tier is
 * strictly additive to local results and must never break the picker.
 *
 * Callers are responsible for debouncing (500 ms) and for only calling when the
 * local tiers returned too few matches.
 */
export async function searchOFF(query: string, signal?: AbortSignal): Promise<Food[]> {
  if (!SEARCH_SUPPORTED) return []
  const q = query.trim()
  if (q.length < MIN_QUERY) return []

  const cached = cache.get(q.toLowerCase())
  if (cached) return cached
  if (!offAvailable()) return []

  // One request in flight at a time; a newer query supersedes an older one.
  inFlight?.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true })

  hits.push(Date.now())
  try {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${PAGE_SIZE}`
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`OFF search failed: ${res.status}`)
      return []
    }
    const json = await res.json()
    const products: any[] = json?.hits ?? json?.products ?? []
    const foods = products.map(mapOffProduct).filter((f): f is Food => f !== null)
    cache.set(q.toLowerCase(), foods)
    return foods
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') console.warn('OFF search error', err)
    return []
  } finally {
    if (inFlight === ctrl) inFlight = null
  }
}
