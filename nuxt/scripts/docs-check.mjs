/**
 * Documentation coverage gate.
 *
 * Fails when:
 *   - a feature ID from the inventory has no page under docs/features/
 *   - a server endpoint has no entry under docs/api/
 *   - a page is missing a required frontmatter field
 *   - a relative link points at a file that does not exist
 *   - a page from the new documentation tree is unreachable from docs/index.md
 *
 * Rules: ../../docs/rewrite/03-architektur.md §16.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = join(root, '..')
const docs = join(repo, 'docs')
const planDir = join(docs, 'rewrite')

const problems = []
const read = path => readFileSync(path, 'utf8')

/** Directories that belong to the new documentation tree. */
const TREE = ['features', 'api', 'data', 'ui', 'architecture', 'decisions', 'guides']

/** Required frontmatter per category. */
const REQUIRED = {
  features: ['id', 'title', 'status', 'modul', 'paket', 'updated'],
  api: ['title', 'method', 'path', 'permission', 'status', 'updated'],
  data: ['title', 'status', 'updated'],
  ui: ['title', 'status', 'updated'],
  architecture: ['title', 'status', 'updated'],
  decisions: ['title', 'status', 'updated'],
  guides: ['title', 'status', 'updated'],
}

function markdownFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full))
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const out = {}
  for (const line of m[1].split('\n')) {
    const eq = line.indexOf(':')
    if (eq === -1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

// ── 1. every feature has a page ─────────────────────────────────────────────
const inventoryIds = [...read(join(planDir, '01-inventar.md')).matchAll(/^\| \*\*(F-\d{3})\*\*/gm)]
  .map(m => m[1])

const featurePages = new Map()
for (const file of markdownFiles(join(docs, 'features'))) {
  const fm = frontmatter(read(file))
  if (fm?.id) featurePages.set(fm.id, file)
}

for (const id of inventoryIds) {
  if (!featurePages.has(id)) problems.push(`Feature ${id} hat keine Seite unter docs/features/.`)
}
for (const [id, file] of featurePages) {
  if (!inventoryIds.includes(id)) {
    problems.push(`docs/features/${relative(join(docs, 'features'), file)} nennt die unbekannte ID ${id}.`)
  }
}

// ── 2. every endpoint has an entry ──────────────────────────────────────────
const apiDir = join(root, 'server', 'api')
const endpointFiles = existsSync(apiDir)
  ? markdownFiles(apiDir).length === 0
    ? collectEndpoints(apiDir)
    : []
  : []

function collectEndpoints(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectEndpoints(full))
    else if (/\.(get|post|put|patch|delete)\.ts$/.test(entry) || entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const documentedPaths = new Set()
for (const file of markdownFiles(join(docs, 'api'))) {
  const fm = frontmatter(read(file))
  if (fm?.path && fm?.method) documentedPaths.add(`${fm.method.toUpperCase()} ${fm.path}`)
}

for (const file of endpointFiles) {
  const rel = relative(apiDir, file).replace(/\\/g, '/')
  const method = (rel.match(/\.(get|post|put|patch|delete)\.ts$/)?.[1] ?? 'get').toUpperCase()
  const path = '/api/' + rel
    .replace(/\.(get|post|put|patch|delete)\.ts$/, '')
    .replace(/\.ts$/, '')
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.(\w+)\]/g, ':$1*')
    .replace(/\[(\w+)\]/g, ':$1')
  if (!documentedPaths.has(`${method} ${path}`)) {
    problems.push(`Endpoint ${method} ${path} hat keinen Eintrag unter docs/api/.`)
  }
}

// ── 3. frontmatter completeness ─────────────────────────────────────────────
//
// Pages of the OLD SvelteKit documentation live in the same folders until the
// cutover removes them. They are recognised by the absence of a `kategorie`
// (and, for features, an `id`) field and are deliberately left alone.
const isNewTree = fm => Boolean(fm && (fm.kategorie || fm.id))

const newTreePages = []
for (const category of TREE) {
  for (const file of markdownFiles(join(docs, category))) {
    const fm = frontmatter(read(file))
    if (!isNewTree(fm)) continue
    newTreePages.push(file)
    const rel = relative(repo, file)
    if (/README\.md$/.test(file)) continue
    for (const key of REQUIRED[category] ?? []) {
      if (!fm[key]) problems.push(`${rel}: Frontmatter-Feld "${key}" fehlt.`)
    }
  }
}

// ── 4. relative links resolve ───────────────────────────────────────────────
const allDocs = [join(docs, 'index.md'), ...newTreePages]
for (const file of allDocs) {
  if (!existsSync(file)) continue
  for (const m of read(file).matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)(?:#[^)]*)?\)/g)) {
    const target = resolve(dirname(file), m[1])
    if (!existsSync(target)) {
      problems.push(`${relative(repo, file)}: toter Link auf "${m[1]}".`)
    }
  }
}

// ── 5. reachable from the index in at most two clicks ───────────────────────
const indexFile = join(docs, 'index.md')
if (!existsSync(indexFile)) {
  problems.push('docs/index.md fehlt.')
}
else {
  const linksOf = (file) => {
    if (!existsSync(file) || statSync(file).isDirectory()) return []
    return [...read(file).matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)(?:#[^)]*)?\)/g)]
      .map(m => resolve(dirname(file), m[1]))
  }
  const firstClick = new Set(linksOf(indexFile))
  const reachable = new Set([indexFile, ...firstClick])
  for (const target of firstClick) for (const deep of linksOf(target)) reachable.add(deep)

  for (const category of TREE) {
    const files = newTreePages.filter(f => f.startsWith(join(docs, category)))
    const unreachable = files.filter(f => !reachable.has(f))
    // A category index counts for its own pages: reaching the category page is
    // the first click, the page itself the second.
    if (unreachable.length > 0 && !reachable.has(join(docs, category, 'README.md'))) {
      problems.push(
        `docs/${category}/ ist vom Einstieg aus nicht in zwei Klicks erreichbar `
        + `(${unreachable.length} Seite(n)).`,
      )
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(
  `Doku-Prüfung: ${inventoryIds.length} Feature-IDs · ${featurePages.size} Feature-Seiten · `
  + `${endpointFiles.length} Endpoints · ${documentedPaths.size} API-Einträge · `
  + `${newTreePages.length} Seiten im neuen Baum`,
)

if (problems.length > 0) {
  console.error(`\n${problems.length} Problem(e):`)
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`)
  if (problems.length > 40) console.error(`  … und ${problems.length - 40} weitere.`)
  process.exit(1)
}

console.log('Doku vollständig.')
