import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DefaultLayout from '~/layouts/default.vue'

describe('Standard-Layout', () => {
  it('rendert den Seiteninhalt', async () => {
    const layout = await mountSuspended(DefaultLayout, {
      slots: { default: () => 'Inhalt der Seite' },
    })
    expect(layout.text()).toContain('Inhalt der Seite')
  })

  it('setzt Hintergrund und Textfarbe aus dem Theme, nicht per eigenem CSS', async () => {
    const layout = await mountSuspended(DefaultLayout)
    expect(layout.html()).toContain('bg-default')
  })
})
