# Make cards with AI

Any AI chatbot (Claude, ChatGPT, Gemini, a local model) can turn notes, a vocabulary list or a course page into a file flashdeck imports.

## Steps

1. Copy the prompt below into the chatbot.
2. Replace the two lines in brackets, then paste your material under it.
3. Save the answer as a `.json` file (e.g. `lesson-3.json`).
4. In flashdeck, open the deck, go to Import and pick the file.

If the import fails, the app lists the cards at fault. Paste that message back to the chatbot and ask it to fix the file. With the repo cloned, `npm run validate -- lesson-3.json` runs the same check.

## Prompt

```text
Turn the material below into flashcards for a spaced-repetition app.

Subject: [e.g. Spanish for beginners, my answer side is English]
Wishes: [e.g. one card per verb, put a short example sentence in "extra"]

Output only a JSON list, with no text before or after it. Each card is an object:
- "front" (required): the prompt, short. Each front must be unique.
- "back" (required): the answer, short.
- "extra" (optional): one line shown under the answer, e.g. an example, a formula or a pronunciation.
- "importance" (optional): "crucial", "important" or "normal". Use "crucial" only for what the material stresses most.
- "tags" (optional): a list of short lowercase topic words.

Rules:
- One fact per card.
- Keep my wording where the material gives it.
- Do not invent facts that are not in the material.

Material:
```

## Example

From the notes "hablar = to speak (hablo, hablas, habla). comer = to eat, very common!", a chatbot should return something like:

```json
[
  { "front": "hablar", "back": "to speak", "extra": "hablo, hablas, habla", "tags": ["verbs"] },
  { "front": "comer", "back": "to eat", "importance": "important", "tags": ["verbs"] }
]
```

Re-importing an edited file into the same deck updates the cards and keeps their progress, so it is safe to fix a file and import it again.
