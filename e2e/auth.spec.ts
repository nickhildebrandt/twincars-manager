import { expect, test } from '@playwright/test'
import { ADMIN_PASSWORD, ADMIN_USERNAME, login } from './helpers'

/**
 * Authentication flows. These specs exercise the login form itself,
 * so they run WITHOUT the shared admin storage state.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Anmeldung', () => {
  test('wrong password shows the curated German error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Benutzername').fill(ADMIN_USERNAME)
    await page.getByLabel('Passwort').fill('definitiv-falsches-passwort')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'Benutzername oder Passwort ist falsch.'
    )
    // Still on the login page — no session was created.
    expect(new URL(page.url()).pathname).toBe('/login')
  })

  test('valid credentials log in and land in the app shell', async ({
    page
  }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD)

    // The sidebar user menu only renders for an authenticated user.
    await expect(page.getByTestId('user-menu')).toBeVisible()
    await expect(page.getByTestId('user-menu')).toContainText(ADMIN_USERNAME)
    expect(new URL(page.url()).pathname).not.toBe('/login')
  })

  test('logout returns to the login page and drops the session', async ({
    page
  }) => {
    await login(page)

    await page.getByTestId('user-menu').click()
    await page.getByRole('button', { name: 'Abmelden' }).click()
    await page.waitForURL(/\/login/)

    // The session is gone: a protected route bounces back to /login.
    await page.goto('/customers')
    await page.waitForURL(/\/login/)
    expect(new URL(page.url()).pathname).toBe('/login')
  })
})
