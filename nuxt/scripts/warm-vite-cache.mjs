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
 * Remove this together with `pnpm test`'s pretest step once Vitest or
 * @nuxt/test-utils fixes the reload. Recorded in ../../docs/rewrite/blocker.md.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cache = fileURLToPath(new URL('../node_modules/.cache/vite/client', import.meta.url))

/**
 * Files whose change makes Vite throw the cache away.
 *
 * Missing is not the only stale state: editing the Vitest configuration or
 * installing a package invalidates the optimiser just as thoroughly, and then
 * the same reload happens again.
 */
const INVALIDATORS = ['vitest.config.ts', 'nuxt.config.ts', 'package.json', 'pnpm-lock.yaml']

const modifiedAt = (relative) => {
  const path = fileURLToPath(new URL(`../${relative}`, import.meta.url))
  return existsSync(path) ? statSync(path).mtimeMs : 0
}

function cacheIsFresh() {
  if (!existsSync(cache)) return false
  const builtAt = statSync(cache).mtimeMs
  return INVALIDATORS.every(file => modifiedAt(file) <= builtAt)
}

if (cacheIsFresh()) {
  process.exit(0)
}

console.log('[warm] Vite-Zwischenspeicher fehlt oder ist veraltet — Browser-Projekt vorwärmen.')
spawnSync('./node_modules/.bin/vitest', ['run', '--project', 'browser', '--silent'], {
  cwd: root,
  stdio: 'ignore',
})
console.log('[warm] fertig.')
