import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { db } from './db.js'

const ACTIVE_KEY = 'active-deck'

function readActive() {
  try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}

function writeActive(id) {
  try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* private mode: falls back to the first deck */ }
}

const DeckContext = createContext(null)

/**
 * Holds every deck, the Active Deck and its cards. The one place deck scoping
 * happens: screens read `cards` and never filter on deckId themselves.
 * Call `reload()` after any write so every screen stays in sync.
 */
export function DeckProvider({ children }) {
  const [state, setState] = useState({ decks: [], deck: null, cards: [], loading: true })

  const reload = useCallback(async () => {
    const decks = await db.decks.orderBy('createdAt').toArray()
    const saved = readActive()
    const deck = decks.find(d => d.id === saved) ?? decks[0] ?? null
    const cards = deck ? await db.cards.where('deckId').equals(deck.id).toArray() : []
    setState({ decks, deck, cards, loading: false })
  }, [])

  useEffect(() => { reload() }, [reload])

  const selectDeck = useCallback(async id => {
    writeActive(id)
    await reload()
  }, [reload])

  return (
    <DeckContext.Provider value={{ ...state, reload, selectDeck }}>
      {children}
    </DeckContext.Provider>
  )
}

export function useDeck() {
  const ctx = useContext(DeckContext)
  if (!ctx) throw new Error('useDeck must be used inside DeckProvider')
  return ctx
}
