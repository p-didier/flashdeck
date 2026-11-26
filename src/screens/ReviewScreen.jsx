import { useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import FlipCard from '../components/FlipCard.jsx'
import EditForm from '../components/EditForm.jsx'
import { deleteCard, getDueCards, getReviewLogEntry, recordRating, unrecordRating, updateCard, updateCardSRS } from '../db.js'
import { useDeck } from '../DeckContext.jsx'
import { DEFAULT_SESSION_CONFIG, LEECH_THRESHOLD, applyDailyLimits, applySessionConfig, effectiveQ, getToday, recordResponseTime, updateSRS } from '../srs.js'

// ── Done screen ───────────────────────────────────────────────────────────────

const FINAL_RATING_META = [
  { q: 5, label: 'Easy', color: 'bg-green-700' },
  { q: 3, label: 'Good', color: 'bg-accent' },
  { q: 2, label: 'Hard', color: 'bg-important' },
]

function DoneScreen({ finalRatings, totalCards }) {
  const navigate = useNavigate()

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[80dvh] gap-8 px-6 text-center"
      style={{ animation: 'fadeScaleIn 0.35s ease both' }}
    >
      <div className="text-5xl">✓</div>

      <div>
        <p className="text-2xl font-semibold">Done for today</p>
        <p className="text-sm text-muted mt-1">{totalCards} cards reviewed</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2.5">
        {FINAL_RATING_META.map(({ q, label, color }) => {
          const count = finalRatings[q] ?? 0
          if (count === 0) return null
          const pct = totalCards > 0 ? (count / totalCards) * 100 : 0
          return (
            <div key={q} className="flex items-center gap-3">
              <span className="w-10 text-right text-xs text-muted">{label}</span>
              <div className="flex-1 h-5 bg-surface rounded-md overflow-hidden">
                <div className={`h-full ${color} rounded-md`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-4 text-xs text-muted text-right">{count}</span>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-surface border border-border rounded-xl font-medium text-sm"
      >
        Back to Home
      </button>
    </div>
  )
}

// ── Review screen ─────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const config   = location.state ?? DEFAULT_SESSION_CONFIG
  const { reload, deck, cards } = useDeck()
  const deckId = deck?.id

  const [queue, setQueue]               = useState([])
  // [{ card, prevSRS, q, first, addedLeech }]. q is the rating applied, first marks the card's first rating this session.
  const [history, setHistory]           = useState([])
  const [requeuedIds, setRequeuedIds]   = useState(new Set())
  const [clearedIds, setClearedIds]     = useState(new Set())
  const [finalRatings, setFinalRatings] = useState({ 2: 0, 3: 0, 5: 0 })
  const [sessionDone, setSessionDone]   = useState(false)
  const [loading, setLoading]           = useState(true)
  const [editingCard, setEditingCard]   = useState(null)
  const originalCountRef                = useRef(0)
  // Ids rated at least once this session. A second rating is relearning and is not logged again.
  const seenIdsRef                      = useRef(new Set())
  // Set while a rating or an undo is being written, so a double tap cannot rate twice or skip a card.
  const busyRef                         = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!deckId) { navigate('/', { replace: true }); return }
      const today = getToday()
      const [due, todayLog] = await Promise.all([getDueCards(today, deckId), getReviewLogEntry(today, deckId)])
      if (cancelled) return
      const filtered = applySessionConfig(due, config)
      // Cap the session at the day's remaining new/review allowance (Anki limits).
      const capped = applyDailyLimits(filtered, {
        newDone: todayLog?.newReviewed ?? 0,
        reviewDone: (todayLog?.cardsReviewed ?? 0) - (todayLog?.newReviewed ?? 0),
      })
      if (capped.length === 0) { navigate('/', { replace: true }); return }
      originalCountRef.current = capped.length
      setQueue(capped)
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  // config comes from location.state and is stable for this navigation. The deck
  // cannot change mid-session because the switch only exists on Home.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  useEffect(() => {
    if (!loading && !sessionDone && queue.length === 0) {
      // Ratings are logged per-card in handleRate, so nothing to flush here.
      setSessionDone(true)
      reload()
    }
  }, [queue.length, loading, sessionDone, reload])

  const isActive = !loading && !sessionDone && queue.length > 0
  const blocker = useBlocker(isActive)

  // Warn before a page refresh / close wipes the in-progress session
  useEffect(() => {
    if (!isActive) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isActive])

  async function handleRate(q, responseTimeMs) {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const card  = queue[0]
      const first = !seenIdsRef.current.has(card.id)
      const flags = { first, isNew: card.srs.repetitions === 0 }

      const qEff  = effectiveQ(card.srs, q, responseTimeMs)
      let newSRS  = updateSRS(card.srs, qEff, getToday(), { relearning: !first })
      if (responseTimeMs !== null) newSRS = recordResponseTime(newSRS, responseTimeMs)

      // Write at once, even for Again, so a closed tab loses nothing.
      await updateCardSRS(card.id, newSRS)
      // Log the rating now so partial/abandoned sessions still count (per-day).
      await recordRating(getToday(), deckId, qEff, originalCountRef.current, flags)
      seenIdsRef.current.add(card.id)

      let updatedCard = { ...card, srs: newSRS }

      // Leech: after 8 lapses (Anki default) the card gets a filterable tag. Nothing else happens.
      const addedLeech = newSRS.lapses >= LEECH_THRESHOLD && !(card.tags ?? []).includes('leech')
      if (addedLeech) {
        const tags = [...(card.tags ?? []), 'leech']
        await updateCard(card.id, { tags })
        updatedCard = { ...updatedCard, tags }
      }

      setHistory(prev => [...prev, { card, prevSRS: card.srs, q: qEff, first, addedLeech }])
      if (qEff === 0) {
        setQueue(prev => [...prev.slice(1), updatedCard])
        setRequeuedIds(prev => new Set([...prev, card.id]))
      } else {
        setQueue(prev => prev.slice(1))
        setRequeuedIds(prev => { const n = new Set(prev); n.delete(card.id); return n })
        setClearedIds(prev => new Set([...prev, card.id]))
        setFinalRatings(prev => ({ ...prev, [qEff]: prev[qEff] + 1 }))
      }
    } finally {
      busyRef.current = false
    }
  }

  async function handleBack() {
    const last = history[history.length - 1]
    if (!last || busyRef.current) return
    busyRef.current = true
    try {
      const { card, prevSRS, q, first, addedLeech } = last
      await updateCardSRS(card.id, prevSRS)
      await unrecordRating(getToday(), deckId, q, { first, isNew: prevSRS.repetitions === 0 })
      if (addedLeech) await updateCard(card.id, { tags: card.tags ?? [] })
      if (first) seenIdsRef.current.delete(card.id)
      setHistory(prev => prev.slice(0, -1))

      const restored = { ...card, srs: prevSRS }
      // An Again leaves the card at the queue tail, so take it out before putting it back in front.
      setQueue(prev => [restored, ...prev.filter(c => c.id !== card.id)])
      setRequeuedIds(prev => {
        const n = new Set(prev)
        // A repeat rating means the card had been failed earlier, so it is pending again.
        if (first) n.delete(card.id); else n.add(card.id)
        return n
      })
      if (q !== 0) {
        setClearedIds(prev => { const n = new Set(prev); n.delete(card.id); return n })
        setFinalRatings(prev => ({ ...prev, [q]: prev[q] - 1 }))
      }
    } finally {
      busyRef.current = false
    }
  }

  // Content change on one card, applied to the queue and to the undo history so an undo shows the new text.
  function patchCard(id, fields) {
    setQueue(prev => prev.map(c => (c.id === id ? { ...c, ...fields } : c)))
    setHistory(prev => prev.map(h => (h.card.id === id ? { ...h, card: { ...h.card, ...fields } } : h)))
  }

  // Change the current card's cruciality inline, without leaving the review.
  async function handleSetImportance(importance) {
    const card = queue[0]
    if (!card || card.importance === importance) return
    await updateCard(card.id, { importance })
    patchCard(card.id, { importance })
  }

  // Save edits made on the fly; merge content fields into the queued card.
  async function handleEditSave(fields) {
    const id = editingCard.id
    await updateCard(id, fields)
    patchCard(id, fields)
    setEditingCard(null)
  }

  async function handleEditDelete() {
    const id = editingCard.id
    await deleteCard(id)
    setQueue(prev => prev.filter(c => c.id !== id))
    // Undoing a rating of a deleted card would put it back on screen with nothing behind it.
    setHistory(prev => prev.filter(h => h.card.id !== id))
    setRequeuedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setEditingCard(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80dvh]">
        <span className="text-muted text-sm">Loading…</span>
      </div>
    )
  }

  if (sessionDone) {
    return <DoneScreen finalRatings={finalRatings} totalCards={originalCountRef.current} />
  }

  if (queue.length === 0) return null

  const originalCount = originalCountRef.current
  const clearedCount  = clearedIds.size
  const againPending  = requeuedIds.size
  const progress      = originalCount > 0 ? clearedCount / originalCount : 0

  return (
    <div className="flex flex-col pt-3 min-h-[80dvh]">
      <div className="px-4 pb-3">
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleBack}
                className="text-muted text-base leading-none px-1"
                aria-label="Go back"
              >
                ←
              </button>
            )}
            <span>{clearedCount} / {originalCount}</span>
          </div>
          {againPending > 0 && <span className="text-crucial">+{againPending} again</span>}
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center pb-4">
        <FlipCard
          // history.length in the key remounts the card after every rating, so a lone
          // card failed again comes back unflipped instead of stuck on its answer.
          key={`${queue[0].id}:${history.length}`}
          card={queue[0]}
          onRate={handleRate}
          onEdit={() => setEditingCard(queue[0])}
          onSetImportance={handleSetImportance}
        />
      </div>

      {editingCard && (
        <EditForm
          card={editingCard}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onCancel={() => setEditingCard(null)}
          cards={cards}
          deckId={deckId}
        />
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4 w-full max-w-sm">
            <p className="font-semibold">End session?</p>
            <p className="text-sm text-muted">Your progress so far is saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { reload(); blocker.proceed() }}
                className="flex-1 py-3 bg-crucial rounded-xl text-sm font-semibold text-white"
              >
                End
              </button>
              <button
                onClick={() => blocker.reset()}
                className="flex-1 py-3 bg-surface border border-border rounded-xl text-sm font-semibold"
              >
                Keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
