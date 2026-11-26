// Pure-logic checks, run with `npm test` (node --test, no browser, no DB).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { cardId, mergeImport, toCard, validateImportCard } from '../src/cards.js'
import { parseBatch, parseBatchEntry } from '../src/batch.js'
import { applyDailyLimits, effectiveQ, fuzzInterval, recordResponseTime, updateSRS } from '../src/srs.js'
import { applyRating } from '../src/db.js'
import { mergeLogRow, parseBackup } from '../src/backup.js'

const T = '2024-01-01'
const noFuzz = x => Math.round(x) // deterministic intervals
const DECK_A = '6f1c2b1e-8e0a-4c55-9b7e-0d2f4a1b3c5d'
const DECK_B = '0b5e9f3a-2c4d-4e6f-8a1b-3c5d7e9f1a2b'

test('srs: learning phase', () => {
  const card = { interval: 1, easeFactor: 2.5, repetitions: 0, due: T, lapses: 0 }
  assert.deepEqual([updateSRS(card, 3, T, { fuzz: noFuzz }).repetitions, updateSRS(card, 3, T, { fuzz: noFuzz }).interval], [1, 1])
  assert.equal(updateSRS(card, 5, T, { fuzz: noFuzz }).interval, 4)
  assert.equal(updateSRS(card, 0, T, { fuzz: noFuzz }).repetitions, 0)
})

test('srs: review phase (Anki modified SM-2)', () => {
  const rev = { interval: 10, easeFactor: 2.5, repetitions: 2, due: T, lapses: 0 }
  const hard = updateSRS(rev, 2, T, { fuzz: noFuzz })
  assert.equal(hard.interval, 12)
  assert.ok(Math.abs(hard.easeFactor - 2.35) < 1e-9)
  assert.equal(updateSRS(rev, 3, T, { fuzz: noFuzz }).interval, 25)
  assert.equal(updateSRS(rev, 5, T, { fuzz: noFuzz }).interval, Math.round(10 * 2.65 * 1.3))
  const lapse = updateSRS(rev, 0, T, { fuzz: noFuzz })
  assert.deepEqual([lapse.lapses, lapse.interval, lapse.repetitions], [1, 1, 1])
  assert.ok(updateSRS({ ...rev, easeFactor: 1.3 }, 0, T, { fuzz: noFuzz }).easeFactor >= 1.3, 'ease floor')
  assert.equal(updateSRS(rev, 3, T, { fuzz: noFuzz }).due, '2024-01-26')
})

test('srs: repeat Again in one session is relearning, not another lapse', () => {
  const rev = { interval: 30, easeFactor: 2.5, repetitions: 5, due: T, lapses: 0 }
  let s = updateSRS(rev, 0, T, { fuzz: noFuzz })
  for (let i = 0; i < 7; i++) s = updateSRS(s, 0, T, { fuzz: noFuzz, relearning: true })
  assert.deepEqual([s.lapses, s.easeFactor, s.interval, s.due], [1, 2.3, 1, '2024-01-02'])
  assert.equal(updateSRS(s, 3, T, { fuzz: noFuzz, relearning: true }).interval, 1, 'Good after relearning: 1 day')
  const fresh = { interval: 1, easeFactor: 2.5, repetitions: 0, due: T, lapses: 0 }
  assert.equal(updateSRS(fresh, 3, T, { relearning: true }).repetitions, 1, 'a new card still graduates')
})

test('log: only the first rating of a card counts, every clear counts', () => {
  const first = { first: true, isNew: true }
  const again = { first: false, isNew: true }
  let s = applyRating(undefined, 0, first, 1)
  s = applyRating(s, 0, again, 1)
  s = applyRating(s, 3, again, 1)
  assert.deepEqual([s.cardsReviewed, s.newReviewed, s.again, s.good, s.cleared], [1, 1, 1, 0, 1])
  s = applyRating(s, 3, again, -1)
  assert.deepEqual([s.cardsReviewed, s.cleared], [1, 0], 'undo of a repeat leaves the first rating')
})

test('backup: validation and history merge', () => {
  const ok = { app: 'flashdeck', decks: [], cards: [], reviewLog: [] }
  assert.doesNotThrow(() => parseBackup(ok))
  assert.throws(() => parseBackup({ ...ok, reviewLog: [{}] }), /no date/)
  assert.throws(() => parseBackup({ ...ok, cards: [{ id: 'a', deckId: 'd', srs: {} }] }), /schedule/)
  const stored = { date: T, A: { cardsReviewed: 9 }, B: { cardsReviewed: 1 } }
  const merged = mergeLogRow(stored, { date: T, A: { cardsReviewed: 3 }, B: { cardsReviewed: 4 }, C: { cardsReviewed: 2 } })
  assert.deepEqual([merged.A.cardsReviewed, merged.B.cardsReviewed, merged.C.cardsReviewed], [9, 4, 2])
})

test('srs: fuzz, response time, daily limits', () => {
  assert.equal(fuzzInterval(2, () => 0.5), 2)
  assert.ok(fuzzInterval(100, () => 0) >= 95 && fuzzInterval(100, () => 0.999) <= 105)
  const s = { interval: 6, easeFactor: 2.5, repetitions: 2, due: T }
  assert.equal(effectiveQ(s, 5, 5_000), 3, 'slow Easy becomes Good')
  assert.equal(effectiveQ(s, 5, 3_000), 5)
  assert.equal(recordResponseTime(recordResponseTime(s, 2_000), 4_000).avgResponseMs, 3_000)
  const mk = reps => ({ srs: { repetitions: reps } })
  const pool = [...Array(25)].map(() => mk(0)).concat([...Array(5)].map(() => mk(3)))
  assert.equal(applyDailyLimits(pool, {}).filter(c => c.srs.repetitions === 0).length, 20)
  assert.equal(applyDailyLimits(pool, { newDone: 18 }).filter(c => c.srs.repetitions === 0).length, 2)
})

test('cards: ids are stable per deck and differ across decks', () => {
  assert.equal(cardId('Oslo', DECK_A), cardId('  Oslo ', DECK_A))
  assert.notEqual(cardId('Oslo', DECK_A), cardId('Oslo', DECK_B))
})

test('cards: import validation', () => {
  assert.equal(validateImportCard({ front: 'a', back: 'b' }, 0), null)
  assert.equal(validateImportCard({ front: 'a', back: 'b', id: 'x', srs: {} }, 0), null, 'unknown keys are ignored')
  assert.match(validateImportCard({ back: 'b' }, 3), /Card 3: missing "front"/)
  assert.match(validateImportCard({ front: 'a', back: ' ' }, 0), /back/)
  assert.match(validateImportCard({ front: 'a', back: 'b', importance: 'high' }, 0), /importance/)
  assert.match(validateImportCard({ front: 'a', back: 'b', tags: 'x' }, 0), /tags/)
  assert.match(validateImportCard({ front: 'a', back: 'b', extra: 3 }, 0), /extra/)
  assert.match(validateImportCard([], 0), /not an object/)
})

test('cards: toCard fills defaults', () => {
  const c = toCard({ front: ' Oslo ', back: 'Norway', extra: '  ' }, DECK_A, T)
  assert.equal(c.front, 'Oslo')
  assert.equal(c.extra, null)
  assert.equal(c.importance, 'normal')
  assert.deepEqual(c.tags, [T])
  assert.deepEqual([c.srs.repetitions, c.srs.due], [0, T])
})

test('cards: re-import keeps front, srs, unstated fields and tags', () => {
  const stored = { ...toCard({ front: 'Oslo', back: 'old', notes: 'mine' }, DECK_A, T), tags: [T, 'leech'] }
  const upd = mergeImport(stored, { front: 'Oslo', back: 'new', tags: ['europe'] })
  assert.equal(upd.back, 'new')
  assert.ok(!('notes' in upd) && !('front' in upd) && !('srs' in upd) && !('importance' in upd))
  assert.deepEqual(upd.tags, [T, 'leech', 'europe'])
  assert.equal(mergeImport(stored, { front: 'Oslo', back: 'b', notes: null }).notes, null, 'a stated null clears')
})

test('batch: parsing', () => {
  assert.deepEqual(parseBatchEntry('Japan = Tokyo'), { front: 'Japan', back: 'Tokyo', importance: 'normal' })
  assert.equal(parseBatchEntry('!! a = b').importance, 'crucial')
  assert.equal(parseBatchEntry('! a = b').importance, 'important')
  assert.equal(parseBatchEntry('1 + 1 = 2 = two').back, '2 = two', 'split on the first "="')
  assert.equal(parseBatchEntry('   '), null)
  assert.ok(parseBatchEntry('no separator').error)
  assert.ok(parseBatchEntry('= b').error && parseBatchEntry('a =').error)

  const { cards, errors } = parseBatch('!! a = 1; b = 2\nc = 3;;  \nbroken\na = again', T)
  assert.equal(cards.length, 3)
  assert.equal(errors.length, 2, 'unreadable line and repeated front are both reported')
  assert.deepEqual(cards[0].tags, [T])
})

test('sample deck passes import validation', () => {
  const sample = JSON.parse(fs.readFileSync(new URL('../decks/sample.json', import.meta.url), 'utf8'))
  assert.ok(sample.length >= 10)
  assert.deepEqual(sample.map(validateImportCard).filter(Boolean), [])
  assert.equal(new Set(sample.map(c => c.front)).size, sample.length, 'fronts are unique')
})
