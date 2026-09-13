/**
 * Generates one page per endpoint under `docs/api/`.
 *
 * Reads every handler in `server/api/**`, derives method and path from the
 * file name, and picks up the permission guard and the Valibot schema names
 * from the source. Pages marked `status: umgesetzt` are left untouched.
 *
 *   node scripts/docs-api.mjs           create missing pages, refresh stubs
 *   node scripts/docs-api.mjs --check   report differences, change nothing
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const apiDir = join(root, 'server', 'api')
const outDir = join(root, '..', 'docs', 'api')
const check = process.argv.includes('--check')

const read = p => readFileSync(p, 'utf8')

function handlers(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (readdirSync(dir, { withFileTypes: true }).find(d => d.name === entry)?.isDirectory()) {
      out.push(...handlers(full))
    }
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const endpoints = handlers(apiDir).map((file) => {
  const rel = relative(apiDir, file).replace(/\\/g, '/')
  const method = (rel.match(/\.(get|post|put|patch|delete)\.ts$/)?.[1] ?? 'get').toUpperCase()
  const path = '/api/' + rel
    .replace(/\.(get|post|put|patch|delete)\.ts$/, '')
    .replace(/\.ts$/, '')
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.(\w+)\]/g, ':$1*')
    .replace(/\[(\w+)\]/g, ':$1')
  const source = read(file)
  return {
    file,
    method,
    path,
    permission: source.match(/require(?:Any)?Permission\(\s*event\s*,\s*'([^']+)'/)?.[1]
      ?? (/requireUser\(/.test(source) ? 'nur angemeldet' : 'offen'),
    schemas: [...new Set([...source.matchAll(/useValidated\w+\(\s*event\s*,\s*(\w+)/g)].map(m => m[1]))],
    slug: rel.replace(/\.ts$/, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase(),
  }
})

mkdirSync(outDir, { recursive: true })

const page = e => `---
title: ${e.method} ${e.path}
kategorie: api
method: ${e.method}
path: ${e.path}
permission: ${e.permission}
status: geplant
features: []
schemas: ${e.schemas.length ? `[${e.schemas.map(s => `'${s}'`).join(', ')}]` : '[]'}
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${e.method} ${e.path}

_Beschreibung folgt mit dem zugehörigen Arbeitspaket._

## Berechtigung

\`${e.permission}\`

## Eingabe

${e.schemas.length
  ? e.schemas.map(s => `- \`${s}\` aus \`shared/schemas/\``).join('\n')
  : '_Keine validierte Eingabe._'}

## Ausgabe

_Folgt._

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 401 | keine Sitzung | Bitte melden Sie sich an. |
| 403 | Recht fehlt | Sie haben keine Berechtigung für diesen Bereich. |
| 422 | Eingabe ungültig | Bitte prüfen Sie Ihre Eingaben. |

## Quelle

\`${relative(join(root, '..'), e.file)}\`

Zurück zur [API-Übersicht](README.md).
`

let created = 0
let refreshed = 0
let kept = 0
for (const e of endpoints) {
  const target = join(outDir, `${e.slug}.md`)
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target)) {
    const current = read(target)
    if (/^status:\s*umgesetzt/m.test(current)) {
      kept++
      continue
    }
    const strip = text => text.replace(/^updated:.*$/m, '')
    if (strip(current) === strip(page(e))) {
      kept++
      continue
    }
    if (!check) writeFileSync(target, page(e))
    refreshed++
    continue
  }
  if (!check) writeFileSync(target, page(e))
  created++
}

console.log(`API-Seiten: ${endpoints.length} Endpoint(s) · neu ${created} · aktualisiert ${refreshed} · unverändert ${kept}`)
if (check && (created > 0 || refreshed > 0)) {
  console.error('Die API-Seiten sind nicht aktuell. `pnpm docs:api` ausführen.')
  process.exit(1)
}
