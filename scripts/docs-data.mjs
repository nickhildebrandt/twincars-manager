/**
 * Generates the table catalogue under `docs/data/tabellen.md` from the Drizzle
 * schema in `server/database/schema/`.
 *
 * Deliberately simple: it reads the exported `pgTable` definitions textually
 * rather than importing them, so it needs no database and no build step.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const schemaDir = join(root, 'server', 'database', 'schema')
const outFile = join(root, '..', 'docs', 'data', 'tabellen.md')

const tables = []
if (existsSync(schemaDir)) {
  for (const file of readdirSync(schemaDir).filter(f => f.endsWith('.ts'))) {
    const source = readFileSync(join(schemaDir, file), 'utf8')
    for (const m of source.matchAll(/export const (\w+)\s*=\s*pgTable\(\s*'([^']+)'/g)) {
      const columns = [...source.slice(m.index).matchAll(/^\s{4}(\w+):\s*(\w+)\(/gm)]
        .slice(0, 60)
        .map(c => ({ name: c[1], type: c[2] }))
      tables.push({ exportName: m[1], table: m[2], file, columns })
    }
  }
}

mkdirSync(join(root, '..', 'docs', 'data'), { recursive: true })

const body = tables.length === 0
  ? '_Noch kein Schema vorhanden — es entsteht mit Arbeitspaket T-005._\n'
  : tables.map(t => `## \`${t.table}\`

Drizzle-Export \`${t.exportName}\` in \`server/database/schema/${t.file}\`.

| Spalte | Typ |
| --- | --- |
${t.columns.map(c => `| \`${c.name}\` | ${c.type} |`).join('\n')}
`).join('\n')

writeFileSync(outFile, `---
title: Tabellen
kategorie: data
status: ${tables.length === 0 ? 'geplant' : 'umgesetzt'}
updated: ${new Date().toISOString().slice(0, 10)}
---

# Tabellen

Erzeugt aus dem Drizzle-Schema mit \`pnpm docs:data\`. Nicht von Hand ändern.

Zurück zur [Daten-Übersicht](README.md).

${body}`)

console.log(`Tabellenkatalog: ${tables.length} Tabelle(n) nach docs/data/tabellen.md`)
