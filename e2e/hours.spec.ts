import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  detailTab,
  expectPageTitle,
  expectToast,
  fillField,
  openDetailTab,
  pickFromSearchablePicker,
  uniqueName
} from './helpers'

/**
 * Time tracking (Stunden): log an entry against a free task, check the
 * list scope tabs, and switch the report tabs. Creates its own
 * employee (the fixture ships none) and cleans everything up.
 */

test.describe('Stunden', () => {
  test('log a time entry and delete it again', async ({ page }) => {
    const employee = uniqueName('Zeiterfasser')
    const task = uniqueName('Aufgabe')

    await gotoHydrated(page, '/employees/new')
    await fillField(page, 'Vorname', 'E2e')
    await fillField(page, 'Nachname', employee)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Mitarbeiter angelegt.')

    await gotoHydrated(page, '/hours/new')
    await expectPageTitle(page, 'Stunden erfassen')

    // Click-time validation first: no employee picked yet.
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Bitte einen Mitarbeiter auswählen.' })
    ).toBeVisible()

    await pickFromSearchablePicker(page, {
      trigger: '- Mitarbeiter suchen und auswählen -',
      dialogTitle: 'Mitarbeiter auswählen',
      query: employee
    })
    await fillField(page, 'Stunden', '2')
    await page.getByRole('radio', { name: 'Freie Aufgabe' }).check()
    // getByLabel('Aufgabe') would also match the "Freie Aufgabe" radio —
    // target the task input by its unique placeholder instead.
    await page.getByPlaceholder('z. B. Werkstattorganisation').fill(task)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Stundeneintrag erfasst.')
    await page.waitForURL(/\/hours\/[0-9a-f-]{36}$/)

    // Listed under Stunden (admin defaults to the "Alle" scope).
    await gotoHydrated(page, '/hours')
    await expect(page.getByRole('tab', { name: 'Alle' })).toBeVisible()
    const row = page.locator('table tbody tr', { hasText: task })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(employee)

    // Cleanup: delete the entry, then the employee.
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /Stundeneintrag .* gelöscht\./)

    await gotoHydrated(page, '/employees')
    await page.getByPlaceholder(/Mitarbeiter suchen/).fill(employee)
    const empRow = page.locator('table tbody tr', { hasText: employee })
    await empRow.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
  })

  test('reports page switches between its two tabs', async ({ page }) => {
    await gotoHydrated(page, '/hours/reports')
    await expectPageTitle(page, 'Auswertungen')

    await expect(detailTab(page, 'Auslastung')).toBeChecked()
    await openDetailTab(page, 'Monatsauswertung')
    await expect(detailTab(page, 'Monatsauswertung')).toBeChecked()
    // The month report exposes its Jahr filter and renders its content
    // (no entries in the current month → German empty state).
    await expect(page.getByLabel('Jahr')).toBeVisible()
    // Either the German empty state (no entries this month) or the
    // report table renders — both prove the monthly panel is active.
    await expect(
      page
        .getByText('In diesem Monat wurden keine Stunden erfasst.')
        .or(page.getByRole('columnheader', { name: 'Mitarbeiter' }))
        .first()
    ).toBeVisible()

    // Deep link works too (tab id "monthly").
    await gotoHydrated(page, '/hours/reports?tab=monthly')
    await expect(detailTab(page, 'Monatsauswertung')).toBeChecked()
  })
})
