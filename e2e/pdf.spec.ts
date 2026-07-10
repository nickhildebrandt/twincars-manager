import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  expectToast,
  fillField,
  pickFromSearchablePicker,
  uniqueName
} from './helpers'

/**
 * PDF pipeline: the invoice PDF (persisted at creation time) renders
 * in the native browser viewer via a blob iframe, and the
 * Verkaufsschild for a stock vehicle opens as a PDF in a new tab.
 *
 * Both tests create their own records: invoices cannot be deleted
 * (GoBD), so the invoice is marked paid and its customer archived;
 * the stock vehicle is archived and deleted.
 */

test.describe('PDF', () => {
  test('invoice PDF viewer loads the persisted PDF as a blob iframe', async ({
    page
  }) => {
    const customer = uniqueName('PdfKunde')

    await gotoHydrated(page, '/customers/new')
    await fillField(page, 'Nachname', customer)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)

    await gotoHydrated(page, '/invoices/new')
    await pickFromSearchablePicker(page, {
      trigger: 'Kunde suchen',
      dialogTitle: 'Kunde wählen',
      query: customer
    })
    await page.getByTestId('add-position').click()
    await page
      .getByPlaceholder('z. B. Sonderposition')
      .first()
      .fill('E2e PDF-Position')
    await page.getByLabel('Einzelpreis').first().fill('42')
    await page.getByRole('button', { name: 'Rechnung speichern' }).click()
    await expectToast(page, /Rechnung \S+ erstellt\./)
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)

    // The PdfViewer card renders the persisted bytes via a blob URL in
    // the browser's native viewer — never a re-render on the fly.
    await expect(
      page.getByRole('heading', { name: 'PDF-Vorschau' })
    ).toBeVisible()
    const iframe = page.locator('iframe[title="PDF-Vorschau"]')
    await expect(iframe).toBeVisible()
    await expect(iframe).toHaveAttribute('src', /^blob:/)
    await expect(
      page.getByText('PDF konnte nicht geladen werden.')
    ).toHaveCount(0)

    // Keep the Offene-Rechnungen list clean + archive the customer.
    await page
      .getByRole('button', { name: 'Als bezahlt markieren' })
      .first()
      .click()
    await expectToast(page, 'Rechnung als bezahlt markiert.')

    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(customer)
    await page.locator('table tbody tr', { hasText: customer }).click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await clickDialogButton(page, 'Archivieren')
    await expectToast(page, 'Kunde archiviert.')
  })

  test('Verkaufsschild for a stock vehicle opens as a PDF tab', async ({
    page
  }) => {
    const make = uniqueName('Marke')

    await gotoHydrated(page, '/inventory/new')
    await fillField(page, 'Marke', make)
    await fillField(page, 'Modell', 'Schildwagen')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Verkaufsfahrzeug angelegt.')
    await page.waitForURL(/\/vehicles\/[0-9a-f-]{36}$/)

    // The action renders the PDF and opens it in a new tab (blob URL).
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Verkaufsschild drucken' }).click()
    ])
    expect(popup.url()).toMatch(/^blob:/)
    await popup.close()

    // No error toast appeared on the opener page.
    await expect(
      page.getByText('Verkaufsschild konnte nicht erzeugt werden')
    ).toHaveCount(0)

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
  })
})
