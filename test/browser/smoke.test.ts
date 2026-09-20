import { describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import IndexPage from '~/pages/index.vue'

describe('Testumgebung (browser)', () => {
  it('rendert im echten Chromium', async () => {
    const screen = await render(IndexPage)
    await expect.element(screen.getByTestId('app-version')).toBeVisible()
  })
})
