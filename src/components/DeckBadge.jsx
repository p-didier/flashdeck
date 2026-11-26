import { useDeck } from '../DeckContext.jsx'

/**
 * Static marker of the Active Deck on screens that show one deck's data.
 * Not interactive: switching only exists on Home, where no review session can be live.
 */
export default function DeckBadge() {
  const { deck } = useDeck()
  if (!deck) return null
  return <span className="flex-shrink-0 max-w-[40%] truncate text-xs text-muted select-none">{deck.name}</span>
}
