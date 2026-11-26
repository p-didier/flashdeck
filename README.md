# flashdeck

A flashcard app with spaced repetition, for any subject (languages, exam facts, formulas). It runs in the browser, works offline once loaded, and installs on a phone as an app. No account, no server: cards stay on the device.

Live app: https://p-didier.github.io/flashdeck/

## Use

Open the link, then either name a first deck or tap "try a sample deck". The in-app "How to use" page covers reviewing, adding cards, importing and backups.

On a phone, open the link in Chrome or Safari and choose "Add to Home Screen". On an iPhone or iPad this matters: Safari deletes a website's stored data after 7 days of browsing without a visit, and apps on the Home Screen are exempt.

Cards live in the browser's storage (IndexedDB) on that one device. Clearing site data erases them, so take a backup now and then (Import screen, "Back up all decks"). Home reminds you after 7 days without one.

## Features

- **Decks.** One per subject. Each deck has its own schedule, filters and stats.
- **Scheduling.** Anki's variant of SM-2, with Again, Hard, Good and Easy ratings and Anki's default limits (20 new and 200 review cards per deck and day).
- **Recall check.** "I Know" or "I Don't Know" before the card flips. A slow "Easy" counts as "Good".
- **Importance.** Cards are crucial, important or normal. Crucial cards come first, and a session can be limited to them.
- **Adding cards.** One at a time, as a batch (`front = back`, one per line or per `;`, split on the first `=`), or from a JSON file. A new card whose front is already in the deck is refused.
- **Stats.** Streak, daily activity, 7-day retention and New, Learning and Mature counts.

## Card format

An import file is a JSON list. Only `front` and `back` are required.

```json
[
  { "front": "Australia", "back": "Canberra" },
  {
    "front": "Brazil",
    "back": "Brasília",
    "extra": "Capital since 1960",
    "notes": "My own reminder",
    "importance": "crucial",
    "tags": ["south-america"]
  }
]
```

| Field | Required | Content |
| --- | --- | --- |
| `front` | yes | The prompt. |
| `back` | yes | The answer. |
| `extra` | no | Shown under the answer (an example, a formula, a pronunciation). |
| `notes` | no | A memory aid, shown in a box on the back. |
| `importance` | no | `crucial`, `important` or `normal` (default). |
| `tags` | no | List of text. Defaults to the import date. |

Cards are imported into the deck that is open. Importing a file again updates the cards with the same `front` and keeps their review progress. Fields left out of the file are left as they are in the app, and tags are added to the existing ones.

Check a file before importing it:

```bash
npm run validate -- my-cards.json
```

[docs/make-cards-with-ai.md](docs/make-cards-with-ai.md) has a prompt that turns notes into such a file with any AI chatbot. `decks/sample.json` is a full example.

## Run locally

Needs Node 20 or newer.

```bash
npm install
npm run dev     # http://localhost:5173/flashdeck/
npm test        # scheduler, import and batch rules
npm run build   # production build in dist/
```

## Your own copy

1. Fork this repo (any name works).
2. In the fork, go to Settings, Pages, and set Source to "GitHub Actions".
3. Push to `main`. `.github/workflows/deploy.yml` runs the tests, builds and publishes to `https://<user>.github.io/<repo>/`.

## Contents

| Path | Content |
| --- | --- |
| `src/srs.js` | Scheduler, daily limits, session filters. |
| `src/cards.js` | Card shape, import validation and merge rules. |
| `src/db.js` | IndexedDB tables (Dexie) and all writes. |
| `src/backup.js` | Backup and restore. |
| `src/screens/` | Home, Review, Browse, Import, Stats, How to use. |
| `decks/sample.json` | The sample deck. |
| `scripts/validate-deck.js` | Command-line check for an import file. |
| `test/` | `node --test` checks. |

Built with React, Vite, Tailwind CSS, Dexie and vite-plugin-pwa.

## License

MIT, cf. `LICENSE`.
