import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  SEEDED,
  clickDialogButton,
  detailTab,
  expectErrorSummary,
  expectToast,
  fillField,
  openDetailTab,
  pickFromSearchablePicker,
  uniqueName
} from './helpers'

/**
 * Customers module: seeded data, server-side search, filters and
 * pagination, click-time validation, detail tabs, the unsaved-changes
 * confirm, the delete guard for linked data, and the create → archive
 * → reactivate → delete round trip. Runs with the shared admin
 * storage state from global setup.
 *
 * Specs rely only on (a) the seeded fixture baseline (anonymized
 * legacy import + the canonical `Seedkunde` anchor) and (b) records
 * they create themselves with a per-run unique prefix — and they
 * delete those again.
 */

/** Search the list and delete the (only) matching row. */
const deleteFromList = async (
  page: import('@playwright/test').Page,
  path: string,
  placeholder: RegExp,
  name: string
) => {
  await gotoHydrated(page, path)
  await page.getByPlaceholder(placeholder).fill(name)
  const row = page.locator('table tbody tr', { hasText: name })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: 'Löschen' }).click()
  await clickDialogButton(page, 'Löschen')
  await expectToast(page, /gelöscht/)
}

test.describe('Kunden', () => {
  test('list renders the seeded customers, 25 per page', async ({ page }) => {
    await gotoHydrated(page, '/customers')

    const rows = page.locator('table tbody tr')
    // Fixed page size 25 (CONTRIBUTING §10) against the ~300 seeded rows.
    await expect(rows).toHaveCount(25)
    // The pagination caption carries the seeded total.
    await expect(page.getByText(/Treffer/)).toBeVisible()
    // Anonymized fixture rows are recognizable ("Kunde <Nummer>").
    await expect(
      page
        .locator('table tbody')
        .getByText(/Kunde \d+/)
        .first()
    ).toBeVisible()
  })

  test('search finds the seeded anchor customer by name', async ({ page }) => {
    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(SEEDED.customer.lastName)

    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toContainText(SEEDED.customer.lastName)
    await expect(rows.first()).toContainText(SEEDED.customer.number)

    // Row click navigates to the detail view (fully clickable rows).
    await rows.first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await expect(page.locator('main')).toContainText(SEEDED.customer.lastName)
  })

  test('kind filter tabs switch the list', async ({ page }) => {
    await gotoHydrated(page, '/customers')

    // Privat: regular customers without a company.
    await page.getByRole('tab', { name: 'Privat' }).click()
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Firma: company rows (anonymized fixture names end in "GmbH").
    await page.getByRole('tab', { name: 'Firma' }).click()
    await expect(page.locator('table tbody tr').first()).toContainText('GmbH')

    // eBay: swaps in the eBay-Name column.
    await page.getByRole('tab', { name: 'eBay' }).click()
    await expect(
      page.getByRole('columnheader', { name: 'eBay-Name' })
    ).toBeVisible()
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Archiv is reachable (content depends on run history).
    await page.getByRole('tab', { name: 'Archiv' }).click()
    await expect(page.getByRole('tab', { name: 'Archiv' })).toHaveClass(
      /tab-active/
    )

    // Back to Alle.
    await page.getByRole('tab', { name: 'Alle' }).click()
    await expect(page.locator('table tbody tr')).toHaveCount(25)
  })

  test('pagination pages through and a filter change resets to page 1', async ({
    page
  }) => {
    await gotoHydrated(page, '/customers')
    const caption = page
      .getByRole('navigation', { name: 'Seitennavigation' })
      .first()
    await expect(caption).toContainText(/Treffer · Seite 1 von \d+/)

    // 301 seeded customers → page 2 exists.
    await page
      .getByTestId('pagination-full')
      .getByRole('button', { name: 'Nächste Seite' })
      .click()
    await expect(caption).toContainText(/Seite 2 von \d+/)

    // Typing a search resets to page 1 (server-side, debounced input).
    await page.getByPlaceholder(/Kunden suchen/).fill('Kunde')
    await expect(caption).toContainText(/Seite 1 von \d+/)
  })

  test('click-time validation shows German summary and field errors', async ({
    page
  }) => {
    await gotoHydrated(page, '/customers/new')

    // Empty submit: the button is never disabled; errors appear at click.
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectErrorSummary(
      page,
      'Bitte mindestens Firma oder Nachname angeben.'
    )

    // Invalid e-mail: German field-level message under the input.
    await fillField(page, 'Nachname', uniqueName('Kunde'))
    await fillField(page, 'E-Mail', 'keine-mailadresse')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectErrorSummary(
      page,
      'Bitte eine gültige E-Mail-Adresse eingeben.'
    )
    await expect(
      page.getByText('Bitte eine gültige E-Mail-Adresse eingeben.').last()
    ).toBeVisible()

    // Leave without saving: the unsaved-changes dialog guards Abbrechen.
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(
      page.getByRole('heading', { name: 'Ungespeicherte Änderungen' })
    ).toBeVisible()
    await clickDialogButton(page, 'Verwerfen')
    await page.waitForURL(/\/customers$/)
  })

  test('detail tabs render and support ?tab= deep links', async ({ page }) => {
    await gotoHydrated(page, `/customers/${SEEDED.customer.id}`)

    // Presence, not an exhaustive list (further tabs may be added).
    await expect(detailTab(page, 'Übersicht')).toBeChecked()
    await expect(detailTab(page, 'Fahrzeuge')).toBeVisible()
    await expect(detailTab(page, 'Rechnungen')).toBeVisible()

    // The Fahrzeuge tab lists the anchor vehicle of this customer.
    await openDetailTab(page, 'Fahrzeuge')
    await expect(page.locator('main')).toContainText(SEEDED.vehicle.model)

    // Deep link straight into a tab.
    await gotoHydrated(page, `/customers/${SEEDED.customer.id}?tab=rechnungen`)
    await expect(detailTab(page, 'Rechnungen')).toBeChecked()
  })

  test('edit guards unsaved changes and saves after Bleiben', async ({
    page
  }) => {
    const name = uniqueName('Kunde')

    await gotoHydrated(page, '/customers/new')
    await fillField(page, 'Nachname', name)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)

    // Edit, change a field, try to navigate away → confirm dialog.
    await page.getByRole('link', { name: 'Bearbeiten' }).first().click()
    await page.waitForURL(/\/edit$/)
    await fillField(page, 'Vorname', 'Geändert')
    await page
      .locator('aside')
      .getByRole('link', { name: 'Kunden', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Ungespeicherte Änderungen' })
    ).toBeVisible()

    // Bleiben keeps the form (URL unchanged, value kept) …
    await clickDialogButton(page, 'Bleiben')
    expect(new URL(page.url()).pathname).toMatch(/\/edit$/)
    await expect(page.getByLabel('Vorname').first()).toHaveValue('Geändert')

    // … and saving afterwards works without a second prompt
    // (formDirty is cleared before the post-save goto).
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Kunde gespeichert.')
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await expect(page.locator('main')).toContainText('Geändert')

    // Verwerfen discards a second edit.
    await page.getByRole('link', { name: 'Bearbeiten' }).first().click()
    await page.waitForURL(/\/edit$/)
    await fillField(page, 'Vorname', 'Verworfen')
    await page
      .locator('aside')
      .getByRole('link', { name: 'Kunden', exact: true })
      .click()
    await clickDialogButton(page, 'Verwerfen')
    await page.waitForURL(/\/customers$/)
    await page.getByPlaceholder(/Kunden suchen/).fill(name)
    await expect(
      page.locator('table tbody tr', { hasText: name })
    ).toContainText('Geändert')

    // Cleanup.
    await deleteFromList(page, '/customers', /Kunden suchen/, name)
  })

  test('delete guard refuses a customer with a linked vehicle', async ({
    page
  }) => {
    const name = uniqueName('Kunde')
    const make = uniqueName('Marke')

    // Customer + linked vehicle (holder picked via SearchablePicker).
    await gotoHydrated(page, '/customers/new')
    await fillField(page, 'Nachname', name)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)

    await gotoHydrated(page, '/vehicles/new')
    await fillField(page, 'Marke', make)
    await pickFromSearchablePicker(page, {
      trigger: '- Kunde wählen -',
      dialogTitle: 'Kunden auswählen',
      query: name
    })
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Fahrzeug angelegt.')
    await page.waitForURL(/\/vehicles\/[0-9a-f-]{36}$/)

    // Deleting the customer is refused with the German guard toast
    // that points to archiving instead.
    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(name)
    const row = page.locator('table tbody tr', { hasText: name })
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(
      page,
      /Kunde konnte nicht gelöscht werden: Es sind noch 1 Fahrzeug.*archivieren Sie den Kunden/
    )
    await expect(row).toHaveCount(1)

    // Archiving is the offered alternative and works.
    await row.click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Kunde archiviert.')
    await expect(
      page.getByText('Dieser Kunde ist archiviert und erscheint nicht mehr')
    ).toBeVisible()

    // Cleanup: reactivate, delete the vehicle, then the customer.
    await page.getByRole('button', { name: 'Reaktivieren' }).first().click()
    await clickDialogButton(page, 'Reaktivieren')
    await expectToast(page, 'Kunde reaktiviert.')

    await deleteFromList(page, '/vehicles', /Fahrzeuge suchen/, make)
    await deleteFromList(page, '/customers', /Kunden suchen/, name)
  })

  test('create, archive, reactivate and delete a customer', async ({
    page
  }) => {
    const name = uniqueName('Kunde')

    /* Create — click-time validation first (empty submit), then save. */
    await gotoHydrated(page, '/customers/new')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByRole('alert')).toBeVisible() // German summary
    await fillField(page, 'Nachname', name)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await expect(page.locator('main')).toContainText(name)

    /* Archive from the detail view (ConfirmDialog + toast). */
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Kunde archiviert.')

    /* Hidden from the default list … */
    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(name)
    await expect(page.getByText('Noch keine Kunden')).toBeVisible()

    /* … but listed on the Archiv tab, where it can be reactivated. */
    await page.getByRole('tab', { name: 'Archiv' }).click()
    const archivedRow = page.locator('table tbody tr', { hasText: name })
    await expect(archivedRow).toHaveCount(1)
    await expect(archivedRow).toContainText('Archiviert')
    await archivedRow.getByRole('button', { name: 'Reaktivieren' }).click()
    await expectToast(page, /reaktiviert/)

    /* Back on the default list after reactivation. */
    await page.getByRole('tab', { name: 'Alle' }).click()
    const row = page.locator('table tbody tr', { hasText: name })
    await expect(row).toHaveCount(1)

    /* Cleanup: delete the record (no linked data, so deletion is allowed). */
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
    await expect(page.locator('table tbody tr', { hasText: name })).toHaveCount(
      0
    )
  })
})
