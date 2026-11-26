import { useEffect, useRef, useState } from 'react'
import { frontSizeClass } from '../cards.js'

const IMPORTANCE_DOT = {
  crucial:   'bg-crucial',
  important: 'bg-important',
  normal:    null,
}

// Tap-to-cycle order for the inline cruciality control on the solution screen
const IMPORTANCE_CYCLE = ['crucial', 'important', 'normal']

const IMPORTANCE_PILL = {
  crucial:   'bg-crucial text-white',
  important: 'bg-important text-white',
  normal:    'bg-bg border border-border text-muted',
}

const RATINGS = [
  { q: 0, label: 'Again', className: 'bg-crucial' },
  { q: 2, label: 'Hard',  className: 'bg-important' },
  { q: 3, label: 'Good',  className: 'bg-accent' },
  { q: 5, label: 'Easy',  className: 'bg-green-700' },
]

export default function FlipCard({ card, onRate, onEdit, onSetImportance }) {
  const [flipped, setFlipped]   = useState(false)
  const [declared, setDeclared] = useState(null) // 'know' | 'dontknow'
  const timerRef                = useRef(null)
  const responseTimeRef         = useRef(null)

  useEffect(() => {
    setFlipped(false)
    setDeclared(null)
    responseTimeRef.current = null
    timerRef.current = Date.now()
  // Reset only when the card changes. An in-place content update (importance,
  // an edit) must not unflip the answer.
  }, [card.id])

  function handleKnow() {
    responseTimeRef.current = Date.now() - timerRef.current
    setDeclared('know')
    setFlipped(true)
  }

  function handleDontKnow() {
    setDeclared('dontknow')
    setFlipped(true)
  }

  function handleCardTap() {
    if (declared === 'dontknow') onRate(0, null)
  }

  function cycleImportance(e) {
    e.stopPropagation()
    const next = IMPORTANCE_CYCLE[(IMPORTANCE_CYCLE.indexOf(card.importance) + 1) % IMPORTANCE_CYCLE.length]
    onSetImportance?.(next)
  }

  return (
    <div className="flex flex-col w-full gap-4 px-4">
      {/* 3D flip container */}
      <div
        style={{ perspective: '1200px' }}
        className={declared === 'dontknow' && flipped ? 'cursor-pointer' : ''}
        onClick={handleCardTap}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.4s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            position: 'relative',
            minHeight: '18rem',
          }}
        >
          {/* ── Front face ── */}
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 bg-surface border border-border rounded-2xl
                       flex items-center justify-center px-6"
          >
            {IMPORTANCE_DOT[card.importance] && (
              <span className={`absolute top-4 left-4 w-2.5 h-2.5 rounded-full ${IMPORTANCE_DOT[card.importance]}`} />
            )}
            <div className="flex flex-col items-center gap-2 w-full text-center">
              <span className={`${frontSizeClass(card.front)} leading-tight break-words whitespace-pre-wrap`}>{card.front}</span>
            </div>
          </div>

          {/* ── Back face ── */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 bg-surface border border-border rounded-2xl
                       flex flex-col p-5 gap-3 overflow-y-auto"
          >
            {/* Inline controls: cycle cruciality / edit on the fly */}
            <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
              <button
                onClick={cycleImportance}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${IMPORTANCE_PILL[card.importance]}`}
                aria-label={`Cruciality: ${card.importance}, tap to change`}
              >
                {card.importance}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onEdit?.() }}
                className="text-xs text-accent underline underline-offset-2"
              >
                Edit
              </button>
            </div>

            <p className="text-lg text-muted leading-snug whitespace-pre-wrap">{card.front}</p>
            <p className="text-2xl font-medium leading-snug whitespace-pre-wrap">{card.back}</p>
            {card.extra && <p className="text-sm text-muted leading-snug whitespace-pre-wrap">{card.extra}</p>}

            {card.notes && (
              <div className="mt-auto p-3 bg-bg rounded-xl border border-border">
                <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm leading-snug whitespace-pre-wrap">{card.notes}</p>
              </div>
            )}

            {declared === 'dontknow' && (
              <p className="text-center text-xs text-muted mt-1">tap to continue</p>
            )}
          </div>
        </div>
      </div>

      {/* Pre-flip: I Know / I Don't Know */}
      {!flipped && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDontKnow}
            className="py-3 rounded-xl text-sm font-semibold bg-surface border border-border text-white"
          >
            I Don't Know
          </button>
          <button
            onClick={handleKnow}
            className="py-3 rounded-xl text-sm font-semibold bg-green-700 text-white"
          >
            I Know
          </button>
        </div>
      )}

      {/* Post-flip: rating buttons (I Know path only) */}
      {flipped && declared === 'know' && (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map(({ q, label, className }) => (
            <button
              key={q}
              onClick={() => onRate(q, responseTimeRef.current)}
              className={`py-3 rounded-xl text-sm font-semibold text-white ${className}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
