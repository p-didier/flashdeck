import { useState } from 'react'
import { Link } from 'react-router-dom'
import DeckBadge from '../components/DeckBadge.jsx'
import { useDeck } from '../DeckContext.jsx'
import { exportBackup, parseBackup, restoreBackup } from '../backup.js'
import { cardId, validateImportCard } from '../cards.js'
import { upsertCards } from '../db.js'
import { getToday } from '../srs.js'

// Errors listed before "…and N more".
const MAX_ERRORS_SHOWN = 5

async function readJson(file) {
  try {
    return JSON.parse(await file.text())
  } catch {
    throw new Error('Could not read the file. Is it valid JSON?')
  }
}

function BackupPanel() {
  const { reload } = useDeck()
  const [msg, setMsg]         = useState(null) // { ok, text }
  const [preview, setPreview] = useState(null)
  const [inputKey, setInputKey] = useState(0)

  async function handleBackup() {
    setMsg(null)
    try {
      const r = await exportBackup()
      if (r.outcome !== 'cancelled')
        setMsg({ ok: true, text: `Saved ${r.decks} decks, ${r.cards} cards and ${r.days} days of review history.` })
    } catch (err) {
      setMsg({ ok: false, text: `Backup failed: ${err.message}` })
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setMsg(null)
    try {
      setPreview(parseBackup(await readJson(file)))
    } catch (err) {
      setMsg({ ok: false, text: err.message })
      setInputKey(k => k + 1)
    }
  }

  async function handleRestore() {
    await restoreBackup(preview)
    await reload()
    setMsg({ ok: true, text: `Restored ${preview.decks.length} decks and ${preview.cards.length} cards.` })
    setPreview(null)
    setInputKey(k => k + 1)
  }

  return (
    <div className="w-full flex flex-col gap-3 p-4 bg-surface border border-border rounded-2xl">
      <h2 className="text-lg font-semibold">Backup</h2>
      <p className="text-xs text-muted leading-relaxed">
        Your cards and review history live only in this browser, on this device. Nothing syncs. Save a backup
        somewhere else (cloud drive, email to yourself) so clearing browser data cannot erase your progress.
      </p>
      <button onClick={handleBackup} className="w-full py-3 bg-accent rounded-xl font-semibold text-white">
        Back up all decks
      </button>

      {msg && <p className={`text-xs leading-relaxed ${msg.ok ? 'text-accent' : 'text-crucial'}`}>{msg.text}</p>}

      {preview ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-xs text-muted leading-relaxed">
            This file holds <strong>{preview.decks.length} decks</strong>, <strong>{preview.cards.length} cards</strong> and{' '}
            <strong>{preview.reviewLog.length} days</strong> of history. Restoring overwrites matching cards and keeps
            everything else.
          </p>
          <button onClick={handleRestore} className="w-full py-3 border border-accent rounded-xl font-semibold text-sm">
            Restore
          </button>
          <button onClick={() => { setPreview(null); setInputKey(k => k + 1) }} className="text-xs text-muted underline underline-offset-2">
            Cancel
          </button>
        </div>
      ) : (
        <label className="text-xs text-muted underline underline-offset-2 self-start cursor-pointer">
          Restore from a backup file
          <input key={inputKey} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  )
}

function ImportPanel() {
  const { deck, cards, reload } = useDeck()
  const [status, setStatus]   = useState('idle') // idle | error | preview | done
  const [message, setMessage] = useState('')
  const [parsed, setParsed]   = useState(null)
  const [inputKey, setInputKey] = useState(0)

  function reset() {
    setStatus('idle')
    setParsed(null)
    setInputKey(k => k + 1)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParsed(null)
    try {
      const data = await readJson(file)
      if (data?.app === 'flashdeck') throw new Error('This is a backup file. Use "Restore from a backup file" above.')
      if (!Array.isArray(data)) throw new Error('Expected a JSON list of cards, like [{"front": "…", "back": "…"}].')
      if (data.length === 0) throw new Error('The file holds no cards.')
      // All or nothing, so a half-broken file never leaves half a deck behind.
      const errors = data.map(validateImportCard).filter(Boolean)
      if (errors.length) {
        const more = errors.length - MAX_ERRORS_SHOWN
        throw new Error(`${errors.length} card(s) failed:\n${errors.slice(0, MAX_ERRORS_SHOWN).join('\n')}${more > 0 ? `\n…and ${more} more` : ''}`)
      }
      setParsed(data)
      setStatus('preview')
    } catch (err) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  async function handleConfirm() {
    const { added, updated } = await upsertCards(parsed, deck.id, getToday())
    await reload()
    setMessage(`${added} added, ${updated} updated.`)
    setStatus('done')
    setParsed(null)
    setInputKey(k => k + 1)
  }

  if (!deck) {
    return <p className="text-sm text-muted">Create a deck on <Link to="/" className="underline">Home</Link> before importing cards.</p>
  }

  const existing = new Set(cards.map(c => c.id))
  const updates = parsed ? parsed.filter(c => existing.has(cardId(c.front, deck.id))).length : 0

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Import cards</h2>
        <DeckBadge />
      </div>
      <p className="text-xs text-muted leading-relaxed -mt-2">
        A JSON list of cards, added to the deck shown above. Re-importing the same file updates cards and keeps their
        progress. The <Link to="/help" className="underline">How to use</Link> page shows the format.
      </p>

      <label className="w-full flex flex-col items-center gap-3 p-8 bg-surface border-2 border-dashed border-border rounded-2xl cursor-pointer active:opacity-80">
        <span className="text-4xl">📂</span>
        <span className="text-sm text-muted text-center">Tap to select a .json file</span>
        <input key={inputKey} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
      </label>

      {status === 'error' && (
        <div className="w-full p-4 bg-surface border border-crucial/50 rounded-xl">
          <p className="text-sm font-semibold text-crucial mb-2">Import failed</p>
          <pre className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{message}</pre>
          <button onClick={reset} className="mt-3 text-xs text-muted underline underline-offset-2">Try another file</button>
        </div>
      )}

      {status === 'preview' && (
        <div className="w-full flex flex-col gap-3">
          <div className="p-4 bg-surface border border-border rounded-xl text-sm">
            <p className="font-semibold">{parsed.length} cards found</p>
            <p className="text-muted text-xs mt-1">{parsed.length - updates} new, {updates} already in "{deck.name}"</p>
          </div>
          <button onClick={handleConfirm} className="w-full py-4 bg-accent rounded-xl font-semibold text-white text-lg">
            Import into "{deck.name}"
          </button>
          <button onClick={reset} className="text-sm text-muted underline underline-offset-2">Cancel</button>
        </div>
      )}

      {status === 'done' && (
        <div className="w-full p-4 bg-surface border border-border rounded-xl text-center">
          <p className="text-accent font-semibold">Import complete</p>
          <p className="text-xs text-muted mt-1">{message}</p>
        </div>
      )}
    </div>
  )
}

export default function ImportScreen() {
  return (
    <div className="flex flex-col items-center px-6 py-8 gap-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold self-start">Import and backup</h1>
      <ImportPanel />
      <BackupPanel />
    </div>
  )
}
