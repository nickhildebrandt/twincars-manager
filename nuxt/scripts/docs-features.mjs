/**
 * Generates one page per feature ID under `docs/features/`.
 *
 * Source of truth is the inventory in `docs/rewrite/01-inventar.md`; the
 * owning work package comes from `docs/rewrite/06-abdeckung.md`. Pages that
 * already carry `status: umgesetzt` are left untouched — the generator only
 * creates and refreshes stubs, it never overwrites written documentation.
 *
 *   node scripts/docs-features.mjs          create missing pages, refresh stubs
 *   node scripts/docs-features.mjs --check   report differences, change nothing
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const planDir = join(root, '..', 'docs', 'rewrite')
const featuresDir = join(root, '..', 'docs', 'features')
const check = process.argv.includes('--check')

const read = path => readFileSync(path, 'utf8')
const unescapePipes = s => s.replace(/\\\|/g, '|')

/** `Kundenliste (Tabelle, Zeilenklick)` → `kundenliste-tabelle-zeilenklick` */
function slug(title) {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').slice(0, 6).join('-')
    || 'feature'
}

/** Splits a cell list like "`/customers`, `/customers/new`" into entries. */
function list(cell) {
  const text = unescapePipes(cell).trim()
  if (text === '' || text === '–' || text === '-') return []
  return [...text.matchAll(/`([^`]+)`/g)].map(m => m[1])
}

// ── read the inventory ──────────────────────────────────────────────────────
const features = []
let modul = 'unbekannt'
for (const line of read(join(planDir, '01-inventar.md')).split('\n')) {
  const heading = line.match(/^### (.+)$/)
  if (heading) {
    modul = heading[1].trim()
    continue
  }
  const row = line.match(/^\| \*\*(F-\d{3})\*\* \|(.*)\|\s*$/)
  if (!row) continue
  const cells = row[2].split(/(?<!\\)\|/).map(c => c.trim())
  features.push({
    id: row[1],
    modul,
    title: unescapePipes(cells[0] ?? '').replace(/\*\*/g, ''),
    routes: list(cells[1] ?? ''),
    endpoints: list(cells[2] ?? ''),
    tables: list(cells[3] ?? ''),
    behaviour: unescapePipes(cells[4] ?? ''),
  })
}

// ── owning work package per feature ─────────────────────────────────────────
const paket = new Map()
for (const line of read(join(planDir, '06-abdeckung.md')).split('\n')) {
  const row = line.match(/^\| (F-\d{3}) \| .* \| (.+) \|$/)
  if (!row) continue
  paket.set(row[1], [...row[2].matchAll(/T-\d{3}/g)].map(m => m[0]).join(', '))
}

const yaml = value => (value.length === 0 ? '[]' : `[${value.map(v => `'${v}'`).join(', ')}]`)

function page(f) {
  const owner = paket.get(f.id) ?? '—'
  return `---
id: ${f.id}
title: ${f.title.replaceAll('"', '\'')}
status: geplant
modul: ${f.modul}
paket: ${owner}
permission: offen
routes: ${yaml(f.routes)}
endpoints: ${yaml(f.endpoints)}
tables: ${yaml(f.tables)}
schemas: []
components: []
tests: []
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${f.id} — ${f.title}

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **${owner}** ausgefüllt und auf \`status: umgesetzt\` gesetzt.

## Zweck

${f.title}

## Erwartetes Verhalten

${f.behaviour || '_Im Inventar nicht weiter ausgeführt._'}

## Nutzersicht

_Wird mit ${owner} ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit ${owner} ergänzt._

## Zustände

| Zustand | Verhalten |
| --- | --- |
| Leer | _offen_ |
| Laden | _offen_ |
| Fehler | _offen_ |
| Keine Berechtigung | _offen_ |

## Technischer Bezug

| | |
| --- | --- |
| Routen | ${f.routes.length ? f.routes.map(r => `\`${r}\``).join(', ') : '—'} |
| Endpoints | ${f.endpoints.length ? f.endpoints.map(r => `\`${r}\``).join(', ') : '—'} |
| Tabellen | ${f.tables.length ? f.tables.map(r => `\`${r}\``).join(', ') : '—'} |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit ${owner} ergänzt._

## Quellen

- Inventar: [${f.id} in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [${owner} in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
`
}

// ── write ───────────────────────────────────────────────────────────────────
mkdirSync(featuresDir, { recursive: true })
const existing = new Map()
for (const name of readdirSync(featuresDir).filter(n => /^F-\d{3}-.*\.md$/.test(n))) {
  existing.set(name.slice(0, 5), name)
}

let created = 0
let refreshed = 0
let kept = 0
const wanted = new Set()

for (const f of features) {
  const name = `${f.id}-${slug(f.title)}.md`
  wanted.add(name)
  const target = join(featuresDir, name)
  const old = existing.get(f.id)

  if (old && old !== name && existsSync(join(featuresDir, old))) {
    // Title changed: the old file is stale.
    if (!check) writeFileSync(join(featuresDir, old), '')
  }

  if (existsSync(target)) {
    const current = read(target)
    if (/^status:\s*(umgesetzt|blockiert)/m.test(current)) {
      kept++
      continue
    }
    const next = page(f)
    // `updated` changes on every run; ignore it when comparing.
    const strip = s => s.replace(/^updated:.*$/m, '')
    if (strip(current) === strip(next)) {
      kept++
      continue
    }
    if (!check) writeFileSync(target, next)
    refreshed++
    continue
  }

  if (!check) writeFileSync(target, page(f))
  created++
}

const stale = [...existing.values()].filter(n => !wanted.has(n))

console.log(
  `Feature-Seiten: ${features.length} · neu ${created} · aktualisiert ${refreshed} · `
  + `unverändert ${kept}${stale.length ? ` · verwaist ${stale.length}` : ''}`,
)

if (check && (created > 0 || refreshed > 0 || stale.length > 0)) {
  console.error('Die Feature-Seiten sind nicht aktuell. `pnpm docs:features` ausführen.')
  process.exit(1)
}
