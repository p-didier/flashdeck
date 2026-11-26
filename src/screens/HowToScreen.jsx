import { Link } from 'react-router-dom'

const EXAMPLE = `[
  { "front": "Australia", "back": "Canberra" },
  { "front": "Brazil", "back": "Brasília",
    "extra": "Capital since 1960",
    "importance": "crucial",
    "tags": ["south-america"] }
]`

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted leading-relaxed flex flex-col gap-2">{children}</div>
    </section>
  )
}

/** Plain-language guide for people who did not build the app. */
export default function HowToScreen() {
  return (
    <div className="px-6 py-8 max-w-md mx-auto flex flex-col gap-7">
      <h1 className="text-2xl font-semibold">How to use</h1>

      <Section title="Decks">
        <p>
          A deck is one subject, like a language, a course or a set of facts. Tap the deck name on Home to switch
          decks, create a new one, rename it or delete it. Every screen shows one deck at a time.
        </p>
      </Section>

      <Section title="Reviewing">
        <p>
          Home shows how many cards are due today. Tap <strong>Review</strong> and look at the front of each card.
        </p>
        <p>
          Tap <strong>I Know</strong> if you can recall the answer, then rate how hard it was. Tap{' '}
          <strong>I Don't Know</strong> to see the answer, and the card comes back later in the same session.
        </p>
        <p>
          The app then schedules each card. Easy cards come back after longer and longer gaps, hard ones come back
          soon. A few minutes a day is enough. At most 20 new cards per deck are introduced each day.
        </p>
        <p>
          The filters on Home limit a session to crucial or important cards, or to some tags. Crucial cards always come
          first.
        </p>
      </Section>

      <Section title="Adding cards">
        <p>
          In <strong>Browse</strong>, tap <strong>+</strong>. The Single tab adds one card with a front, a back, an
          optional extra line shown under the answer, and your own notes.
        </p>
        <p>
          The Batch tab adds many at once. Write one card per line, or per <code>;</code>, as{' '}
          <code>front = back</code>. Put <code>!</code> or <code>!!</code> at the start of a line to mark it important
          or crucial. The first <code>=</code> splits front from back, so add a front that contains <code>=</code> in
          the Single tab.
        </p>
        <p>Tap any card in Browse to see it, edit it or delete it.</p>
      </Section>

      <Section title="Importing a file">
        <p>
          On the <Link to="/import" className="underline">Import</Link> screen, pick a JSON file with a list of cards.
          Only front and back are required.
        </p>
        <pre className="text-[11px] bg-surface border border-border rounded-xl p-3 overflow-x-auto text-white">{EXAMPLE}</pre>
        <p>
          Importing the same file again updates the cards and keeps your progress. An AI chatbot can write these files
          from your notes. The project page on GitHub has a ready-made prompt.
        </p>
      </Section>

      <Section title="Keeping your cards safe">
        <p>
          Everything is stored in this browser only. Clearing browser data or changing phones erases it. Use{' '}
          <strong>Back up all decks</strong> on the Import screen now and then, and keep the file somewhere else. Home
          reminds you after a week without a backup.
        </p>
        <p>
          On an iPhone or iPad, Safari deletes the cards of a website you have not opened for 7 days of browsing. Add
          flashdeck to the Home Screen (below) and always open it from there, which keeps the cards.
        </p>
      </Section>

      <Section title="Installing on a phone">
        <p>
          Open the app in Chrome or Safari and choose <strong>Add to Home Screen</strong> from the browser menu (the
          Share button in Safari). It then opens like an app and works offline.
        </p>
      </Section>
    </div>
  )
}
