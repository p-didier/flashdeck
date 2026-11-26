// Full-database backup and restore.
//
// IndexedDB lives in one browser on one device and nothing syncs. A backup file
// is the only copy of review progress and history outside it.

import { db } from './db.js'
import { getToday } from './srs.js'

// Stored shape version, so a later app version can transform an older file before writing it.
export const BACKUP_SCHEMA = 1
const APP = 'flashdeck'
const LAST_BACKUP_KEY = 'last-backup'

/** Pure: assemble the dump object from raw table contents. */
export function buildBackup(decks, cards, reviewLog) {
  return { app: APP, schema: BACKUP_SCHEMA, takenAt: new Date().toISOString(), decks, cards, reviewLog }
}

/**
 * Pure: validate a parsed backup file.
 *
 * Throws instead of restoring what it can. bulkPut overwrites by id, so a
 * partial write of a corrupt file would replace good cards with bad ones.
 *
 * Parameters
 * ----------
 * data : any
 *     Parsed JSON.
 *
 * Returns
 * -------
 * object
 *     `{ decks, cards, reviewLog }`, arrays ready for restoreBackup.
 */
export function parseBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Not a backup file. A card import is a list, a backup is an object.')
  if (data.app !== APP) throw new Error('Not a flashdeck backup file.')
  for (const key of ['decks', 'cards', 'reviewLog'])
    if (!Array.isArray(data[key])) throw new Error(`Backup is missing its ${key} list.`)
  if ((data.schema ?? BACKUP_SCHEMA) > BACKUP_SCHEMA)
    throw new Error(`Backup is from a newer version of the app (schema ${data.schema}). Update the app first.`)

  const badDeck = data.decks.findIndex(d => !d || typeof d.id !== 'string' || typeof d.name !== 'string')
  if (badDeck !== -1) throw new Error(`Deck ${badDeck} has no id or name. Nothing was restored.`)
  const badCard = data.cards.findIndex(c => !c || typeof c.id !== 'string' || typeof c.deckId !== 'string' || !c.srs)
  if (badCard !== -1) throw new Error(`Card ${badCard} has no id, deck or srs. Nothing was restored.`)

  return { decks: data.decks, cards: data.cards, reviewLog: data.reviewLog }
}

/**
 * Hand the file to the OS. The share sheet comes first because a blob download
 * is unreliable inside an installed PWA. A dismissed share sheet must not fall
 * through to a download, or cancelling looks broken.
 */
async function shareOrDownload(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

/** Read every table, build the dump, hand it to the OS, and remember when. */
export async function exportBackup() {
  const [decks, cards, reviewLog] = await Promise.all([db.decks.toArray(), db.cards.toArray(), db.reviewLog.toArray()])
  const file = new File([JSON.stringify(buildBackup(decks, cards, reviewLog))], `flashdeck-backup-${getToday()}.json`,
    { type: 'application/json' })
  const outcome = await shareOrDownload(file)
  if (outcome !== 'cancelled') {
    try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()) } catch { /* private mode */ }
  }
  return { outcome, decks: decks.length, cards: cards.length, days: reviewLog.length }
}

/** Date of the last backup taken in this browser, or null. */
export function lastBackupAt() {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    return v ? new Date(v) : null
  } catch {
    return null
  }
}

/**
 * Write a validated backup back. bulkPut overwrites matching ids and leaves
 * everything else alone, so a restore merges instead of wiping: cards added
 * since the backup was taken survive.
 */
export async function restoreBackup({ decks, cards, reviewLog }) {
  await db.transaction('rw', db.decks, db.cards, db.reviewLog, async () => {
    await db.decks.bulkPut(decks)
    await db.cards.bulkPut(cards)
    await db.reviewLog.bulkPut(reviewLog)
  })
}
