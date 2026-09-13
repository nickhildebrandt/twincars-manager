/**
 * Loads `.env.test` into `process.env` for every test project, unless the
 * variable is already set (CI wins). Runs before any test file.
 *
 * Uses `process.cwd()` rather than `import.meta.url`: inside the Nuxt test
 * environment the module URL is not a `file:` URL.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  const contents = readFileSync(resolve(process.cwd(), '.env.test'), 'utf8')
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (process.env[key] === undefined) process.env[key] = line.slice(eq + 1).trim()
  }
}
catch {
  // Missing .env.test is fine when every value comes from the environment.
}

// A wrong timezone silently breaks date-boundary assertions, so fail loudly.
if (process.env.TZ !== 'Europe/Berlin') {
  throw new Error(
    `Tests müssen mit TZ=Europe/Berlin laufen (gefunden: ${process.env.TZ ?? 'nicht gesetzt'}).`,
  )
}
