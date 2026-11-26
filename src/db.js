import Dexie from 'dexie'
import { mergeImport, toCard } from './cards.js'

export const db = new Dexie('flashdeck')

// - decks: { id, name, createdAt }
// - cards: see cards.js
// - reviewLog: one row per day, { date, [deckId]: counters }. Counters are nested
//   under the date key so the Streak can sum all decks from one row.
db.version(1).stores({
  decks: 'id, createdAt',
  cards: 'id, deckId, srs.due, *tags',
  reviewLog: 'date',
})

// ── Decks ─────────────────────────────────────────────────────────────────────

/** Create a deck and return its id. */
export async function createDeck(name) {
  const id = crypto.randomUUID()
  await db.decks.add({ id, name: name.trim(), createdAt: new Date().toISOString() })
  return id
}

export async function renameDeck(id, name) {
  await db.decks.update(id, { name: name.trim() })
}

/** Delete a deck and all its cards. Review history stays, so the Streak keeps past days. */
export async function deleteDeck(id) {
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.cards.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}

// ── Cards ─────────────────────────────────────────────────────────────────────

const IMPORTANCE_ORDER = { crucial: 0, important: 1, normal: 2 }

/** Cards in one deck due on or before today, importance first, then most overdue first. */
export async function getDueCards(today, deckId) {
  const cards = await db.cards.where('srs.due').belowOrEqual(today).and(c => c.deckId === deckId).toArray()
  return cards.sort((a, b) =>
    IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || a.srs.due.localeCompare(b.srs.due))
}

/**
 * Insert or merge import-shaped cards into a deck. The one write path for
 * file import, Batch Entry, the sample deck and the New Card form.
 *
 * Parameters
 * ----------
 * rawCards : object[]
 *     Cards that passed validateImportCard (cards.js).
 * deckId : string
 *     Target deck.
 * today : string
 *     YYYY-MM-DD for new cards.
 *
 * Returns
 * -------
 * object
 *     `{ added, updated }` counts.
 */
export async function upsertCards(rawCards, deckId, today) {
  let added = 0
  let updated = 0
  await db.transaction('rw', db.cards, async () => {
    for (const raw of rawCards) {
      const card = toCard(raw, deckId, today)
      const existing = await db.cards.get(card.id)
      if (existing) { await db.cards.update(card.id, mergeImport(existing, raw)); updated++ }
      else { await db.cards.add(card); added++ }
    }
  })
  return { added, updated }
}

/** Persist SRS state after a review rating. */
export async function updateCardSRS(id, srs) {
  await db.cards.update(id, { srs })
}

/** Update content fields of an existing card (never touches srs). */
export async function updateCard(id, fields) {
  await db.cards.update(id, fields)
}

export async function deleteCard(id) {
  await db.cards.delete(id)
}

// ── Review log ────────────────────────────────────────────────────────────────

const RATING_FIELD = { 0: 'again', 2: 'hard', 3: 'good', 5: 'easy' }
const EMPTY_DAY = { cardsReviewed: 0, again: 0, hard: 0, good: 0, easy: 0, queued: 0, newReviewed: 0 }

/**
 * Record one rating as it happens, so abandoned sessions still count.
 *
 * Parameters
 * ----------
 * date : string
 *     YYYY-MM-DD.
 * deckId : string
 *     Deck the card belongs to.
 * q : number
 *     Rating, 0 | 2 | 3 | 5.
 * queued : number
 *     Size of the session. The day keeps the largest, which is the Day Completion denominator.
 * isNew : boolean
 *     The card had never been reviewed. Counts toward the daily new-card limit.
 */
export async function recordRating(date, deckId, q, queued, isNew = false) {
  const field = RATING_FIELD[q]
  if (!field) return
  await db.transaction('rw', db.reviewLog, async () => {
    const row = (await db.reviewLog.get(date)) ?? { date }
    const s = row[deckId] ?? EMPTY_DAY
    await db.reviewLog.put({
      ...row,
      [deckId]: {
        ...s,
        cardsReviewed: s.cardsReviewed + 1,
        [field]: s[field] + 1,
        queued: Math.max(s.queued, queued),
        newReviewed: s.newReviewed + (isNew ? 1 : 0),
      },
    })
  })
}

/** Reverse a single rating, used by the in-session undo. */
export async function unrecordRating(date, deckId, q, isNew = false) {
  const field = RATING_FIELD[q]
  if (!field) return
  await db.transaction('rw', db.reviewLog, async () => {
    const row = await db.reviewLog.get(date)
    const s = row?.[deckId]
    if (!s) return
    await db.reviewLog.put({
      ...row,
      [deckId]: {
        ...s,
        cardsReviewed: Math.max(0, s.cardsReviewed - 1),
        [field]: Math.max(0, s[field] - 1),
        newReviewed: Math.max(0, s.newReviewed - (isNew ? 1 : 0)),
      },
    })
  })
}

/** All review log rows, oldest first. */
export async function getReviewLog() {
  return db.reviewLog.orderBy('date').toArray()
}

/** One day's counters for one deck, or undefined. */
export async function getReviewLogEntry(date, deckId) {
  const row = await db.reviewLog.get(date)
  return row?.[deckId]
}

/** Cards reviewed on one log row, summed over every deck (deleted ones too). Used by the Streak. */
export function dayTotal(row) {
  return Object.entries(row).reduce((n, [k, s]) => (k === 'date' ? n : n + (s.cardsReviewed ?? 0)), 0)
}
