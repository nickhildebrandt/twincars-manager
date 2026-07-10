import { expect, test } from '@playwright/test'
import { gotoHydrated, expectPageTitle, expectToast } from './helpers'

/**
 * Smoke coverage for the remaining modules: the list page renders with
 * its title and expected baseline content, and — where a create form
 * exists — an empty submit produces the German click-time error
 * summary before the form is left again without saving anything.
 */

test.describe('Modul-Smoke', () => {
  test('lists render their seeded baseline', async ({ page }) => {
    // Offers: the fixture carries 7 legacy cost estimates.
    await gotoHydrated(page, '/offers')
    await expectPageTitle(page, 'Angebote / Kostenvoranschläge')
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Items: full legacy catalog (131 rows, paginated at 25).
    await gotoHydrated(page, '/items')
    await expectPageTitle(page, 'Leistungen, Material, Artikel')
    await expect(page.locator('table tbody tr')).toHaveCount(25)

    // Suppliers: one seeded row.
    await gotoHydrated(page, '/suppliers')
    await expectPageTitle(page, 'Lieferanten')
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Tire storage: two seeded entries + the Aktiv/Abgeholt tabs.
    await gotoHydrated(page, '/tire-storage')
    await expectPageTitle(page, 'Reifenlager')
    await expect(page.getByRole('tab', { name: 'Aktiv' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Abgeholt' })).toBeVisible()

    // Sales ledger: stat cards render.
    await gotoHydrated(page, '/sales-ledger')
    await expectPageTitle(page, 'Rechnungsausgangsbuch')
    await expect(page.getByText('Brutto-Umsatz').first()).toBeVisible()

    // Sent: nothing has ever been mailed in the E2E environment.
    await gotoHydrated(page, '/sent')
    await expectPageTitle(page, 'Gesendet')
    await expect(
      page.getByText('Noch keine versendeten Dokumente')
    ).toBeVisible()

    // Ledger: month view renders (bookings or the empty state).
    await gotoHydrated(page, '/ledger')
    await expectPageTitle(page, 'Buchhaltung')
  })

  test('Offene Rechnungen: batch action reports nothing due', async ({
    page
  }) => {
    await gotoHydrated(page, '/reminders')
    await expectPageTitle(page, 'Offene Rechnungen')
    await expect(page.getByText('Offene Beträge').first()).toBeVisible()

    // All fixture invoices are paid and specs mark theirs paid too, so
    // the operator-triggered batch finds nothing — and sends nothing.
    await page.getByTestId('header-primary-action').click()
    await expectToast(page, 'Keine fälligen Zahlungserinnerungen.')
  })

  test('mailings compose validates at click time', async ({ page }) => {
    await gotoHydrated(page, '/mailings')
    await expectPageTitle(page, 'Serienbriefe')
    await expect(
      page.getByRole('heading', { name: 'Nachricht verfassen' })
    ).toBeVisible()

    // Empty submit → German error summary; no ConfirmDialog opens.
    await page.getByRole('button', { name: 'Senden', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('dialog.modal-open')).toHaveCount(0)
  })

  const CREATE_VALIDATE_CANCEL: Array<{
    path: string
    title: string
    error: string | RegExp
  }> = [
    {
      path: '/tires/new',
      title: 'Neuen Reifen anlegen',
      error: 'Bitte die Marke angeben.'
    },
    {
      path: '/tire-storage/new',
      title: 'Neue Reifeneinlagerung',
      error: 'Bitte einen Kunden auswählen.'
    },
    {
      path: '/posts/new',
      title: 'Neuen Beitrag anlegen',
      error: 'Bitte einen Titel eingeben.'
    },
    {
      path: '/ledger/new',
      title: 'Neue Buchung anlegen',
      error: 'Bitte eine Beschreibung eingeben.'
    },
    {
      path: '/items/new',
      title: 'Neuen Artikel anlegen',
      error: 'Bitte eine Beschreibung eingeben.'
    },
    {
      path: '/suppliers/new',
      title: 'Neuen Lieferanten anlegen',
      error: 'Bitte einen Firmennamen eingeben.'
    },
    {
      path: '/offers/new',
      title: 'Neues Angebot anlegen',
      error: 'Bitte einen Kunden auswählen.'
    }
  ]

  for (const target of CREATE_VALIDATE_CANCEL) {
    test(`create-validate-cancel: ${target.path}`, async ({ page }) => {
      await gotoHydrated(page, target.path)
      await expectPageTitle(page, target.title)

      // Empty submit → German summary; nothing is persisted.
      await page
        .getByRole('button', { name: /Speichern|speichern/ })
        .first()
        .click()
      await expect(
        page.getByRole('alert').filter({ hasText: target.error })
      ).toBeVisible()
    })
  }
})
