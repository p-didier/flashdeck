// Pure card helpers shared by the app and scripts/validate-deck.js (no DB access).
//
// A stored card:
//   - id: string, v5(front, deckId) at creation. Never changes, even if front is edited.
//   - deckId: string, the deck it belongs to.
//   - front: string, the prompt.
//   - back: string, the answer.
//   - extra: string | null, shown under the answer (example, formula, pronunciation...).
//   - notes: string | null, the user's memory aid.
//   - importance: 'crucial' | 'important' | 'normal'.
//   - tags: string[], a YYYY-MM-DD date tag by default, plus anything the user adds.
//   - srs: scheduler state, see srs.js.
//
// An import card is the same minus id, deckId and srs. Only front and back are required.

import { v5 } from 'uuid'

export const IMPORTANCES = ['crucial', 'important', 'normal']

/** Fresh scheduler state for a card first seen on `date` (YYYY-MM-DD). */
export const newSRS = date => ({ interval: 1, easeFactor: 2.5, repetitions: 0, lapses: 0, due: date })

/**
 * Deterministic card id, so re-importing the same file into the same deck
 * updates cards instead of duplicating them.
 *
 * Parameters
 * ----------
 * front : string
 *     Card front, trimmed before hashing.
 * deckId : string
 *     Deck UUID, used as the v5 namespace so two decks never share an id.
 *
 * Returns
 * -------
 * string
 *     UUID v5.
 */
export function cardId(front, deckId) {
  return v5(front.trim(), deckId)
}

const optionalString = v => v === undefined || v === null || typeof v === 'string'

/**
 * Check one card of an import file. Unknown keys (id, srs, anything else) are ignored.
 *
 * Parameters
 * ----------
 * card : any
 *     One element of the parsed JSON array.
 * i : number
 *     Its index, used in the message.
 *
 * Returns
 * -------
 * string | null
 *     A user-facing error, or null when the card is valid.
 */
export function validateImportCard(card, i) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return `Card ${i}: not an object`
  if (typeof card.front !== 'string' || !card.front.trim()) return `Card ${i}: missing "front"`
  if (typeof card.back !== 'string' || !card.back.trim()) return `Card ${i}: missing "back"`
  if (!optionalString(card.extra)) return `Card ${i}: "extra" must be text`
  if (!optionalString(card.notes)) return `Card ${i}: "notes" must be text`
  if (card.importance !== undefined && !IMPORTANCES.includes(card.importance))
    return `Card ${i}: "importance" must be one of ${IMPORTANCES.join(', ')}`
  if (card.tags !== undefined && !(Array.isArray(card.tags) && card.tags.every(t => typeof t === 'string')))
    return `Card ${i}: "tags" must be a list of text`
  return null
}

const clean = v => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Build a new stored card from an import-shaped card.
 *
 * Parameters
 * ----------
 * raw : object
 *     A card that passed validateImportCard.
 * deckId : string
 *     Target deck UUID.
 * today : string
 *     YYYY-MM-DD, used as the due date and as the default tag.
 *
 * Returns
 * -------
 * object
 *     A stored card, see the header of this file.
 */
export function toCard(raw, deckId, today) {
  const front = raw.front.trim()
  return {
    id: cardId(front, deckId),
    deckId,
    front,
    back: raw.back.trim(),
    extra: clean(raw.extra),
    notes: clean(raw.notes),
    importance: raw.importance ?? 'normal',
    tags: raw.tags?.length ? [...new Set(raw.tags)] : [today],
    srs: newSRS(today),
  }
}

/**
 * Fields to update when an imported card matches a stored one by id.
 *
 * Fields the file states overwrite the stored ones. Fields it leaves out stay,
 * so a file without notes never wipes notes typed in the app. Tags are merged,
 * so the app-managed `leech` tag survives. `front` and `srs` are never touched,
 * which keeps an in-app front correction and all review progress.
 *
 * Parameters
 * ----------
 * existing : object
 *     The stored card.
 * raw : object
 *     The incoming import card.
 *
 * Returns
 * -------
 * object
 *     Partial card for a Dexie update.
 */
export function mergeImport(existing, raw) {
  const fields = { back: raw.back.trim() }
  if (raw.extra !== undefined) fields.extra = clean(raw.extra)
  if (raw.notes !== undefined) fields.notes = clean(raw.notes)
  if (raw.importance !== undefined) fields.importance = raw.importance
  if (raw.tags?.length) fields.tags = [...new Set([...(existing.tags ?? []), ...raw.tags])]
  return fields
}

/** Font size class for the card front, bucketed by length so long fronts shrink. */
// ponytail: character count stands in for rendered width. Measure-and-fit only if a real card overflows.
export function frontSizeClass(text) {
  const n = [...(text ?? '')].length
  return n <= 5 ? 'text-6xl' : n <= 9 ? 'text-5xl' : n <= 14 ? 'text-4xl' : n <= 24 ? 'text-3xl' : n <= 60 ? 'text-2xl' : 'text-xl'
}
