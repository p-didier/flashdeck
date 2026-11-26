import { useEffect, useRef, useState } from 'react'
import DeckBadge from '../components/DeckBadge.jsx'
import { useDeck } from '../DeckContext.jsx'
import { dayTotal, getReviewLog } from '../db.js'
import { getToday } from '../srs.js'

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// `days`: Set of dates with activity in any deck. The Streak is the one figure
// here not scoped to the Active Deck, since a per-deck streak would sit near
// zero on decks you open less often.
function computeStreak(days, today) {
  const start = days.has(today) ? today
    : days.has(offsetDate(today, -1)) ? offsetDate(today, -1)
    : null
  if (!start) return 0
  let count = 0
  let cur = start
  while (days.has(cur)) { count++; cur = offsetDate(cur, -1) }
  return count
}

function retention(s) {
  const total = s.again + s.hard + s.good + s.easy
  return total > 0 ? (s.good + s.easy) / total : null
}

// Retention → fill colour (hex, so it works inside a conic-gradient).
function litColor(s) {
  const r = retention(s)
  if (r === null) return '#888888'      // muted
  if (r >= 0.8)  return '#15803d'       // green-700
  if (r >= 0.5)  return '#c8860a'       // important
  return '#c0392b'                      // crucial
}

// Moon fullness: cards cleared (hard+good+easy) ÷ the day's queued total.
// Legacy rows have no `queued` → treat as fully completed.
function completion(s) {
  const cleared = s.hard + s.good + s.easy
  if (!s.queued) return 1
  return Math.min(cleared / s.queued, 1)
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const RETENTION_ROWS = [
  { key: 'again', label: 'Again', color: 'bg-crucial' },
  { key: 'hard',  label: 'Hard',  color: 'bg-important' },
  { key: 'good',  label: 'Good',  color: 'bg-accent' },
  { key: 'easy',  label: 'Easy',  color: 'bg-green-700' },
]

const TIERS = [
  { label: 'New',      color: 'bg-muted',     match: c => c.srs.repetitions === 0 },
  { label: 'Learning', color: 'bg-important', match: c => c.srs.repetitions > 0 && c.srs.interval < 21 },
  { label: 'Mature',   color: 'bg-green-700', match: c => c.srs.interval >= 21 },
]

// ── Session Scatter ───────────────────────────────────────────────────────────

function SessionScatter({ sessions }) {
  const scrollRef  = useRef(null)
  const [active, setActive] = useState(null) // session object or null

  // Scroll to rightmost on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [sessions.length])

  if (sessions.length === 0) {
    return <p className="text-muted text-sm">No activity yet</p>
  }

  const maxCards = Math.max(...sessions.map(s => s.cardsReviewed), 1)
  const DOT_SIZE   = 15
  const COL_W      = 28
  const PLOT_H     = 100 // px, excludes label row
  const LABEL_H    = 20

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Each dot is one day. Height shows cards reviewed, fullness how much you finished, colour the retention.
      </p>

      <div className="flex gap-1.5">
        {/* Y-axis: cards reviewed */}
        <div
          style={{ height: PLOT_H }}
          className="flex flex-col justify-between items-end text-[9px] text-muted leading-none flex-shrink-0 pr-0.5"
        >
          <span className="tabular-nums">{maxCards}</span>
          <span className="-rotate-90 whitespace-nowrap origin-center">cards</span>
          <span className="tabular-nums">0</span>
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto pb-1 flex-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            style={{
              width: sessions.length * COL_W + COL_W,
              height: PLOT_H + LABEL_H,
              position: 'relative',
            }}
          >
            {sessions.map((s, i) => {
              const x    = i * COL_W + COL_W / 2
              const pct  = s.cardsReviewed / maxCards
              const y    = PLOT_H - DOT_SIZE / 2 - Math.round(pct * (PLOT_H - DOT_SIZE))
              const isActive = active?.id === s.id
              const lit  = litColor(s)
              const deg  = Math.round(completion(s) * 360)

              return (
                <button
                  key={s.id}
                  onClick={() => setActive(isActive ? null : s)}
                  style={{
                    position: 'absolute',
                    left: x - DOT_SIZE / 2,
                    top: y,
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: '9999px',
                    // Fullness = lit fraction (moon); ring keeps 0% dots visible.
                    background: `conic-gradient(${lit} ${deg}deg, transparent 0)`,
                    boxShadow: `inset 0 0 0 1.5px ${lit}`,
                  }}
                  className={isActive ? 'outline outline-2 outline-offset-1 outline-white' : ''}
                  aria-label={`${formatDate(s.date)}: ${s.cardsReviewed} reviewed, ${Math.round(completion(s) * 100)}% complete`}
                />
              )
            })}

            {/* Month labels on x-axis */}
            {sessions.map((s, i) => {
              const prev = sessions[i - 1]
              const isNewMonth = !prev || s.date.slice(0, 7) !== prev.date.slice(0, 7)
              if (!isNewMonth) return null
              return (
                <span
                  key={`lbl-${s.id}`}
                  style={{
                    position: 'absolute',
                    left: i * COL_W,
                    top: PLOT_H,
                    fontSize: 9,
                    whiteSpace: 'nowrap',
                  }}
                  className="text-muted"
                >
                  {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-[9px] text-muted text-center">date (older → newer) →</p>

      {/* Selected-day details (shown below the plot so it never clips) */}
      {active && (
        <div className="bg-surface border border-border rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">{formatDate(active.date)}</span>
          <span className="text-muted">{active.cardsReviewed} cards</span>
          <span className="text-muted">{Math.round(completion(active) * 100)}% done</span>
          <span className="text-muted">
            {retention(active) !== null
              ? `${Math.round(retention(active) * 100)}% retention`
              : 'no ratings'}
          </span>
        </div>
      )}

      {/* Colour legend */}
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-700 inline-block" /> ≥80%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-important inline-block" /> 50–79%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-crucial inline-block" /> &lt;50%</span>
      </div>
    </div>
  )
}

// ── Stats screen ──────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const { cards, deck } = useDeck()
  const deckId = deck?.id
  const [rows, setRows] = useState([])
  const [expandedTier, setExpandedTier] = useState(null) // tier label or null

  useEffect(() => { getReviewLog().then(setRows) }, [])

  const today = getToday()

  // One dot per day for the Active Deck. Days whose reviews were all undone are dropped.
  const log = rows
    .filter(r => (r[deckId]?.cardsReviewed ?? 0) > 0)
    .map(r => ({ ...r[deckId], date: r.date, id: r.date }))
  const sessions = log

  // ── Streak, every deck counts ─────────────────────────────────────────────
  const activeDays = new Set(rows.filter(r => dayTotal(r) > 0).map(r => r.date))
  const streak = computeStreak(activeDays, today)

  // ── Retention, last 7 days ────────────────────────────────────────────────
  const sevenDaysAgo = offsetDate(today, -6)
  const totals7 = log
    .filter(r => r.date >= sevenDaysAgo)
    .reduce(
      (a, r) => ({ again: a.again + r.again, hard: a.hard + r.hard, good: a.good + r.good, easy: a.easy + r.easy }),
      { again: 0, hard: 0, good: 0, easy: 0 }
    )
  const total7    = totals7.again + totals7.hard + totals7.good + totals7.easy
  const ret7      = total7 > 0 ? Math.round((totals7.good + totals7.easy) / total7 * 100) : null

  // ── Progress ──────────────────────────────────────────────────────────────
  // Per-tier card lists (most overdue first), so a tapped row can reveal which
  // cards it counts. Count is derived from the list length.
  const tierCards = TIERS.map(t =>
    cards.filter(t.match).sort((a, b) => a.srs.due.localeCompare(b.srs.due))
  )

  return (
    <div className="px-4 py-6 flex flex-col gap-8">

      <div className="flex justify-end -mb-4">
        <DeckBadge />
      </div>

      {/* Streak */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs text-muted uppercase tracking-wide">Streak, all decks</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold tabular-nums">{streak}</span>
          <span className="text-muted">{streak === 1 ? 'day' : 'days'}</span>
        </div>
      </section>

      {/* Session Scatter */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-muted uppercase tracking-wide">Activity</h2>
        <SessionScatter sessions={sessions} />
      </section>

      {/* Retention */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-muted uppercase tracking-wide">Retention, last 7 days</h2>
        {ret7 !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tabular-nums">{ret7}</span>
              <span className="text-2xl font-semibold text-muted">%</span>
            </div>
            <div className="flex flex-col gap-2">
              {RETENTION_ROWS.map(({ key, label, color }) => {
                const count = totals7[key]
                const pct   = total7 > 0 ? (count / total7) * 100 : 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-10 text-right text-xs text-muted">{label}</span>
                    <div className="flex-1 h-4 bg-bg rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-xs text-muted text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-muted text-sm">No reviews in the last 7 days</p>
        )}
      </section>

      {/* Progress */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-muted uppercase tracking-wide">Progress</h2>
        {cards.length === 0 ? (
          <p className="text-muted text-sm">No cards yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {TIERS.map(({ label, color }, i) => {
              const list     = tierCards[i]
              const count    = list.length
              const pct      = (count / cards.length) * 100
              const expanded = expandedTier === label
              return (
                <div key={label} className="flex flex-col">
                  <button
                    onClick={() => setExpandedTier(expanded ? null : label)}
                    disabled={count === 0}
                    className="flex items-center gap-3 w-full disabled:opacity-60"
                    aria-expanded={expanded}
                  >
                    <span className="w-16 text-right text-xs text-muted flex items-center justify-end gap-1">
                      {count > 0 && <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>}
                      {label}
                    </span>
                    <div className="flex-1 h-4 bg-bg rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-xs text-muted text-right">{count}</span>
                  </button>

                  {expanded && (
                    <ul className="mt-2 ml-16 pl-3 border-l border-border flex flex-col gap-1.5">
                      {list.map(c => (
                        <li key={c.id} className="flex items-baseline gap-2 text-xs">
                          <span className="truncate max-w-[50%]">{c.front}</span>
                          <span className="text-muted truncate">{c.back}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
