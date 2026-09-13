/**
 * Regression-test coverage for the findings list.
 *
 * Every finding in ../docs/rewrite/02-befunde.md classified "im Rewrite
 * beheben" must have exactly one test whose name starts with its ID, so that
 * a fix cannot be silently lost later (05-teststrategie.md §6).
 *
 * A finding only becomes due once its work package is done, so the check
 * compares against the packages listed in ../docs/rewrite/fortschritt.md.
 *
 *   node scripts/check-befunde.mjs          only finished packages (CI)
 *   node scripts/check-befunde.mjs --all    every finding (progress overview)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const planDir = join(root, '..', 'docs', 'rewrite')
const all = process.argv.includes('--all')

const read = (p) => {
  try {
    return readFileSync(p, 'utf8')
  }
  catch {
    return ''
  }
}

// ── findings that need a regression test ────────────────────────────────────
const befunde = new Map() // id -> short description
for (const line of read(join(planDir, '02-befunde.md')).split('\n')) {
  const m = line.match(/^\| \*\*(B-\d{3})\*\* \|(.*)\|\s*$/)
  if (!m) continue
  const cells = m[2].split(/(?<!\\)\|/).map(c => c.trim())
  if (!/rewrite/i.test(cells[4] ?? '')) continue
  befunde.set(m[1], (cells[0] ?? '').replace(/\*\*/g, '').slice(0, 80))
}

// ── which packages are finished ─────────────────────────────────────────────
const done = new Set(
  [...read(join(planDir, 'fortschritt.md')).matchAll(/^## (T-\d{3}) .*fertig/gm)]
    .map(m => m[1]),
)

// ── findings per package ────────────────────────────────────────────────────
// A finding can affect features in several packages, so it can have several
// owners. It becomes due as soon as ONE of them is finished.
const owner = new Map() // finding id -> Set<package id>
for (const line of read(join(planDir, '06-abdeckung.md')).split('\n')) {
  const head = line.match(/^\| \*\*(T-\d{3})\*\* \| (\d+) \| (.*) \|$/)
  if (!head) continue
  const pkg = head[1]
  for (const part of head[3].split(',')) {
    const range = part.trim().match(/^B-(\d{3})(?:–B-(\d{3}))?$/)
    if (!range) continue
    const from = Number(range[1])
    const to = Number(range[2] ?? range[1])
    for (let n = from; n <= to; n++) {
      const id = `B-${String(n).padStart(3, '0')}`
      if (!owner.has(id)) owner.set(id, new Set())
      owner.get(id).add(pkg)
    }
  }
}

// ── collect every test name in the repository ───────────────────────────────
const covered = new Set()
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(test|spec)\.ts$/.test(entry)) continue
    for (const m of read(full).matchAll(/\b(?:it|test)(?:\.\w+)*\(\s*[`'"](B-\d{3})/g)) {
      covered.add(m[1])
    }
  }
}
for (const dir of ['test', 'app', 'server', 'shared']) {
  try {
    walk(join(root, dir))
  }
  catch {
    // directory does not exist yet
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const ownersOf = id => [...(owner.get(id) ?? [])]
const due = [...befunde.keys()].filter(
  id => all || ownersOf(id).some(pkg => done.has(pkg)),
)
const missing = due.filter(id => !covered.has(id))

console.log(
  `Befunde „im Rewrite beheben": ${befunde.size} · fällig: ${due.length} · `
  + `abgedeckt: ${due.length - missing.length} · offen: ${missing.length}`,
)

if (missing.length > 0) {
  console.error('\nOhne Regressionstest:')
  for (const id of missing) {
    console.error(`  ${id}  (${ownersOf(id).join(', ') || 'ohne Paket'})  ${befunde.get(id)}`)
  }
  console.error(
    '\nJeder behobene Befund braucht einen Test, dessen Name mit der Befund-ID '
    + 'beginnt, z. B. it(\'B-183: geleertes Feld wird gespeichert\', …).',
  )
  process.exit(1)
}

const stray = [...covered].filter(id => !befunde.has(id))
if (stray.length > 0) {
  console.warn(`Hinweis: Tests nennen unbekannte Befund-IDs: ${stray.join(', ')}`)
}
