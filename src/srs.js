/**
 * Anki-style modified SM-2 spaced repetition.
 * Rating q values: 0=Again, 2=Hard, 3=Good, 5=Easy.
 *
 * Differs from textbook SM-2 (and from this app's original implementation):
 * - Hard keeps a review card IN review (interval ×1.2) instead of resetting it.
 * - Good is ease-neutral (Anki) instead of eroding ease by 0.14.
 * - Ease deltas are Anki's: Again −0.20, Hard −0.15, Good 0, Easy +0.15.
 * - New cards graduate over days (Good → 1d, Easy → 4d); no sub-day learning steps.
 * - Review intervals are fuzzed and grow by at least 1 day (Anki invariants).
 * - Again on a review card is a lapse: interval reset + lapses++ (drives leech).
 * - A lapsed card rated again in the same session is relearning: no second lapse,
 *   no ease change, due after the 1-day lapse interval (Anki relearning steps).
 */

// ── Anki scheduler constants (hardcoded defaults) ──────────────────────────────
const GRADUATING_INTERVAL = 1       // [days] interval after Good on a new card
const EASY_INTERVAL       = 4       // [days] interval after Easy on a new card
const HARD_FACTOR         = 1.2     // review Hard interval multiplier
const EASY_BONUS          = 1.3     // review Easy extra multiplier
const MIN_EASE            = 1.3
const EASE_DELTA          = { 0: -0.20, 2: -0.15, 3: 0.0, 5: 0.15 } // by q
const LAPSE_NEW_INTERVAL  = 0       // fraction of old interval kept on lapse
const MIN_LAPSE_INTERVAL  = 1       // days
const MAX_INTERVAL        = 36500   // days (~100y)

export const LEECH_THRESHOLD = 8    // lapses before a card is flagged a leech
export const NEW_PER_DAY     = 20
export const REVIEW_PER_DAY  = 200

// ── Core update ────────────────────────────────────────────────────────────────

/**
 * Apply a rating to a card's SRS state and return the next state. Spreads the
 * prior srs so per-card Response Time calibration (avgResponseMs/responseCount)
 * and the lapse counter survive ratings that don't touch them.
 *
 * Parameters
 * ----------
 * srs : object
 *     Current scheduler state, see newSRS in cards.js.
 * q : number
 *     Rating, 0 | 2 | 3 | 5.
 * today : string
 *     YYYY-MM-DD.
 * options.fuzz : (ivl: number) => number
 *     Interval fuzz, injectable so the tests can disable randomisation.
 * options.relearning : boolean
 *     The card was already rated in this session. Only a lapsed review card can
 *     come back, so for review cards this is the relearning step.
 *
 * Returns
 * -------
 * object
 *     Next scheduler state.
 */
export function updateSRS(srs, q, today, { fuzz = fuzzInterval, relearning = false } = {}) {
  let { interval, easeFactor, repetitions } = srs
  let lapses = srs.lapses ?? 0

  // Relearning a lapsed review card: the lapse already cost ease and a lapse
  // count, so a repeat Again must not charge again (one bad session would floor
  // ease and make a leech). A new card in learning (repetitions 0) is unaffected.
  if (relearning && repetitions > 0) return { ...srs, due: addDays(today, interval) }

  if (repetitions === 0) {
    // Learning: ease is not adjusted until the card reaches review.
    if (q >= 3) {
      repetitions = 1
      interval = q === 5 ? EASY_INTERVAL : GRADUATING_INTERVAL
    } else {
      interval = 1 // Again / Hard: stay in learning
    }
  } else {
    // Review: adjust ease, then schedule.
    easeFactor = Math.max(MIN_EASE, easeFactor + EASE_DELTA[q])
    if (q === 0) {
      // Lapse: reset interval, bump the counter, but stay out of the "New" tier.
      lapses += 1
      repetitions = 1
      interval = Math.max(MIN_LAPSE_INTERVAL, Math.round(interval * LAPSE_NEW_INTERVAL))
    } else {
      const factor = q === 2 ? HARD_FACTOR
        : q === 5 ? easeFactor * EASY_BONUS
        : easeFactor
      repetitions += 1
      interval = constrain(fuzz(interval * factor), interval)
    }
  }

  const due = addDays(today, interval)
  return { ...srs, interval, easeFactor, repetitions, lapses, due }
}

// Keep a review interval within [prev+1, MAX_INTERVAL], Anki's "always grow" rule.
function constrain(ivl, prevInterval) {
  return Math.min(MAX_INTERVAL, Math.max(prevInterval + 1, Math.round(ivl)))
}

/**
 * Anki-style interval fuzz: spread a review interval by a size-dependent range so
 * cards don't clump on the same day. Intervals under ~3 days are left untouched.
 */
export function fuzzInterval(ivl, rand = Math.random) {
  const base = Math.round(ivl)
  if (base < 3) return base
  let f
  if (ivl < 7) f = ivl * 0.25
  else if (ivl < 30) f = Math.max(2, ivl * 0.15)
  else f = Math.max(4, ivl * 0.05)
  f = Math.max(1, Math.round(f))
  return base - f + Math.floor(rand() * (2 * f + 1))
}

export function getToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Response time ─────────────────────────────────────────────────────────────

const RESPONSE_CAP_MS   = 10_000
const FIXED_THRESHOLD_MS = 4_000
const BASELINE_MIN_COUNT = 5
const BASELINE_MULTIPLIER = 1.5

/**
 * Returns the effective q value to pass to updateSRS.
 * Only Easy (q=5) can be demoted: a slow "I Know" response downgrades it to Good (q=3).
 * responseTimeMs=null means the "I Don't Know" path, where no demotion applies.
 */
export function effectiveQ(srs, q, responseTimeMs) {
  if (q !== 5 || responseTimeMs === null) return q
  if (responseTimeMs > RESPONSE_CAP_MS) return q

  const threshold = (srs.responseCount ?? 0) >= BASELINE_MIN_COUNT
    ? (srs.avgResponseMs ?? FIXED_THRESHOLD_MS) * BASELINE_MULTIPLIER
    : FIXED_THRESHOLD_MS

  return responseTimeMs > threshold ? 3 : 5
}

/**
 * Returns a new srs object with the response time recorded into the running average.
 * Only called on the "I Know" path. Respects the 10 s cap (discards above it).
 */
export function recordResponseTime(srs, responseTimeMs) {
  if (responseTimeMs === null || responseTimeMs > RESPONSE_CAP_MS) return srs

  const prevCount = srs.responseCount ?? 0
  const newCount  = prevCount + 1
  const prevAvg   = srs.avgResponseMs ?? responseTimeMs
  const avgResponseMs = prevAvg + (responseTimeMs - prevAvg) / newCount

  return { ...srs, avgResponseMs, responseCount: newCount }
}

// ── Daily limits ──────────────────────────────────────────────────────────────

/**
 * Cap a due-card list at the day's remaining new/review allowance (Anki defaults
 * 20 new / 200 review). Order is preserved, so the importance-first sort that
 * seeded `cards` still decides which cards make the cut.
 */
export function applyDailyLimits(cards, { newDone = 0, reviewDone = 0 } = {}) {
  const newAllow    = Math.max(0, NEW_PER_DAY - newDone)
  const reviewAllow = Math.max(0, REVIEW_PER_DAY - reviewDone)
  let nUsed = 0
  let rUsed = 0
  return cards.filter(c => {
    if ((c.srs.repetitions ?? 0) === 0) return nUsed++ < newAllow
    return rUsed++ < reviewAllow
  })
}

// ── Session config ────────────────────────────────────────────────────────────

export const DEFAULT_SESSION_CONFIG = { importance: 'all', tags: [], shuffle: false }

/**
 * Filter and optionally shuffle a due-card list according to session config.
 * Shuffle randomises within each importance tier so crucial cards still lead.
 */
export function applySessionConfig(cards, { importance, tags, shuffle }) {
  let result = cards

  if (importance === 'crucial') {
    result = result.filter(c => c.importance === 'crucial')
  } else if (importance === 'important+') {
    result = result.filter(c => c.importance !== 'normal')
  }

  if (tags.length > 0) {
    result = result.filter(c => c.tags?.some(t => tags.includes(t)))
  }

  if (shuffle) {
    result = ['crucial', 'important', 'normal'].flatMap(tier => {
      const group = result.filter(c => c.importance === tier).slice()
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[group[i], group[j]] = [group[j], group[i]]
      }
      return group
    })
  }

  return result
}
