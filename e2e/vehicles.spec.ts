import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  SEEDED,
  clickDialogButton,
  detailTab,
  expectToast,
  fillField,
  isoDate,
  openDetailTab,
  pickFromSearchablePicker,
  uniqueName,
  uniqueTag
} from './helpers'

/**
 * Vehicles + inventory: seeded list, click-time and server-side
 * validation (holder required, plate format), the full customer-
 * vehicle → Ankauf → stock lifecycle including the tab differences
 * between customer-owned and stock vehicles, and the archive round
 * trip. Self-cleaning: every record created here is deleted again.
 */

test.describe('Fahrzeuge', () => {
  test('list renders seeded vehicles and finds the anchor by plate', async ({
    page
  }) => {
    await gotoHydrated(page, '/vehicles')
    await expect(page.locator('table tbody tr')).toHaveCount(25)

    await page.getByPlaceholder(/Fahrzeuge suchen/).fill(SEEDED.vehicle.plate)
    const row = page.locator('table tbody tr', {
      hasText: SEEDED.vehicle.model
    })
    await expect(row).toHaveCount(1)
    await row.click()
    await page.waitForURL(`**/vehicles/${SEEDED.vehicle.id}`)
    await expect(page.locator('main')).toContainText(SEEDED.vehicle.model)
  })

  test('validation: missing holder and invalid plate produce German errors', async ({
    page
  }) => {
    await gotoHydrated(page, '/vehicles/new')

    // Empty submit → click-time summary + field error, button never disabled.
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(
      page.getByText('Bitte einen Kunden auswählen.').first()
    ).toBeVisible()

    // Server-side plate validation surfaces as a curated German toast.
    await fillField(page, 'Marke', uniqueName('Marke'))
    await pickFromSearchablePicker(page, {
      trigger: '- Kunde wählen -',
      dialogTitle: 'Kunden auswählen',
      query: SEEDED.customer.lastName
    })
    await fillField(page, 'Kennzeichen', '!!!')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(
      page,
      /Fahrzeug konnte nicht angelegt werden: .*Kennzeichen.*gültiges Kennzeichen/
    )

    // Leave via Abbrechen. NOTE (known app quirk, see report): the
    // vehicle form clears the dirty flag BEFORE awaiting the failed
    // server save, so no unsaved-changes dialog protects this exit —
    // handle both behaviors so the spec survives a future fix.
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    const discard = page
      .locator('dialog.modal-open')
      .getByRole('button', { name: 'Verwerfen' })
    const dialogAppeared = await discard
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false)
    if (dialogAppeared) await discard.click()
    await page.waitForURL(/\/vehicles$/)
  })

  test('lifecycle: create for a customer, Ankauf into stock, archive round trip', async ({
    page
  }) => {
    const customer = uniqueName('Halter')
    const make = uniqueName('Marke')
    const plate = `B-E ${String(Date.now()).slice(-4)}`

    /* Own holder so the anchor customer stays untouched. */
    await gotoHydrated(page, '/customers/new')
    await fillField(page, 'Nachname', customer)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)

    /* Create the vehicle with the holder picked via SearchablePicker. */
    await gotoHydrated(page, '/vehicles/new')
    await pickFromSearchablePicker(page, {
      trigger: '- Kunde wählen -',
      dialogTitle: 'Kunden auswählen',
      query: customer
    })
    await fillField(page, 'Marke', make)
    await fillField(page, 'Modell', 'Kombi')
    await fillField(page, 'Kennzeichen', plate)
    await fillField(page, 'Nächste HU', isoDate(180))
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Fahrzeug angelegt.')
    await page.waitForURL(/\/vehicles\/[0-9a-f-]{36}$/)
    const vehicleUrl = page.url()

    /* Customer-owned: Halter tab + Ankauf card, but no stock affordances. */
    await expect(detailTab(page, 'Halter')).toBeVisible()
    await expect(detailTab(page, 'Übersicht')).toBeChecked()
    await expect(detailTab(page, 'Fotos')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Verkaufsschild drucken' })
    ).toHaveCount(0)
    await expect(
      page
        .getByTestId('header-primary-action')
        .filter({ hasText: 'Bearbeiten' })
    ).toBeVisible()

    /* Halter tab shows the compact customer card linking to the holder. */
    await openDetailTab(page, 'Halter')
    await expect(page.locator('main')).toContainText(customer)
    const holderLink = page.getByRole('link', { name: 'Zum Kunden' })
    await expect(holderLink).toHaveAttribute('href', /\/customers\/[0-9a-f-]+/)

    /* Ankauf: date is required at click time (native dialog, role=alert). */
    await openDetailTab(page, 'Übersicht')
    await page
      .getByRole('button', { name: 'Ankauf (in Verkaufsbestand übernehmen)' })
      .click()
    const modal = page.locator('dialog[open]', {
      hasText: 'Ankauf: in Verkaufsbestand übernehmen'
    })
    await expect(modal).toBeVisible()
    await modal.getByLabel('Ankaufsdatum').fill('')
    await modal.getByRole('button', { name: 'Ankauf übernehmen' }).click()
    await expect(
      modal
        .getByRole('alert')
        .filter({ hasText: 'Bitte ein Ankaufsdatum eingeben.' })
    ).toBeVisible()

    await modal.getByLabel('Ankaufsdatum').fill(isoDate(0))
    await modal.getByLabel('Ankaufspreis').fill('1500')
    await modal.getByRole('button', { name: 'Ankauf übernehmen' }).click()
    await expectToast(page, 'Fahrzeug in den Verkaufsbestand übernommen.')

    /* Now stock: Vorbesitzer, Fotos tab + Verkaufsschild; Halter gone. */
    await expect(page.locator('main')).toContainText('Vorbesitzer')
    await expect(
      page.locator('main').getByRole('link', { name: new RegExp(customer) })
    ).toBeVisible()
    await expect(detailTab(page, 'Fotos')).toBeVisible()
    await expect(detailTab(page, 'Halter')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Verkaufsschild drucken' })
    ).toBeVisible()
    await expect(
      page.getByTestId('header-primary-action').filter({ hasText: 'Verkaufen' })
    ).toBeVisible()

    /* Listed under Zu verkaufende Fahrzeuge. */
    await gotoHydrated(page, '/inventory')
    await page.getByPlaceholder(/Zu verkaufende Fahrzeuge suchen/).fill(make)
    await expect(page.locator('table tbody tr', { hasText: make })).toHaveCount(
      1
    )

    /* Archive round trip from the detail view. */
    await gotoHydrated(page, vehicleUrl)
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Fahrzeug archiviert.')
    await expect(
      page.getByText('Dieses Fahrzeug ist archiviert und erscheint nicht mehr')
    ).toBeVisible()

    // The vehicles Archiv tab spans customer AND stock vehicles.
    await gotoHydrated(page, '/vehicles')
    await page.getByRole('tab', { name: 'Archiv' }).click()
    await page.getByPlaceholder(/Fahrzeuge suchen/).fill(make)
    const archivedRow = page.locator('table tbody tr', { hasText: make })
    await expect(archivedRow).toHaveCount(1)
    await expect(archivedRow).toContainText('Archiviert')
    await archivedRow.getByRole('button', { name: 'Reaktivieren' }).click()
    await expectToast(page, /reaktiviert/)

    // Back in the inventory after reactivation.
    await gotoHydrated(page, '/inventory')
    await page.getByPlaceholder(/Zu verkaufende Fahrzeuge suchen/).fill(make)
    await expect(page.locator('table tbody tr', { hasText: make })).toHaveCount(
      1
    )

    /* Cleanup: archive again, delete from the Archiv tab, then the holder. */
    await gotoHydrated(page, vehicleUrl)
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Fahrzeug archiviert.')

    await gotoHydrated(page, '/vehicles')
    await page.getByRole('tab', { name: 'Archiv' }).click()
    await page.getByPlaceholder(/Fahrzeuge suchen/).fill(make)
    await archivedRow.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)

    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(customer)
    const customerRow = page.locator('table tbody tr', { hasText: customer })
    await customerRow.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
  })

  test('inventory can create a stock vehicle directly', async ({ page }) => {
    const make = uniqueName('Marke')

    await gotoHydrated(page, '/inventory/new')
    // Stock mode: no holder requirement, Ankauf fieldset instead.
    await expect(
      page.getByText('Ankaufspreis', { exact: false }).first()
    ).toBeVisible()
    await fillField(page, 'Marke', make)
    await fillField(page, 'Modell', `Limo ${uniqueTag()}`)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Verkaufsfahrzeug angelegt.')
    await page.waitForURL(/\/vehicles\/[0-9a-f-]{36}$/)
    const vehicleUrl = page.url()

    // Stock affordances present right away.
    await expect(detailTab(page, 'Fotos')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Verkaufsschild drucken' })
    ).toBeVisible()

    // Cleanup: archive, then delete from the Archiv tab.
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Fahrzeug archiviert.')
    await gotoHydrated(page, '/vehicles')
    await page.getByRole('tab', { name: 'Archiv' }).click()
    await page.getByPlaceholder(/Fahrzeuge suchen/).fill(make)
    const row = page.locator('table tbody tr', { hasText: make })
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
    void vehicleUrl
  })
})
