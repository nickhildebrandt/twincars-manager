import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  expectPageTitle,
  expectToast,
  fillField,
  pickFromSearchablePicker,
  uniqueName
} from './helpers'

/**
 * Calendar: month grid with public holidays, appointment lifecycle,
 * the separated cross-module cards on the Termin form, and the
 * employee filter. Creates its own employee + Termin and removes both.
 */

test.describe('Kalender', () => {
  test('month grid renders holidays; no "Neuer Auftrag" on the page', async ({
    page
  }) => {
    await gotoHydrated(page, '/calendar')
    await expectPageTitle(page, 'Kalender')

    // The calendar page itself offers Termin hinzufügen — deliberately
    // NOT a "Neuer Auftrag" action (that lives on /calendar/new).
    await expect(
      page.getByRole('link', { name: 'Termin hinzufügen' })
    ).toBeVisible()
    await expect(
      page.locator('main').getByRole('link', { name: 'Neuer Auftrag' })
    ).toHaveCount(0)
    await expect(
      page.locator('main').getByRole('button', { name: 'Neuer Auftrag' })
    ).toHaveCount(0)

    // Navigate month by month back to May 2026 → Tag der Arbeit chip
    // (rendered as a non-clickable span, title = holiday name).
    const heading = page.locator('main h2')
    const monthNav = page.locator('main .join').first()
    // The h2 renders "{Monat}\n{Jahr}" — normalize whitespace.
    const monthText = async () =>
      ((await heading.textContent()) ?? '').replace(/\s+/g, ' ').trim()
    for (let i = 0; i < 26 && (await monthText()) !== 'Mai 2026'; i++) {
      await monthNav.getByRole('button', { name: 'Zurück' }).click()
      await expect(heading).not.toHaveText(new RegExp('^\\s*$'))
    }
    await expect(heading).toHaveText(/Mai\s+2026/)
    await expect(page.locator('span[title="Tag der Arbeit"]')).toBeVisible()
  })

  test('Termin form shows the two separated group cards', async ({ page }) => {
    await gotoHydrated(page, '/calendar/new')
    await expectPageTitle(page, 'Neuer Eintrag')

    // Cross-module shortcuts live here, in two separated cards.
    await expect(
      page.getByRole('heading', { name: 'Werkstattauftrag' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Urlaub & Krankheit' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Neuer Auftrag' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Zu den Mitarbeitern' })
    ).toBeVisible()
  })

  test('create a Termin, filter by employee, delete it again', async ({
    page
  }) => {
    const employee = uniqueName('Monteur')
    const title = uniqueName('Termin')

    /* Employee for the assignment + filter. */
    await gotoHydrated(page, '/employees/new')
    await fillField(page, 'Vorname', 'E2e')
    await fillField(page, 'Nachname', employee)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Mitarbeiter angelegt.')

    /* Termin with title, times and the employee link. */
    await gotoHydrated(page, '/calendar/new')
    await fillField(page, 'Titel', title)
    await page.getByLabel('Beginn').fill('2026-07-21T09:00')
    await page.getByLabel('Ende').fill('2026-07-21T10:00')
    // The employee picker uses the SearchablePicker default placeholder.
    await pickFromSearchablePicker(page, {
      trigger: 'Bitte wählen',
      dialogTitle: 'Mitarbeiter auswählen',
      query: employee
    })
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Termin angelegt.')
    await page.waitForURL(/\/calendar$/)

    /* Visible in the month grid (July 2026) as a clickable chip. */
    const chip = page
      .locator('main')
      .getByRole('button', { name: new RegExp(title) })
    await expect(chip).toBeVisible()

    /* Employee filter keeps it (positive filter check). */
    await pickFromSearchablePicker(page, {
      trigger: 'Alle Mitarbeiter',
      dialogTitle: 'Mitarbeiter filtern',
      query: employee
    })
    await expect(chip).toBeVisible()

    /* Chip → edit page → delete via ConfirmDialog. */
    await chip.click()
    await page.waitForURL(/\/calendar\/[0-9a-f-]{36}/)
    await page.getByRole('button', { name: 'Löschen' }).first().click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, 'Eintrag gelöscht.')
    await page.waitForURL(/\/calendar$/)
    await expect(
      page.locator('main').getByRole('button', { name: new RegExp(title) })
    ).toHaveCount(0)

    /* Cleanup: remove the employee again. */
    await gotoHydrated(page, '/employees')
    await page.getByPlaceholder(/Mitarbeiter suchen/).fill(employee)
    const row = page.locator('table tbody tr', { hasText: employee })
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
  })
})
