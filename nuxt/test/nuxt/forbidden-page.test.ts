/**
 * Die 403-Seite.
 *
 * Der Vorgänger zeigte in diesem Fall nichts: die Navigation filterte den
 * Eintrag weg, aber wer den Link kannte, landete auf einer leeren Seite.
 */
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ForbiddenPage from '~/pages/403.vue'

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }))

// Die Vorlage liest `user` als Ref; eine einfache Attrappe würde im Template
// nicht ausgepackt und stillschweigend „undefined" anzeigen.
mockNuxtImport('useAuth', () => () => ({ user: computed(() => holder.current) }))

describe('403', () => {
  it('sagt, was fehlt', async () => {
    holder.current = null
    const page = await mountSuspended(ForbiddenPage)
    expect(page.find('[data-testid="forbidden-message"]').text()).toContain('Berechtigung')
  })

  it('nennt den Angemeldeten beim Namen', async () => {
    holder.current = { id: 'u-1', username: 'mmustermann', displayName: 'Max Mustermann', roles: [] }
    const page = await mountSuspended(ForbiddenPage)
    expect(page.find('[data-testid="forbidden-message"]').text()).toContain('Max Mustermann')
  })

  it('bietet einen Weg zurück', async () => {
    holder.current = null
    const page = await mountSuspended(ForbiddenPage)
    expect(page.find('[data-testid="forbidden-home"]').attributes('href')).toBe('/')
  })

  it('verrät nicht, was es hinter der Sperre gibt', async () => {
    holder.current = null
    const page = await mountSuspended(ForbiddenPage)
    expect(page.text()).not.toMatch(/customers|settings|invoices/)
  })
})
