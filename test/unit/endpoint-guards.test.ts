/**
 * Every endpoint begins with a guard.
 *
 * A cross-cutting check rather than a per-endpoint one, because the risk is
 * exactly the endpoint nobody thought about. The predecessor relied on
 * discipline alone and lost it in three places (B-002, B-003, B-041); this
 * test notices the fourth before it ships.
 *
 * The server middleware already answers 401 for anything under `/api/` that is
 * not on the public list, so a forgotten guard is not open data. It is still a
 * mistake: without `requirePermission` every signed-in person reaches every
 * module.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const apiDir = fileURLToPath(new URL('../../server/api', import.meta.url))

/**
 * Endpoints that are public on purpose, each with the reason.
 *
 * Adding a line here is a deliberate act, and the reason is part of it.
 */
const PUBLIC_ON_PURPOSE: Record<string, string> = {
  'health.get.ts': 'Zustandsprüfung für den Container — eine, die Anmeldedaten braucht, ist keine',
  'auth/[...all].ts': 'die Anmeldung selbst; sie prüft das Passwort',
  'me.get.ts': 'beantwortet auch den anonymen Fall, damit die Anmeldeseite rendern kann',
}

function endpointFiles(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...endpointFiles(full, base))
    else if (entry.endsWith('.ts')) out.push(relative(base, full).replace(/\\/g, '/'))
  }
  return out
}

const files = endpointFiles(apiDir)

/** The first statement inside `defineEventHandler`, comments and blanks aside. */
function firstStatement(source: string): string {
  const start = source.indexOf('defineEventHandler')
  const brace = source.indexOf('{', source.indexOf('=>', start))
  const body = source.slice(brace + 1)

  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue
    return line
  }
  return ''
}

const GUARDS = ['requirePermission(', 'requireAnyPermission(', 'requireUser(']

describe('Endpoints', () => {
  it('gibt es überhaupt', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s beginnt mit einem Wächter oder ist begründet öffentlich', (file) => {
    const reason = PUBLIC_ON_PURPOSE[file]
    if (reason) {
      expect(reason.length, `Begründung für ${file}`).toBeGreaterThan(20)
      return
    }

    const source = readFileSync(join(apiDir, file), 'utf8')
    const first = firstStatement(source)
    expect(
      GUARDS.some(guard => first.includes(guard)),
      `${file} beginnt mit „${first}" statt mit einem Wächter`,
    ).toBe(true)
  })

  it.each(files)('%s liest Eingaben nur über die geprüften Helfer', (file) => {
    // `readBody`, `getQuery` und `getRouterParams` umgehen Valibot. Die
    // ESLint-Regel verbietet sie bereits; dieser Test macht die Zusage
    // unabhängig von der Lint-Einstellung nachprüfbar.
    const source = readFileSync(join(apiDir, file), 'utf8')
    for (const forbidden of ['readBody(', 'getQuery(', 'getRouterParams(']) {
      expect(source.includes(forbidden), `${file} benutzt ${forbidden}`).toBe(false)
    }
  })
})

describe('Die Ausnahmeliste', () => {
  it('nennt nur Dateien, die es gibt', () => {
    for (const file of Object.keys(PUBLIC_ON_PURPOSE)) {
      expect(files, file).toContain(file)
    }
  })

  it('bleibt kurz', () => {
    // Wächst sie, ist das ein Anlass zum Nachdenken, kein Nebenbei.
    expect(Object.keys(PUBLIC_ON_PURPOSE).length).toBeLessThanOrEqual(5)
  })
})
