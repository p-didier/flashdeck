#!/usr/bin/env node
// Check a card file before importing it, using the same rules as the app.
// Usage: npm run validate -- my-cards.json
// Exits 0 when every card is valid, 1 otherwise (printing each failure).

import fs from 'node:fs'
import { validateImportCard } from '../src/cards.js'

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run validate -- <cards.json>')
  process.exit(2)
}

let data
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`✗ Could not parse ${file}. Is it valid JSON?\n  ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(data)) {
  console.error('✗ Expected a JSON list of cards, like [{"front": "...", "back": "..."}].')
  process.exit(1)
}

const errors = data.map(validateImportCard).filter(Boolean)

// Two cards with the same front become one card on import (same id). Always a mistake in a generated file.
const seen = new Map()
data.forEach((c, i) => {
  const key = typeof c?.front === 'string' ? c.front.trim() : null
  if (!key) return
  if (seen.has(key)) errors.push(`Card ${i}: same front as card ${seen.get(key)} ("${key}")`)
  else seen.set(key, i)
})

if (errors.length === 0) {
  console.log(`✓ ${data.length} card(s) valid.`)
  process.exit(0)
}
console.error(`✗ ${file}: ${errors.length} problem(s)`)
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
