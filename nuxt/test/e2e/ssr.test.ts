/**
 * End-to-end against a real production build.
 *
 * This file uses `@nuxt/test-utils/e2e` and must therefore never import
 * `@nuxt/test-utils/runtime` (05-teststrategie.md §1).
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

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
