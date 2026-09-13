/**
 * Nachweis für die Modelländerungen und Prüfregeln.
 *
 * Jede Kennung `M-nn` und `P-nn` aus ../docs/rewrite/09-modellaenderungen.md
 * braucht einen Test, dessen Name mit ihr beginnt — genau wie bei den Befunden.
 * Fällig wird eine Kennung, sobald ihr Arbeitspaket in fortschritt.md als
 * fertig steht.
 *
 *   node scripts/check-modell.mjs          nur fertige Pakete (CI)
 *   node scripts/check-modell.mjs --all    alles (Überblick)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const planDir = join(root, '..', 'docs', 'rewrite')
const all = process.argv.includes('--all')

const read = (path) => {
  try {
    return readFileSync(path, 'utf8')
  }
  catch {
    return ''
  }
}

const plan = read(join(planDir, '09-modellaenderungen.md'))

// ── Zuordnung Kennung → Paket ───────────────────────────────────────────────
const owner = new Map()
const short = new Map()
for (const line of plan.split('\n')) {
  const m = line.match(/^\| (M-\d{2}|P-\d{2}) \| (T-\d{3}) \| (.+?) \|\s*$/)
  if (m) {
    owner.set(m[1], m[2])
    short.set(m[1], m[3])
  }
}

// ── Welche Pakete sind fertig ───────────────────────────────────────────────
const done = new Set(
  [...read(join(planDir, 'fortschritt.md')).matchAll(/^## (T-\d{3}) .*fertig/gm)]
    .map(m => m[1]),
)

// ── Welche Kennungen haben einen Test ───────────────────────────────────────
function testFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...testFiles(full))
    else if (/\.(test|spec)\.ts$/.test(entry)) out.push(full)
  }
  return out
}

const covered = new Set()
for (const file of testFiles(join(root, 'test'))) {
  for (const m of read(file).matchAll(/it\(\s*[`'"](M-\d{2}|P-\d{2})/g)) {
    covered.add(m[1])
  }
}

// ── Auswerten ───────────────────────────────────────────────────────────────
const ids = [...owner.keys()].sort()
const due = ids.filter(id => all || done.has(owner.get(id)))
const open = due.filter(id => !covered.has(id))

console.log(
  `Modelländerungen und Prüfregeln: ${ids.length} · `
  + `fällig: ${due.length} · abgedeckt: ${due.length - open.length} · offen: ${open.length}`,
)

if (open.length > 0) {
  console.log('\nOhne Nachweis:')
  for (const id of open) {
    console.log(`  ${id}  (${owner.get(id)})  ${short.get(id)}`)
  }
  console.log(
    '\nJede Kennung braucht einen Test, dessen Name mit ihr beginnt, '
    + 'z. B. it(\'P-03: je Fahrzeug ist genau ein Radsatz montiert\', …).',
  )
  process.exit(1)
}
