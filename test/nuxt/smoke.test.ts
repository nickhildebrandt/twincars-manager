import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '~/pages/index.vue'

describe('Testumgebung (nuxt)', () => {
  it('mountet eine Seite im Nuxt-Kontext', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.text()).toContain('TwinCarsManager')
  })

  it('findet Elemente über data-testid, nicht über interne Klassen', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.find('[data-testid="app-version"]').exists()).toBe(true)
  })
})
