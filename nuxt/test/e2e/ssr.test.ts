/**
 * End-to-end against a real production build.
 *
 * This file uses `@nuxt/test-utils/e2e` and must therefore never import
 * `@nuxt/test-utils/runtime` (05-teststrategie.md §1).
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('Serverseitiges Rendern', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    build: true,
    browser: false,
  })

  it('liefert die Startseite vollständig aus', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('TwinCarsManager')
  })

  it('setzt die Dokumentsprache auf Deutsch', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('lang="de"')
  })
})
