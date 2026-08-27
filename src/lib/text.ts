/**
 * One normaliser, shared by the exercise library and the food catalog.
 *
 * It lived in both modules and drifted: the exercise side stripped a trailing
 * plural and the food side did not, so "eggs" — the single most-logged word in
 * the real data — matched nothing. Search and every migration that matches a
 * typed label must agree on what counts as the same name.
 *
 * Lowercase, strip punctuation, collapse whitespace. Deliberately does NOT
 * reorder words: "shoulder press machine" and "shoulder machine press"
 * normalise differently and are reunited by an explicit alias, not by the
 * normaliser guessing at intent.
 */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when two typed names mean the same thing, ignoring a trailing plural on
 * either side — "2 eggs" and "Egg", "Upright Rows" and "upright row".
 *
 * A predicate rather than a canonical form because singularising is lossy:
 * "Dips" and "Shrugs" are named plural on purpose, and collapsing them would
 * make them collide with anything ending in the same stem.
 */
export function sameName(a: string, b: string): boolean {
  const x = normaliseName(a), y = normaliseName(b)
  if (x === y) return true
  return x.replace(/s$/, '') === y.replace(/s$/, '')
}
