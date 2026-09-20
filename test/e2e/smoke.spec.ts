/**
 * Playwright golden flows. Waiting happens on hydration, never on a timeout.
 * The real flows from 04-ux.md §9 arrive with their work packages.
 */
import { expect, test } from '@nuxt/test-utils/playwright'

test('Startseite lädt und hydriert', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByTestId('app-version')).toBeVisible()
})
