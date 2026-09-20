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

  /* Der Einrichtungsassistent (T-010). Vor dem Abschluss gibt es **kein
     Konto**, mit dem man sich anmelden könnte — ein Wächter dort wäre eine
     Tür ohne Schlüssel. Geschützt ist jeder dieser Wege dreifach:

       1. das Setup-Tor (`04.setup-gate.ts`) lässt sie nur offen, solange die
          Einrichtung läuft, und antwortet danach mit 409;
       2. `refuseAfterSetup()` steht zusätzlich als erste Anweisung im
          Endpunkt, falls jemand das Tor umbaut;
       3. `createFirstAdmin` weist ab, sobald ein Benutzer existiert.

     Nach dem Abschluss ist keiner von ihnen mehr erreichbar. */
  'setup/state.get.ts': 'Assistent: sagt, was noch fehlt — vor dem Abschluss gibt es kein Konto',
  'setup/profile.put.ts': 'Assistent: Firmendaten — geschützt durch Setup-Tor und refuseAfterSetup',
  'setup/tax.put.ts': 'Assistent: Steuer und Bank — geschützt durch Setup-Tor und refuseAfterSetup',
  'setup/documents.put.ts': 'Assistent: Belegvorgaben — geschützt durch Setup-Tor und refuseAfterSetup',
  'setup/hours.put.ts': 'Assistent: Öffnungszeiten — geschützt durch Setup-Tor und refuseAfterSetup',
  'setup/security.put.ts': 'Assistent: Zugang — geschützt durch Setup-Tor und refuseAfterSetup',
  'setup/admin.post.ts': 'Assistent: das erste Konto — es gibt per Definition noch keines',
  'setup/password-check.post.ts': 'Assistent: Passwortgüte beim Tippen, gibt nur Urteil und Sätze zurück',
  'setup/complete.post.ts': 'Assistent: Abschluss — prüft im Dienst und sperrt sich danach selbst',
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

  it('bleibt auf wenige Flächen beschränkt', () => {
    // Gezählt werden **Flächen**, nicht Dateien: `setup/*` ist eine einzige,
    // hinter einem einzigen Tor. Die Zahl der Dateien darin sagt nichts über
    // das Risiko — die Zahl der Stellen, an denen man ohne Anmeldung
    // hereinkommt, sagt alles.
    //
    // Wächst diese Liste, ist das ein Anlass zum Nachdenken, kein Nebenbei.
    const surfaces = new Set(
      Object.keys(PUBLIC_ON_PURPOSE).map(file => file.split('/')[0]!.replace(/\..*$/, '')),
    )
    expect([...surfaces].sort()).toEqual(['auth', 'health', 'me', 'setup'])
  })

  it('jeder Weg des Assistenten sperrt sich nach dem Abschluss selbst', () => {
    // Der eigentliche Schutz, und er steht im Endpunkt — nicht nur im Tor.
    // Wer das Tor umbaut, findet hier immer noch eine verschlossene Tür.
    //
    // Drei Ausnahmen, alle begründet: `state.get` beantwortet nur eine Frage
    // und schreibt nichts; `admin.post` und `complete.post` prüfen im
    // **Dienst**, weil sie dort ohnehin mehr prüfen müssen — ob schon jemand
    // da ist, ob die Firmendaten vollständig sind. Dass der Dienst es tut,
    // belegt der Test darunter.
    const imDienstGeprueft = [
      'setup/state.get.ts',
      'setup/admin.post.ts',
      'setup/complete.post.ts',
    ]

    for (const file of Object.keys(PUBLIC_ON_PURPOSE)) {
      if (!file.startsWith('setup/') || imDienstGeprueft.includes(file)) continue
      const source = readFileSync(join(apiDir, file), 'utf8')
      expect(source.includes('refuseAfterSetup'), `${file} ruft refuseAfterSetup nicht auf`)
        .toBe(true)
    }
  })

  it('der Dienst sperrt, was die Endpunkte ihm überlassen', () => {
    // `admin.post` und `complete.post` haben keinen eigenen
    // `refuseAfterSetup`-Aufruf, weil der Dienst mehr prüft als nur das.
    // Dass er es tut, steht hier nachlesbar.
    const service = readFileSync(
      fileURLToPath(new URL('../../server/services/setup-service.ts', import.meta.url)),
      'utf8',
    )
    expect(service).toContain('refuseAfterSetup(tx)')
    expect(service).toContain('Der Assistent legt nur das erste an.')
  })
})
