import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DeckBadge from '../components/DeckBadge.jsx'
import EditForm from '../components/EditForm.jsx'
import { useDeck } from '../DeckContext.jsx'
import { IMPORTANCES } from '../cards.js'
import { deleteCard, updateCard, upsertCards } from '../db.js'
import { getToday } from '../srs.js'

const CHIP_ACTIVE = {
  crucial:   'bg-crucial border-crucial text-white',
  important: 'bg-important border-important text-white',
  normal:    'bg-accent border-accent text-white',
}

const SORT_OPTIONS = [
  { key: 'date',  label: 'Date added (newest first)' },
  { key: 'front', label: 'Front (A → Z)' },
  { key: 'back',  label: 'Back (A → Z)' },
]

// Case- and accent-insensitive key, so "cafe" finds "café".
function fold(str) {
  return (str ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Newest date tag on the card, or a floor so undated cards sort last.
function cardDate(card) {
  const dates = (card.tags ?? []).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t))
  return dates.length ? dates.sort().at(-1) : '0000-00-00'
}

export default function BrowseScreen() {
  const { deck, cards, loading, reload } = useDeck()
  const location = useLocation()
  const [selectedTag, setSelectedTag]             = useState('all')
  const [activeImportances, setActiveImportances] = useState(new Set())
  const [searchQuery, setSearchQuery]             = useState('')
  const [sortKey, setSortKey]                     = useState('date')
  const [showSortSheet, setShowSortSheet]         = useState(false)
  const [selectedCard, setSelectedCard]           = useState(null)
  // undefined: no form. null: New Card form. card: editing that card. Home's "Add cards" opens it directly.
  const [editCard, setEditCard]                   = useState(location.state?.newCard ? null : undefined)
  const touchStartX                               = useRef(null)
  const touchStartY                               = useRef(null)

  function closeAll() {
    setEditCard(undefined)
    setSelectedCard(null)
  }

  async function handleSave(data) {
    if (editCard === null) await upsertCards([data], deck.id, getToday())
    else await updateCard(editCard.id, data)
    await reload()
    closeAll()
  }

  async function handleSaveMany(newCards) {
    await upsertCards(newCards, deck.id, getToday())
    await reload()
    closeAll()
  }

  async function handleDelete() {
    await deleteCard(editCard.id)
    await reload()
    closeAll()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[80dvh] text-muted text-sm">Loading…</div>
  }
  if (!deck) {
    return <div className="flex items-center justify-center min-h-[80dvh] text-muted text-sm px-8 text-center">Create a deck on Home first.</div>
  }

  const allTags = [...new Set(cards.flatMap(c => c.tags ?? []))].sort()
  const q = fold(searchQuery.trim())

  const filtered = cards.filter(c =>
    (selectedTag === 'all' || c.tags?.includes(selectedTag))
    && (activeImportances.size === 0 || activeImportances.has(c.importance))
    && (q === '' || [c.front, c.back, c.extra].some(f => fold(f).includes(q))))

  const sorted = [...filtered].sort((a, b) =>
    sortKey === 'date' ? cardDate(b).localeCompare(cardDate(a))
      : fold(a[sortKey]).localeCompare(fold(b[sortKey])))

  function toggleImportance(imp) {
    setActiveImportances(prev => {
      const next = new Set(prev)
      next.has(imp) ? next.delete(imp) : next.add(imp)
      return next
    })
  }

  // Swipe between cards of the visible (filtered and sorted) list while the detail sheet is open.
  const selectedIndex = selectedCard ? sorted.findIndex(c => c.id === selectedCard.id) : -1

  function goToOffset(delta) {
    const next = sorted[selectedIndex + delta]
    if (selectedIndex >= 0 && next) setSelectedCard(next)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.changedTouches[0].clientX
    touchStartY.current = e.changedTouches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    // Mostly-horizontal drags only, a vertical drag is scrolling the sheet.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goToOffset(dx < 0 ? 1 : -1)
  }

  return (
    <>
      <div className="flex flex-col">
        <div className="sticky top-0 z-10 bg-bg border-b border-border px-4 py-3 flex flex-col gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cards…"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted"
          />

          <div className="flex gap-2 items-center">
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <DeckBadge />
            <button
              onClick={() => setShowSortSheet(true)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg border text-sm font-medium ${
                sortKey !== 'date' ? 'bg-accent border-accent text-white' : 'bg-surface border-border text-muted'
              }`}
              aria-label="Sort"
            >
              ⇅
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {IMPORTANCES.map(imp => (
              <button
                key={imp}
                onClick={() => toggleImportance(imp)}
                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                  activeImportances.has(imp) ? CHIP_ACTIVE[imp] : 'bg-surface border-border text-muted'
                }`}
              >
                {imp}
              </button>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            {cards.length === 0 ? 'No cards yet. Tap + to add some.' : 'No cards match'}
          </div>
        ) : (
          <ul>
            {sorted.map(card => (
              <li
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className="flex items-baseline gap-3 px-4 py-3 border-b border-border active:bg-surface cursor-pointer"
              >
                <span className="font-medium truncate max-w-[50%] flex-shrink-0">{card.front}</span>
                <span className="text-sm text-muted truncate">{card.back}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!selectedCard && editCard === undefined && !showSortSheet && (
        <button
          onClick={() => setEditCard(null)}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-accent text-white text-3xl flex items-center justify-center shadow-lg active:opacity-80 z-40"
          aria-label="New card"
        >
          +
        </button>
      )}

      {showSortSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowSortSheet(false)}>
          <div className="w-full bg-surface rounded-t-2xl border-t border-border pb-10" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">Sort by</span>
              <button onClick={() => setShowSortSheet(false)} className="text-muted text-2xl leading-none w-8 h-8">×</button>
            </div>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setSortKey(opt.key); setShowSortSheet(false) }}
                className={`w-full text-left px-4 py-4 border-b border-border text-sm flex items-center justify-between ${
                  sortKey === opt.key ? 'text-accent font-medium' : ''
                }`}
              >
                {opt.label}
                {sortKey === opt.key && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {editCard !== undefined && (
        <EditForm
          card={editCard}
          onSave={handleSave}
          onSaveMany={handleSaveMany}
          onDelete={handleDelete}
          onCancel={() => setEditCard(undefined)}
        />
      )}

      {selectedCard && editCard === undefined && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setSelectedCard(null)}>
          <div
            className="bg-surface rounded-t-2xl border-t border-border p-6 pb-10 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium capitalize ${
                selectedCard.importance === 'crucial' ? 'text-crucial' : selectedCard.importance === 'important' ? 'text-important' : 'text-muted'
              }`}>
                {selectedCard.importance}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditCard(selectedCard)} className="text-sm text-accent underline underline-offset-2">Edit</button>
                <button onClick={() => setSelectedCard(null)} className="text-muted text-2xl leading-none w-8 h-8">×</button>
              </div>
            </div>

            <p className="text-3xl text-center py-3 leading-tight break-words whitespace-pre-wrap">{selectedCard.front}</p>
            <p className="text-lg leading-snug whitespace-pre-wrap">{selectedCard.back}</p>
            {selectedCard.extra && <p className="text-sm text-muted leading-snug whitespace-pre-wrap">{selectedCard.extra}</p>}

            {selectedCard.notes && (
              <div className="p-3 bg-bg rounded-xl border border-border">
                <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm leading-snug whitespace-pre-wrap">{selectedCard.notes}</p>
              </div>
            )}

            {selectedCard.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCard.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-border text-[11px] text-muted">{t}</span>
                ))}
              </div>
            )}

            <div className="mt-2 pt-3 border-t border-border">
              <p className="text-xs text-muted mb-2 uppercase tracking-wide">Schedule</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted">
                <span>Due</span>      <span className="text-right">{selectedCard.srs.due}</span>
                <span>Interval</span> <span className="text-right">{selectedCard.srs.interval}d</span>
                <span>Ease</span>     <span className="text-right">{selectedCard.srs.easeFactor.toFixed(2)}</span>
                <span>Reviews</span>  <span className="text-right">{selectedCard.srs.repetitions}</span>
                <span>Lapses</span>   <span className="text-right">{selectedCard.srs.lapses ?? 0}</span>
              </div>
            </div>

            {sorted.length > 1 && selectedIndex >= 0 && (
              <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted select-none">
                <button onClick={() => goToOffset(-1)} disabled={selectedIndex === 0} className="disabled:opacity-30 px-1">‹ prev</button>
                <span>{selectedIndex + 1} / {sorted.length}</span>
                <button onClick={() => goToOffset(1)} disabled={selectedIndex === sorted.length - 1} className="disabled:opacity-30 px-1">next ›</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
