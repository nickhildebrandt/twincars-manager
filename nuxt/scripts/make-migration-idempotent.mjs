/**
 * Rewrites a generated migration so it can be applied twice without failing.
 *
 * `drizzle-kit generate` emits plain DDL. An idempotent migration costs
 * nothing on the happy path and survives every drift scenario without someone
 * having to intervene (../docs/rewrite/03-architektur.md §7.2).
 *
 *   node scripts/make-migration-idempotent.mjs server/database/migrations/0000_baseline.sql
 *
 * Run it right after `pnpm db:generate`, before committing.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Aufruf: node scripts/make-migration-idempotent.mjs <datei.sql>')
  process.exit(1)
}

const original = readFileSync(file, 'utf8')
let changed = 0

let out = original
  // CREATE TABLE "x" (…)
  .replace(/^CREATE TABLE (?!IF NOT EXISTS)/gm, () => {
    changed++
    return 'CREATE TABLE IF NOT EXISTS '
  })
  // CREATE [UNIQUE] INDEX "x" ON …
  .replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/gm, (_, unique) => {
    changed++
    return `CREATE ${unique ?? ''}INDEX IF NOT EXISTS `
  })

// ALTER TABLE … ADD CONSTRAINT … — PostgreSQL has no IF NOT EXISTS for this,
// so the statement goes into a block that swallows a duplicate.
out = out.replace(
  /^ALTER TABLE (.+?) ADD CONSTRAINT (.+?);/gms,
  (match, table, rest) => {
    if (match.includes('EXCEPTION')) return match
    changed++
    return `DO $$ BEGIN\n  ALTER TABLE ${table} ADD CONSTRAINT ${rest};\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`
  },
)

if (out !== original) writeFileSync(file, out)
console.log(`${file}: ${changed} Anweisung(en) wiederholbar gemacht.`)
