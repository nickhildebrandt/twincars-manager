/**
 * Warms Vite's dependency cache for the browser project.
 *
 * Why this exists: with a cold cache the browser project fails before a single
 * test runs, with "Vitest failed to find the runner". Vite optimises the
 * dependencies, discovers another one while the page is already open,
 * re-optimises and reloads — and the setup file
 * (`@nuxt/test-utils/browser`, which registers a `beforeEach` as it loads) is
 * left holding the previous generation of Vitest, whose runner slot is empty.
 * The two generations are visible in the stack trace as different `?v=` query
 * strings on the same module.
 *
 * The second run always succeeds, because the cache is then complete and
 * nothing re-optimises. So the cache is built once, deliberately and visibly,
 * instead of a green run depending on whether somebody happened to run the
 * suite before. **No test is skipped or softened by this** — every test still
 * runs and must pass afterwards.
 *
 * **Warming happens per variant.** Coverage adds a plugin, and a plugin
 * changes the optimiser's fingerprint: a cache warmed without coverage is
 * cold again for `pnpm test:cov`. The variant is therefore part of the
 * marker, and the warm-up runs with the same flags as the run it prepares.
 *
 *   node scripts/warm-vite-cache.mjs             for `pnpm test`
 *   node scripts/warm-vite-cache.mjs --coverage  for `pnpm test:cov`
 *
 * Remove this together with the `pretest*` steps in `package.json` once Vitest
 * or @nuxt/test-utils fixes the reload. Recorded in ../../docs/rewrite/blocker.md.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cache = fileURLToPath(new URL('../node_modules/.cache/vite/client', import.meta.url))

const withCoverage = process.argv.includes('--coverage')
const variant = withCoverage ? 'coverage' : 'plain'
const marker = fileURLToPath(
  new URL(`../node_modules/.cache/twincars-warm-${variant}`, import.meta.url),
)

/**
 * Files whose change makes Vite throw the cache away.
 *
 * Missing is not the only stale state. Three things invalidate the optimiser
 * just as thoroughly, and then the same reload happens again:
 *
 *   - the Vitest or Nuxt configuration changed,
 *   - a package was installed,
 *   - a **browser test file changed** — a new import there can pull in a
 *     dependency the optimiser has not seen, and it re-optimises mid-run.
 */
const INVALIDATORS = ['vitest.config.ts', 'nuxt.config.ts', 'package.json', 'pnpm-lock.yaml']
const WATCHED_DIRECTORIES = ['test/browser', 'test/setup']

const modifiedAt = (relative) => {
  const path = fileURLToPath(new URL(`../${relative}`, import.meta.url))
  return existsSync(path) ? statSync(path).mtimeMs : 0
}

/** The newest modification time anywhere below a directory. */
function newestIn(relative) {
  const directory = fileURLToPath(new URL(`../${relative}`, import.meta.url))
  if (!existsSync(directory)) return 0
  let newest = statSync(directory).mtimeMs
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`
    const at = entry.isDirectory() ? newestIn(child) : modifiedAt(child)
    if (at > newest) newest = at
  }
  return newest
}

function alreadyWarm() {
  if (!existsSync(cache) || !existsSync(marker)) return false
  const warmedAt = statSync(marker).mtimeMs
  return INVALIDATORS.every(file => modifiedAt(file) <= warmedAt)
    && WATCHED_DIRECTORIES.every(directory => newestIn(directory) <= warmedAt)
}

if (alreadyWarm()) {
  process.exit(0)
}

console.log(`[warm] Vite-Zwischenspeicher (${variant}) fehlt oder ist veraltet — Browser-Projekt vorwärmen.`)

const args = ['run', '--project', 'browser', '--silent']
if (withCoverage) args.push('--coverage')

const warmOnce = () =>
  spawnSync('./node_modules/.bin/vitest', args, { cwd: root, stdio: 'ignore' }).status

/**
 * Bis der Lauf durchgeht, höchstens dreimal.
 *
 * Einmal reicht nicht immer: bricht der Vorlauf selbst an dem beschriebenen
 * Neuladen ab, ist der Zwischenspeicher danach halb gebaut, und der eigentliche
 * Lauf ist wieder der erste kalte. Die Marke wird erst nach einem sauberen
 * Durchgang geschrieben — sonst wärmt der nächste Aufruf einfach wieder vor.
 */
let status = warmOnce()
for (let attempt = 1; status !== 0 && attempt < 3; attempt += 1) {
  console.log(`[warm] Der Vorlauf brach ab — noch ein Versuch (${attempt + 1} von 3).`)
  status = warmOnce()
}

if (status !== 0) {
  console.log('[warm] Der Vorlauf ging nicht durch. Der eigentliche Lauf entscheidet.')
  process.exit(0)
}

mkdirSync(dirname(marker), { recursive: true })
writeFileSync(marker, `${new Date().toISOString()}\n`)
// Der Zeitstempel entscheidet, nicht der Inhalt — er wird ausdrücklich auf
// jetzt gesetzt, damit ein Dateisystem mit grober Auflösung nicht daneben
// liegt.
const now = new Date()
utimesSync(marker, now, now)

console.log('[warm] fertig.')
