import { expect, test, type Page } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  expectToast,
  fillField,
  uniqueName
} from './helpers'

/**
 * Employees + absences. The fixture ships without employees, so the
 * suite creates its own and removes it again. The absence tests all
 * work on that one employee — the file runs serially and later tests
 * are skipped when an earlier one fails (describe.serial).
 *
 * Absence day counts are asserted against 2026 dates around the
 * FEDERAL holiday Tag der Arbeit (01.05.) so the result is stable no
 * matter which Bundesland the company settings carry.
 */

const employeeName = uniqueName('Mitarbeiter')
let employeeUrl = ''

/** The Abwesenheiten card on the employee detail page. */
const absenceCard = (page: Page) =>
  page.locator('.card', { hasText: 'Abwesenheiten' }).first()

const addAbsence = async (
  page: Page,
  opts: { type?: string; from: string; to: string; halfDay?: boolean }
) => {
  const card = absenceCard(page)
  if (opts.type) {
    await card.getByLabel('Typ').selectOption({ label: opts.type })
  }
  await card.getByLabel('Von', { exact: true }).fill(opts.from)
  await card.getByLabel('Bis', { exact: true }).fill(opts.to)
  if (opts.halfDay) await card.getByLabel('Halbtags').check()
  await card.getByRole('button', { name: 'Eintragen' }).click()
}

test.describe.serial('Mitarbeiter & Abwesenheiten', () => {
  test('create employee: validation negatives incl. IBAN, then save', async ({
    page
  }) => {
    await gotoHydrated(page, '/employees/new')

    // Empty submit → German summary + field errors, button not disabled.
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(
      page.getByText('Bitte einen Nachnamen eingeben.').first()
    ).toBeVisible()

    // Invalid IBAN is validated server-side → curated German toast.
    await fillField(page, 'Vorname', 'E2e')
    await fillField(page, 'Nachname', employeeName)
    await fillField(page, 'IBAN', 'KEINE-IBAN')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, /IBAN.*Bitte geben Sie eine gültige IBAN ein\./)

    await fillField(page, 'IBAN', '')
    // Explicit vacation budget so the absence specs never hit the
    // yearly budget gate.
    await fillField(page, 'Urlaubstage', '30')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Mitarbeiter angelegt.')
    await page.waitForURL(/\/employees\/[0-9a-f-]{36}$/)
    employeeUrl = page.url()
    // The employee's name is the page header title on the detail view.
    await expect(page.getByTestId('page-title')).toContainText(employeeName)
  })

  test('vacation spanning weekend + holiday counts business days only', async ({
    page
  }) => {
    await gotoHydrated(page, employeeUrl)

    // Thu 30.04. → Mon 04.05.2026: Fri is Tag der Arbeit, Sat+Sun are
    // weekend → exactly 2 counted days.
    await addAbsence(page, {
      type: 'Urlaub',
      from: '2026-04-30',
      to: '2026-05-04'
    })
    await expectToast(page, 'Abwesenheit eingetragen.')

    const row = absenceCard(page).locator('tbody tr', { hasText: '30.04.2026' })
    await expect(row).toContainText('30.04.2026 - 04.05.2026')
    await expect(row.locator('td.font-mono')).toHaveText('2')
  })

  test('half-day is only allowed for single-day absences', async ({ page }) => {
    await gotoHydrated(page, employeeUrl)

    await addAbsence(page, {
      type: 'Urlaub',
      from: '2026-08-10',
      to: '2026-08-11',
      halfDay: true
    })
    await expect(
      absenceCard(page)
        .getByRole('alert')
        .filter({
          hasText:
            'Ein halber Tag ist nur bei eintägigen Abwesenheiten möglich.'
        })
    ).toBeVisible()

    // Single day + halbtags counts 0,5 (de-DE formatting).
    await absenceCard(page)
      .getByLabel('Bis', { exact: true })
      .fill('2026-08-10')
    await absenceCard(page).getByRole('button', { name: 'Eintragen' }).click()
    await expectToast(page, 'Abwesenheit eingetragen.')
    const row = absenceCard(page).locator('tbody tr', { hasText: '10.08.2026' })
    await expect(row).toContainText('halbtags')
    await expect(row.locator('td.font-mono')).toHaveText('0,5')
  })

  test('same-type overlap is rejected with the German range error', async ({
    page
  }) => {
    await gotoHydrated(page, employeeUrl)

    await addAbsence(page, {
      type: 'Urlaub',
      from: '2026-08-17',
      to: '2026-08-21'
    })
    await expectToast(page, 'Abwesenheit eingetragen.')

    await addAbsence(page, {
      type: 'Urlaub',
      from: '2026-08-19',
      to: '2026-08-20'
    })
    await expectToast(
      page,
      /überschneidet sich mit einer bestehenden Abwesenheit gleicher Art \(17\.08\.2026 - 21\.08\.2026\)/
    )
  })

  test('vacation↔sick overlap asks to replace and replaces on confirm', async ({
    page
  }) => {
    await gotoHydrated(page, employeeUrl)

    await addAbsence(page, {
      type: 'Krankheit',
      from: '2026-08-19',
      to: '2026-08-19'
    })
    const conflict = page
      .getByRole('dialog')
      .filter({ hasText: 'Konflikt mit bestehender Abwesenheit' })
    await expect(conflict).toBeVisible()
    await conflict.getByRole('button', { name: 'Bestehende ersetzen' }).click()
    await expectToast(page, 'Abwesenheit eingetragen.')

    // The sick entry exists, the conflicting vacation is gone.
    await expect(
      absenceCard(page).locator('tbody tr', { hasText: 'Krankheit' })
    ).toHaveCount(1)
    await expect(
      absenceCard(page).locator('tbody tr', {
        hasText: '17.08.2026 - 21.08.2026'
      })
    ).toHaveCount(0)
  })

  test('year picker switches the balance strip', async ({ page }) => {
    await gotoHydrated(page, employeeUrl)
    const card = absenceCard(page)

    const year = new Date().getFullYear()
    await expect(card.getByText(`Anspruch ${year}`)).toBeVisible()
    await card.getByRole('button', { name: 'Nächstes Jahr' }).click()
    await expect(card.getByText(`Anspruch ${year + 1}`)).toBeVisible()
    // No entries were planned for next year.
    await expect(card.locator('tbody tr')).toHaveCount(0)
    await card.getByRole('button', { name: 'Vorheriges Jahr' }).click()
    await expect(card.getByText(`Anspruch ${year}`)).toBeVisible()
  })

  test('cleanup: delete absences and the employee', async ({ page }) => {
    await gotoHydrated(page, employeeUrl)
    const card = absenceCard(page)

    // Delete every absence row (optimistic delete, no dialog).
    const rows = card.locator('tbody tr')
    while ((await rows.count()) > 0) {
      const before = await rows.count()
      await rows.first().getByRole('button', { name: 'Löschen' }).click()
      await expectToast(page, 'Eintrag gelöscht.')
      await expect(rows).toHaveCount(before - 1)
    }

    await gotoHydrated(page, '/employees')
    await page.getByPlaceholder(/Mitarbeiter suchen/).fill(employeeName)
    const row = page.locator('table tbody tr', { hasText: employeeName })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
  })
})
