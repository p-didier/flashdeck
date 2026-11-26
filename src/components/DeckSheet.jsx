import { useState } from 'react'
import { useDeck } from '../DeckContext.jsx'
import { createDeck, deleteDeck, renameDeck } from '../db.js'

/** Bottom sheet to switch, create, rename and delete decks. Opened from Home only. */
export default function DeckSheet({ onClose }) {
  const { decks, deck, cards, selectDeck, reload } = useDeck()
  const [newName, setNewName]       = useState('')
  const [renaming, setRenaming]     = useState(false)
  const [rename, setRename]         = useState(deck?.name ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    await selectDeck(await createDeck(newName))
    onClose()
  }

  async function handleRename() {
    if (!rename.trim()) return
    await renameDeck(deck.id, rename)
    await reload()
    setRenaming(false)
  }

  async function handleDelete() {
    await deleteDeck(deck.id)
    await reload()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-surface rounded-t-2xl border-t border-border flex flex-col max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <h2 className="font-semibold text-base">Decks</h2>
          <button onClick={onClose} className="text-muted text-2xl leading-none w-8 h-8">×</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {decks.map(d => (
            <button
              key={d.id}
              onClick={async () => { await selectDeck(d.id); onClose() }}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm ${
                d.id === deck?.id ? 'border-accent text-accent font-medium' : 'border-border'
              }`}
            >
              {d.name}
            </button>
          ))}

          {deck && (
            <div className="pt-3 mt-1 border-t border-border flex flex-col gap-2">
              {renaming ? (
                <div className="flex gap-2">
                  <input
                    value={rename}
                    onChange={e => setRename(e.target.value)}
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm"
                    autoFocus
                  />
                  <button onClick={handleRename} className="px-4 bg-accent rounded-lg text-sm text-white">Save</button>
                </div>
              ) : confirmDel ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">
                    Delete "{deck.name}" and its {cards.length} cards? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleDelete} className="flex-1 py-2.5 bg-crucial rounded-xl text-white text-sm font-semibold">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDel(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 text-xs">
                  <button onClick={() => setRenaming(true)} className="text-accent underline underline-offset-2">
                    Rename "{deck.name}"
                  </button>
                  <button onClick={() => setConfirmDel(true)} className="text-crucial underline underline-offset-2">
                    Delete it
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="New deck name"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 bg-accent rounded-lg text-sm font-semibold text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
