import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DeckSheet from '../components/DeckSheet.jsx'
import TagSheet from '../components/TagSheet.jsx'
import { useDeck } from '../DeckContext.jsx'
import { lastBackupAt } from '../backup.js'
import { createDeck, getReviewLogEntry, upsertCards } from '../db.js'
import { DEFAULT_SESSION_CONFIG, applyDailyLimits, applySessionConfig, getToday } from '../srs.js'
import sampleDeck from '../../decks/sample.json'

// Per deck: tags rarely overlap between decks, so one shared config would carry
// tag selections into a deck where they match nothing and show 0 due.
const storageKey = deckId => `session-config:${deckId}`

// Days without a backup before Home shows a reminder.
const BACKUP_NUDGE_DAYS = 7

// Injected at build time (see vite.config.js), date of the last code update.
const LAST_UPDATED = new Date(__LAST_UPDATED__).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const IMPORTANCE_LEVELS = [
  { value: 'all',        label: 'All' },
  { value: 'important+', label: 'Important+' },
  { value: 'crucial',    label: 'Crucial only' },
]

function loadConfig(deckId) {
  try {
    const raw = localStorage.getItem(storageKey(deckId))
    if (raw) return { ...DEFAULT_SESSION_CONFIG, ...JSON.parse(raw) }
  } catch { /* private mode or corrupt value: use defaults */ }
  return DEFAULT_SESSION_CONFIG
}

function Centered({ children }) {
  return <div className="flex flex-col items-center justify-center min-h-[80dvh] gap-5 px-8 text-center">{children}</div>
}

/** First launch: no decks yet. */
function Welcome() {
  const { selectDeck } = useDeck()
  const [name, setName] = useState('')

  async function create() {
    if (name.trim()) await selectDeck(await createDeck(name))
  }

  async function loadSample() {
    const id = await createDeck('World capitals (sample)')
    await upsertCards(sampleDeck, id, getToday())
    await selectDeck(id)
  }

  return (
    <Centered>
      <div className="text-5xl">🗂</div>
      <div>
        <p className="text-2xl font-semibold">flashdeck</p>
        <p className="text-sm text-muted mt-1">Flashcards with spaced repetition, for anything you want to remember.</p>
      </div>
      <div className="w-full max-w-xs flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="Name your first deck"
          className="flex-1 min-w-0 bg-surface border border-border rounded-xl px-3 py-3 text-sm placeholder:text-muted"
        />
        <button onClick={create} disabled={!name.trim()} className="px-4 bg-accent rounded-xl font-semibold text-white disabled:opacity-40">
          Create
        </button>
      </div>
      <button onClick={loadSample} className="text-sm text-accent underline underline-offset-2">
        or try a sample deck
      </button>
      <Link to="/help" className="text-xs text-muted underline underline-offset-2">How to use</Link>
    </Centered>
  )
}

function BackupNudge() {
  const last = lastBackupAt()
  const days = last ? Math.floor((Date.now() - last) / 86_400_000) : null
  if (days !== null && days < BACKUP_NUDGE_DAYS) return null
  return (
    <Link to="/import" className="text-xs text-important underline underline-offset-2">
      {days === null ? 'No backup yet. Back up your cards' : `Last backup ${days} days ago. Back up now`}
    </Link>
  )
}

// iPadOS reports itself as a Mac, so a touch Mac counts as iOS too.
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const IS_INSTALLED = navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches

/**
 * Safari on iOS deletes a website's stored data after 7 days of browsing without
 * a visit to it. Apps added to the Home Screen are exempt, so ask for that.
 */
function IosInstallHint() {
  if (!IS_IOS || IS_INSTALLED) return null
  return (
    <p className="max-w-xs text-xs text-important leading-relaxed">
      On iPhone, Safari erases your cards after a week without opening this page. Tap Share, then{' '}
      <strong>Add to Home Screen</strong>, and open flashdeck from there.
    </p>
  )
}

function HomeInner() {
  const { deck, cards } = useDeck()
  const navigate = useNavigate()
  const [config, setConfig]             = useState(() => loadConfig(deck.id))
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [showDecks, setShowDecks]       = useState(false)
  const [todayLog, setTodayLog]         = useState(null)

  useEffect(() => {
    try { localStorage.setItem(storageKey(deck.id), JSON.stringify(config)) } catch { /* not persisted */ }
  }, [deck.id, config])

  // Today's usage in this deck, so the due count reflects its own daily caps.
  useEffect(() => { getReviewLogEntry(getToday(), deck.id).then(setTodayLog) }, [deck.id])

  const allTags = useMemo(() => [...new Set(cards.flatMap(c => c.tags ?? []))].sort(), [cards])

  const deckButton = (
    <button
      onClick={() => setShowDecks(true)}
      className="max-w-full flex items-center gap-2 px-4 py-1.5 bg-surface border border-border rounded-full text-sm font-medium"
    >
      <span className="truncate">{deck.name}</span>
      <span className="text-muted">▾</span>
    </button>
  )

  const today = getToday()
  const allDue = cards.filter(c => c.srs.due <= today)
  const dailyLimits = {
    newDone: todayLog?.newReviewed ?? 0,
    reviewDone: (todayLog?.cardsReviewed ?? 0) - (todayLog?.newReviewed ?? 0),
  }
  const dueCount = applyDailyLimits(applySessionConfig(allDue, { ...config, shuffle: false }), dailyLimits).length
  const isFiltered = dueCount !== allDue.length

  const chip = on => `flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
    on ? 'bg-accent border-accent text-white' : 'bg-bg border-border text-muted'
  }`

  return (
    <>
      {cards.length === 0 ? (
        <Centered>
          {deckButton}
          <p className="text-muted">No cards in this deck yet</p>
          <div className="flex flex-col w-full max-w-xs gap-2">
            <button onClick={() => navigate('/browse', { state: { newCard: true } })} className="w-full py-3 bg-accent rounded-xl font-semibold text-white">
              Add cards
            </button>
            <button onClick={() => navigate('/import')} className="w-full py-3 bg-surface border border-border rounded-xl font-medium">
              Import a file
            </button>
          </div>
          <Link to="/help" className="text-xs text-muted underline underline-offset-2">How to use</Link>
        </Centered>
      ) : (
        <Centered>
          {deckButton}

          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl font-bold tabular-nums text-accent">{dueCount}</span>
            <span className="text-muted text-sm">
              due today
              <span className="text-xs">{isFiltered && ` (${allDue.length} total)`}, {cards.length} cards</span>
            </span>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-2 bg-surface border border-border rounded-2xl p-3">
            <div className="flex gap-2">
              {IMPORTANCE_LEVELS.map(({ value, label }) => (
                <button key={value} onClick={() => setConfig(p => ({ ...p, importance: value }))} className={chip(config.importance === value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTagSheet(true)} className={chip(config.tags.length > 0)}>
                {config.tags.length > 0 ? `${config.tags.length} tag${config.tags.length > 1 ? 's' : ''}` : 'All tags'}
              </button>
              <button onClick={() => setConfig(p => ({ ...p, shuffle: !p.shuffle }))} className={chip(config.shuffle)}>
                Shuffle
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/review', { state: config })}
            disabled={dueCount === 0}
            className="w-full max-w-xs py-3.5 bg-accent rounded-xl font-semibold text-white text-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review
          </button>

          <BackupNudge />
          <IosInstallHint />
          <Link to="/help" className="text-xs text-muted underline underline-offset-2">How to use</Link>
        </Centered>
      )}

      <p className="text-center text-[10px] text-muted pb-4">Last app update on {LAST_UPDATED}</p>

      {showDecks && <DeckSheet onClose={() => setShowDecks(false)} />}
      {showTagSheet && (
        <TagSheet
          allTags={allTags}
          selected={config.tags}
          onConfirm={tags => { setConfig(p => ({ ...p, tags })); setShowTagSheet(false) }}
          onClose={() => setShowTagSheet(false)}
        />
      )}
    </>
  )
}

export default function HomeScreen() {
  const { deck, loading } = useDeck()
  if (loading) return <Centered><span className="text-muted text-sm">Loading…</span></Centered>
  if (!deck) return <Welcome />
  // Keyed on the deck so a switch re-reads session config and today's usage from scratch.
  return <HomeInner key={deck.id} />
}
