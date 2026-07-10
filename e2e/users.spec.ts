import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  expectToast,
  login,
  uniqueTag
} from './helpers'

/**
 * Users & roles: create a user with the seeded "Mitarbeiter" role, log
 * in as that user in a fresh (anonymous) context and verify permission
 * filtering (sidebar + 403 error page), then delete the user again.
 *
 * The file is serial: the login test depends on the created user, the
 * cleanup test removes it.
 */

const tag = uniqueTag()
const username = `e2elimited${tag}`
const displayName = `E2e Limited ${tag}`
const password = 'e2e-limitiert-123'

test.describe.serial('Benutzer & Rollen', () => {
  test('create a user and assign the Mitarbeiter role', async ({ page }) => {
    await gotoHydrated(page, '/settings/users')
    await page.getByTestId('header-primary-action').click()
    await page.waitForURL(/\/settings\/users\/new$/)

    // Click-time validation: German error, button never disabled.
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Benutzername zu kurz (mind. 3 Zeichen).' })
    ).toBeVisible()

    await page.getByLabel('Benutzername').fill(username)
    await page.getByLabel('Anzeigename').fill(displayName)
    // FormField appends ' *' to required labels — match exactly to
    // keep "Passwort" and "Passwort bestätigen" apart.
    await page.getByLabel('Passwort *', { exact: true }).fill(password)
    await page.getByLabel('Passwort bestätigen *').fill(password)

    // Roles are assigned through the MultiSelect.
    await page.getByTestId('multiselect-trigger').click()
    await page
      .getByTestId('multiselect-option')
      .filter({ hasText: 'Mitarbeiter' })
      .click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Speichern' }).click()
    await expectToast(page, 'Benutzer angelegt.')
    await page.waitForURL(/\/settings\/users$/)
    await expect(
      page.locator('table tbody tr', { hasText: username })
    ).toHaveCount(1)
  })

  test.describe(() => {
    // Fresh context: no admin storage state.
    test.use({ storageState: { cookies: [], origins: [] } })

    test('the limited user sees a filtered sidebar and hits 403 pages', async ({
      page
    }) => {
      await login(page, username, password)
      await expect(page.getByTestId('user-menu')).toContainText(username)

      const sidebar = page.locator('aside')
      // Modules the Mitarbeiter role covers.
      await expect(
        sidebar.getByRole('link', { name: 'Kunden', exact: true })
      ).toBeVisible()
      await expect(
        sidebar.getByRole('link', { name: 'Aufträge', exact: true })
      ).toBeVisible()
      // Admin-only or excluded modules disappear from the sidebar.
      for (const hidden of [
        'Einstellungen',
        'Mitarbeiter',
        'Buchhaltung',
        'Rundschreiben',
        'Aktuelle Informationen'
      ]) {
        await expect(
          sidebar.getByRole('link', { name: hidden, exact: true })
        ).toHaveCount(0)
      }

      // Direct navigation to a protected route renders the 403 page.
      await gotoHydrated(page, '/settings/users')
      await expect(page.getByText('Zugriff nicht erlaubt')).toBeVisible()
      await expect(
        page.getByText('Sie haben keine Berechtigung, diese Seite aufzurufen.')
      ).toBeVisible()
    })
  })

  test('cleanup: delete the user again', async ({ page }) => {
    await gotoHydrated(page, '/settings/users')
    const row = page.locator('table tbody tr', { hasText: username })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /Benutzer „.*" gelöscht\./)
    await expect(
      page.locator('table tbody tr', { hasText: username })
    ).toHaveCount(0)
  })
})
