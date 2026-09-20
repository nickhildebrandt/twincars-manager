/**
 * End-to-end against a real production build.
 *
 * This file uses `@nuxt/test-utils/e2e` and must therefore never import
 * `@nuxt/test-utils/runtime` (05-teststrategie.md §1).
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'

describe('Die gebaute Anwendung', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    build: true,
    browser: false,
  })

  describe('Serverseitiges Rendern', () => {
    it('liefert die Startseite vollständig aus', async () => {
      const html = await $fetch<string>('/')
      expect(html).toContain('TwinCarsManager')
    })

    it('setzt die Dokumentsprache auf Deutsch', async () => {
      const html = await $fetch<string>('/')
      expect(html).toContain('lang="de"')
    })

    it('B-034: jede Seite trägt ihren eigenen Titel', async () => {
      // Beim Vorgänger stand in jedem Tab „TwinCarsManager"; Verlauf und
      // Tableiste ließen sich nicht auseinanderhalten.
      const login = await $fetch<string>('/login')
      expect(login).toContain('<title>Anmelden · TwinCarsManager</title>')
    })
  })

  describe('P-21: die Sicherheits-Kopfzeilen am echten Build', () => {
    // Der Unit-Test prüft die Rechnung. Hier zählt, dass sie auch wirklich auf
    // der Antwort landet — und dass die Seite mit ihr noch funktioniert.
    it('liegen auf jeder Antwort', async () => {
      const response = await fetch(url('/login'))

      expect(response.headers.get('content-security-policy')).toContain('default-src \'self\'')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('referrer-policy')).toBe('same-origin')
      expect(response.headers.get('permissions-policy')).toContain('camera=()')
      expect(response.headers.get('x-robots-tag')).toContain('noindex')
      expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    })

    it('liegen auch auf einer abgewiesenen Antwort', async () => {
      // Gerade dort: eine Fehlerseite ohne Richtlinie ist eine Fehlerseite ohne
      // Richtlinie.
      const response = await fetch(url('/api/customers'))
      expect(response.status).toBe(401)
      expect(response.headers.get('content-security-policy')).toBeTruthy()
    })

    it('setzen HSTS nicht, solange über http ausgeliefert wird', async () => {
      const response = await fetch(url('/login'))
      expect(response.headers.get('strict-transport-security')).toBeNull()
    })

    it('M-40: die Richtlinie trägt einen Einmalwert statt `unsafe-inline`', async () => {
      const policy = (await fetch(url('/login'))).headers.get('content-security-policy') ?? ''
      expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{20,}'/)
      expect(policy).not.toContain('\'unsafe-inline\' ')
    })

    it('M-40: jede Antwort bekommt einen anderen Einmalwert', async () => {
      // Wiederverwendet wäre er wertlos.
      const first = nonceFrom((await fetch(url('/login'))).headers.get('content-security-policy'))
      const second = nonceFrom((await fetch(url('/login'))).headers.get('content-security-policy'))
      expect(first).toBeTruthy()
      expect(first).not.toBe(second)
    })

    it('M-40: jedes eingebettete Skript trägt genau diesen Wert', async () => {
      // Der eigentliche Nachweis: ohne den Stempel führt der Browser die
      // Skripte nicht aus, und die Seite bliebe tot.
      const response = await fetch(url('/login'))
      const nonce = nonceFrom(response.headers.get('content-security-policy'))
      const html = await response.text()

      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)]
      expect(inline.length).toBeGreaterThan(0)

      for (const [, attributes] of inline) {
        expect(attributes, `Skript ohne Einmalwert: ${attributes}`)
          .toContain(`nonce="${nonce}"`)
      }
    })

    it('die Seite hydriert trotz der Richtlinie', async () => {
      const html = await $fetch<string>('/login')
      expect(html).toContain('window.__NUXT__')
    })
  })

  describe('P-18: der abgewiesene Zugriff steht im Protokoll', () => {
    // Der Fehler-Haken läuft nur unter Nitro — geprüft wird er deshalb hier,
    // am echten Build, gegen die echte Datenbank.
    it('ein 401 auf einen geschützten Pfad wird nicht protokolliert', async () => {
      // Eine abgelaufene Sitzung ist kein Vorfall. Jede offene Registerkarte
      // erzeugte sonst mehrere Einträge.
      const before = await countSecurityEntries()
      expect((await fetch(url('/api/customers'))).status).toBe(401)
      expect(await countSecurityEntries()).toBe(before)
    })
  })

  describe('Gesundheitsendpunkt', () => {
    it('antwortet ohne Anmeldung', async () => {
      // Eine Zustandsprüfung, die Anmeldedaten braucht, ist keine
      // Zustandsprüfung — der Container fragt sie ohne Sitzung ab.
      const health = await $fetch<{ status: string, database: string, latencyMs: number }>(
        '/api/health',
      )
      expect(health.status).toBe('ok')
      expect(health.database).toBe('ok')
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('verrät nichts über die Installation', async () => {
      // Der Endpunkt ist öffentlich. Version, Konfiguration und Zahlen aus dem
      // Betrieb gehören deshalb nicht hinein.
      const health = await $fetch<Record<string, unknown>>('/api/health')
      expect(Object.keys(health).sort()).toEqual(['database', 'latencyMs', 'status'])
    })
  })
})

/**
 * Wie viele Sicherheitsereignisse im Protokoll stehen.
 *
 * Der End-to-End-Lauf spricht mit derselben Datenbank wie der gebaute Server —
 * anders ließe sich nicht prüfen, ob dort wirklich etwas ankommt.
 */
async function countSecurityEntries(): Promise<number> {
  const { default: postgres } = await import('postgres')
  const { connectionOptions } = await import('../setup/database-helpers')
  const { databaseNameOf } = await import('../setup/database-helpers')

  const sql = postgres(connectionOptions(databaseNameOf(process.env.DATABASE_URL ?? '')))
  try {
    const rows = await sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM audit_log WHERE severity = 'sicherheit'
    `
    return rows[0]?.total ?? 0
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}

/** Der Einmalwert aus einer Inhaltsrichtlinie. */
function nonceFrom(policy: string | null): string | undefined {
  return /'nonce-([^']+)'/.exec(policy ?? '')?.[1]
}
