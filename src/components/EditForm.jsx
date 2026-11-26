import { useState } from 'react'
import { IMPORTANCES, cardId } from '../cards.js'
import { parseBatch } from '../batch.js'
import { getToday } from '../srs.js'

const IMP_ACTIVE = {
  crucial:   'bg-crucial border-crucial text-white',
  important: 'bg-important border-important text-white',
  normal:    'bg-accent border-accent text-white',
}

const INPUT = 'bg-bg border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted'
const LABEL = 'text-xs text-muted uppercase tracking-wide'

function Optional() {
  return <span className="ml-1.5 normal-case tracking-normal text-[10px]">optional</span>
}

/**
 * New Card / Edit Card sheet.
 *
 * Parameters
 * ----------
 * card : object | null
 *     null opens the New Card form (with a Batch tab), a stored card opens it for editing.
 * onSave : (fields: object) => void
 *     New card: an import-shaped card. Edit: the changed content fields.
 * onSaveMany : (cards: object[]) => void
 *     Batch tab, import-shaped cards.
 * onDelete, onCancel : () => void
 * cards : object[]
 *     Stored cards of the deck, used to refuse a front that already exists.
 * deckId : string
 *     The deck, to compute the id a new card would get.
 */
export default function EditForm({ card, onSave, onSaveMany, onDelete, onCancel, cards = [], deckId }) {
  const isNew = card === null

  const [front,      setFront]      = useState(card?.front ?? '')
  const [back,       setBack]       = useState(card?.back ?? '')
  const [extra,      setExtra]      = useState(card?.extra ?? '')
  const [notes,      setNotes]      = useState(card?.notes ?? '')
  const [importance, setImportance] = useState(card?.importance ?? 'normal')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [mode, setMode]           = useState('single')
  const [batchText, setBatchText] = useState('')
  // Saving a new card whose id or front already exists would merge into that card
  // (upsertCards) and overwrite its back, extra, notes and importance.
  const taken = f => {
    const t = f.trim()
    if (!isNew) return cards.some(c => c.id !== card.id && c.front === t)
    const id = deckId && cardId(t, deckId)
    return cards.some(c => c.id === id || c.front === t)
  }
  const batch = isNew && mode === 'batch' ? withoutTaken(parseBatch(batchText, getToday()), taken) : null
  const frontTaken = !batch && front.trim() !== '' && taken(front)

  function handleSave() {
    if (batch) { onSaveMany(batch.cards); return }
    // Editing the front keeps the card's id, so review progress stays attached.
    onSave({ front: front.trim(), back: back.trim(), extra: extra.trim() || null, notes: notes.trim() || null, importance })
  }

  const canSave = batch ? batch.cards.length > 0 : front.trim() && back.trim() && !frontTaken

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <div className="bg-surface rounded-t-2xl border-t border-border flex flex-col max-h-[92dvh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-lg">{isNew ? 'New Card' : 'Edit Card'}</h2>
          <button onClick={onCancel} className="text-muted text-2xl leading-none w-8 h-8">×</button>
        </div>

        {isNew && (
          <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
            {[['single', 'Single'], ['batch', 'Batch']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border ${
                  mode === key ? 'bg-accent border-accent text-white' : 'bg-bg border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {batch ? (
            <BatchPane text={batchText} setText={setBatchText} result={batch} />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Front</label>
                <textarea value={front} onChange={e => setFront(e.target.value)} rows={2}
                  placeholder="The prompt, e.g. capital of Australia" className={`${INPUT} text-lg resize-y`} />
                {frontTaken && (
                  <p className="text-xs text-crucial">A card with this front is already in this deck. Edit that one in Browse instead.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Back</label>
                <textarea value={back} onChange={e => setBack(e.target.value)} rows={2}
                  placeholder="The answer, e.g. Canberra" className={`${INPUT} resize-y`} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Extra<Optional /></label>
                <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={2}
                  placeholder="Shown under the answer: an example, a formula, a pronunciation…" className={`${INPUT} resize-y`} />
              </div>

              <div className="flex flex-col gap-2">
                <label className={LABEL}>Importance</label>
                <div className="flex gap-2 flex-wrap">
                  {IMPORTANCES.map(imp => (
                    <button
                      key={imp}
                      onClick={() => setImportance(imp)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${
                        importance === imp ? IMP_ACTIVE[imp] : 'bg-bg border-border text-muted'
                      }`}
                    >
                      {imp}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Notes<Optional /></label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Your own memory aid or reminder…" className={`${INPUT} resize-y`} />
              </div>

              {!isNew && (
                <div className="mt-2 pt-4 border-t border-border">
                  {confirmDelete ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-muted">Delete this card? This cannot be undone.</p>
                      <div className="flex gap-3">
                        <button onClick={onDelete} className="flex-1 py-2.5 bg-crucial rounded-xl text-white text-sm font-semibold">Delete</button>
                        <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="text-sm text-crucial underline underline-offset-2">Delete card</button>
                  )}
                </div>
              )}
            </>
          )}
          <div className="h-2" />
        </div>

        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-4 bg-accent rounded-xl font-semibold text-white text-lg disabled:opacity-40"
          >
            {batch ? `Add ${batch.cards.length} card${batch.cards.length === 1 ? '' : 's'}` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Move batch cards whose front is already in the deck from `cards` to `errors`. */
function withoutTaken({ cards, errors }, taken) {
  const dup = cards.filter(c => taken(c.front))
  return {
    cards: cards.filter(c => !taken(c.front)),
    errors: [...errors, ...dup.map(c => `"${c.front}" is already in this deck`)],
  }
}

/** The Batch tab: a textarea plus a live preview, where a stray ";" inside an answer shows up before anything is saved. */
function BatchPane({ text, setText, result }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>Entries</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'!! Australia = Canberra; Canada = Ottawa\nJapan = Tokyo'}
          rows={6}
          className={`${INPUT} resize-y font-mono leading-relaxed`}
        />
        <p className="text-[11px] text-muted leading-relaxed">
          One card per line or per <code>;</code>, written <code>front = back</code>. Start a line with <code>!</code> for
          important or <code>!!</code> for crucial. Every card is tagged with today's date. A <code>;</code> inside an
          answer splits the entry, so use a comma there. The first <code>=</code> splits front from back, so add a
          front that contains <code>=</code> in the Single tab.
        </p>
      </div>

      {result.errors.length > 0 && (
        <div className="p-3 bg-bg border border-crucial/50 rounded-xl flex flex-col gap-1">
          <p className="text-xs font-semibold text-crucial">
            {result.errors.length} entr{result.errors.length === 1 ? 'y' : 'ies'} could not be read
          </p>
          {result.errors.map((e, i) => <p key={i} className="text-[11px] text-muted leading-snug">{e}</p>)}
        </div>
      )}

      {result.cards.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Preview, {result.cards.length} card{result.cards.length === 1 ? '' : 's'}</label>
          <ul className="flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden">
            {result.cards.map(c => (
              <li key={c.front} className="flex items-baseline gap-2 px-3 py-2 text-sm bg-bg">
                {c.importance !== 'normal' && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 self-center ${c.importance === 'crucial' ? 'bg-crucial' : 'bg-important'}`} />
                )}
                <span className="truncate max-w-[50%]">{c.front}</span>
                <span className="text-muted text-xs truncate">{c.back}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
