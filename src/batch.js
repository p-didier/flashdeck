// Batch Entry: many cards from one paste, entries separated by `;` or a newline.
//
//   !! Canberra = capital of Australia; Ottawa = capital of Canada
//
// The text before the first `=` is the front, the rest is the back. A leading
// `!!` marks the card crucial, a single `!` important. Every card is tagged with
// the date of the paste.

/**
 * Parse one entry.
 *
 * Parameters
 * ----------
 * raw : string
 *     One entry, untrimmed.
 *
 * Returns
 * -------
 * object | null
 *     `{ front, back, importance }`, `{ error }`, or null for a blank entry.
 */
export function parseBatchEntry(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let s = trimmed
  let importance = 'normal'
  if (s.startsWith('!!'))     { importance = 'crucial';   s = s.slice(2).trim() }
  else if (s.startsWith('!')) { importance = 'important'; s = s.slice(1).trim() }

  const eq = s.indexOf('=')
  if (eq === -1) return { error: `"${trimmed}": no "=" between front and back` }

  const front = s.slice(0, eq).trim()
  const back = s.slice(eq + 1).trim()
  if (!front) return { error: `"${trimmed}": nothing before the "="` }
  if (!back)  return { error: `"${trimmed}": nothing after the "="` }

  return { front, back, importance }
}

/**
 * Parse a whole paste into import-shaped cards plus the entries that could not be read.
 *
 * Parameters
 * ----------
 * text : string
 *     The pasted text.
 * date : string
 *     YYYY-MM-DD tag given to every card.
 *
 * Returns
 * -------
 * object
 *     `{ cards, errors }`. cards: import cards (see cards.js), errors: string[].
 */
export function parseBatch(text, date) {
  const cards = []
  const errors = []
  const seen = new Set()

  for (const raw of text.split(/[;\n]/)) {
    const parsed = parseBatchEntry(raw)
    if (!parsed) continue
    if (parsed.error) { errors.push(parsed.error); continue }

    // Two entries with the same front would get the same id and collapse into one card.
    if (seen.has(parsed.front)) {
      errors.push(`"${parsed.front}" appears twice in this paste`)
      continue
    }
    seen.add(parsed.front)
    cards.push({ ...parsed, tags: [date] })
  }

  return { cards, errors }
}
