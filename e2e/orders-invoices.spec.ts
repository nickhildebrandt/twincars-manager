import { expect, test, type Page } from '@playwright/test'
import {
  gotoHydrated,
  clickDialogButton,
  expectErrorSummary,
  expectToast,
  fillField,
  fillFieldVerified,
  isoDate,
  pickFromSearchablePicker,
  uniqueName
} from './helpers'

/**
 * Orders (Aufträge) + invoices: the customer-or-vehicle rule, the full
 * completion → invoice → Storno → correction → re-completion cycle,
 * the Kanban board guard, and the standalone Teileverkauf invoice.
 *
 * Invoices are GoBD artifacts and cannot be deleted — specs mark them
 * paid (so the Offene-Rechnungen list stays clean) and archive their
 * throwaway customer instead of deleting it.
 */

/** Create a bare customer to hang orders/invoices on; returns the name. */
const createCustomer = async (page: Page, name: string) => {
  await gotoHydrated(page, '/customers/new')
  await fillField(page, 'Nachname', name)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
}

/** Archive the customer created by a test (delete is guarded by documents). */
const archiveCustomer = async (page: Page, name: string) => {
  await gotoHydrated(page, '/customers')
  await page.getByPlaceholder(/Kunden suchen/).fill(name)
  await page.locator('table tbody tr', { hasText: name }).click()
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: 'Archivieren' }).first().click()
  await clickDialogButton(page, 'Archivieren')
  await expectToast(page, 'Kunde archiviert.')
}

test.describe('Aufträge & Rechnungen', () => {
  test('storno cycle: complete → invoice → Storno → correct → re-complete', async ({
    page
  }) => {
    const customer = uniqueName('Auftraggeber')
    const title = uniqueName('Auftrag')
    await createCustomer(page, customer)

    /* Neither customer nor vehicle → German click-time validation. */
    await gotoHydrated(page, '/orders/new')
    await fillField(page, 'Titel', title)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectErrorSummary(
      page,
      'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'
    )

    await pickFromSearchablePicker(page, {
      trigger: 'Kunde suchen',
      dialogTitle: 'Kunde wählen',
      query: customer
    })
    // Picking a customer re-composes the auto title — set ours AFTER.
    await fillFieldVerified(page, 'Titel', title)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Auftrag angelegt.')
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    const orderUrl = page.url()

    /* The URL flips before the suspended detail page replaces the old
     * form (async SSR navigation) — anchor on detail-only content
     * before touching the item form, or fills land on the OLD page. */
    await expect(
      page.getByRole('heading', { name: 'Neue Position erfassen' })
    ).toBeVisible()

    /* Labor item (Arbeitszeit is the default kind). Verified fills:
     * the item form seeds defaults from a late-resolving rate query. */
    await fillFieldVerified(page, 'Beschreibung', 'E2e Bremsen entlüftet')
    await fillFieldVerified(page, 'Stunden', '2')
    await fillFieldVerified(page, 'Stundensatz (netto)', '60')
    await page.getByRole('button', { name: 'Position hinzufügen' }).click()
    await expectToast(page, 'Position hinzugefügt.')

    /* Material item. */
    await page.getByRole('radio', { name: 'Material' }).check()
    await fillFieldVerified(page, 'Beschreibung', 'E2e Bremsflüssigkeit')
    await fillFieldVerified(page, 'Menge', '2')
    await fillFieldVerified(page, 'Einzelpreis (netto)', '12.5')
    await page.getByRole('button', { name: 'Position hinzufügen' }).click()
    await expectToast(page, 'Position hinzugefügt.')

    /* Complete: creates the invoice and locks the order. */
    await page
      .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
      .click()
    const completeDialog = page.locator('dialog.modal-open', {
      hasText: 'Auftrag abschließen?'
    })
    await expect(completeDialog).toBeVisible()
    await completeDialog.getByLabel('Rechnungsdatum').fill(isoDate(0))
    await completeDialog
      .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
      .click()
    await expectToast(page, /Rechnung \S+ erstellt\./)
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)
    const invoiceUrl = page.url()

    /* Invoice detail shows the Auftrag card linking back. */
    await expect(
      page.getByRole('heading', { name: 'Auftrag', exact: true })
    ).toBeVisible()
    await page.getByRole('link', { name: 'Zum Auftrag' }).click()
    await page.waitForURL(orderUrl)

    /* Locked order: German hint, no item form, no second completion. */
    await expect(
      page.getByText('Positionen sind gesperrt, solange eine gültige Rechnung')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Position hinzufügen' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
    ).toHaveCount(0)
    await expect(
      page.locator('.badge', { hasText: 'Abgeschlossen' }).first()
    ).toBeVisible()

    /* Stornieren: reason is required, then the Storno is created. */
    await gotoHydrated(page, invoiceUrl)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const stornoDialog = page.locator('dialog.modal-open', {
      hasText: 'Rechnung stornieren?'
    })
    await expect(stornoDialog).toBeVisible()
    await stornoDialog.getByRole('button', { name: 'Stornieren' }).click()
    await expectToast(page, 'Bitte einen Stornogrund angeben.')
    await stornoDialog
      .getByPlaceholder('Bitte Stornogrund eingeben')
      .fill('E2e Testkorrektur')
    await stornoDialog.getByRole('button', { name: 'Stornieren' }).click()
    await expectToast(page, /Stornorechnung \S+ erstellt\./)

    /* Landed on the retained Storno document (a NEW invoice route). */
    await page.waitForURL(
      (u) =>
        /\/invoices\/[0-9a-f-]{36}$/.test(u.pathname) && u.href !== invoiceUrl
    )
    await expect(page.getByText(/Stornorechnung zu Rechnung/)).toBeVisible()

    /* The original stays readable and is marked Storniert. */
    await page.getByRole('link', { name: 'Zur Original-Rechnung' }).click()
    await page.waitForURL(invoiceUrl)
    await expect(
      page.getByText(/Diese Rechnung wurde am .* storniert\./)
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Zur Stornorechnung' })
    ).toBeVisible()

    /* The order is reopened (In Bearbeitung) and editable again. */
    await gotoHydrated(page, orderUrl)
    await expect(
      page.locator('.badge', { hasText: 'In Bearbeitung' }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Position hinzufügen' })
    ).toBeVisible()

    /* Correct the labor item (2 h → 3 h). */
    await page
      .getByRole('button', { name: 'Position bearbeiten' })
      .first()
      .click()
    await expect(page.getByText('Position bearbeiten').first()).toBeVisible()
    await fillField(page, 'Stunden', '3')
    await page.getByRole('button', { name: 'Position speichern' }).click()
    await expectToast(page, 'Position gespeichert.')

    /* Re-complete → second invoice. */
    await page
      .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
      .click()
    await completeDialog.getByLabel('Rechnungsdatum').fill(isoDate(0))
    await completeDialog
      .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
      .click()
    await expectToast(page, /Rechnung \S+ erstellt\./)
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)
    const secondInvoiceUrl = page.url()

    /* History card on the order lists all three documents. */
    await gotoHydrated(page, orderUrl)
    const history = page
      .locator('.card', {
        hasText: 'Alle zu diesem Auftrag erstellten Rechnungen'
      })
      .first()
    await expect(history.locator('tbody tr')).toHaveCount(3)
    await expect(history.getByText('Storniert', { exact: true })).toBeVisible()
    await expect(
      history.getByText('Stornorechnung', { exact: true })
    ).toBeVisible()

    /* Mark the active invoice paid so Offene Rechnungen stays clean. */
    await gotoHydrated(page, secondInvoiceUrl)
    await page
      .getByRole('button', { name: 'Als bezahlt markieren' })
      .first()
      .click()
    await expectToast(page, 'Rechnung als bezahlt markiert.')

    await archiveCustomer(page, customer)
  })

  test('Kanban: drag to Abgeschlossen is rejected, click-move works', async ({
    page
  }) => {
    const customer = uniqueName('Kanban')
    const title = uniqueName('Auftrag')
    await createCustomer(page, customer)

    await gotoHydrated(page, '/orders/new')
    await pickFromSearchablePicker(page, {
      trigger: 'Kunde suchen',
      dialogTitle: 'Kunde wählen',
      query: customer
    })
    // Set the title AFTER the pick — the form auto-composes it from
    // the selected customer and would overwrite an earlier value.
    await fillFieldVerified(page, 'Titel', title)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Auftrag angelegt.')
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
    const orderUrl = page.url()

    /* Board: the fresh order sits in "Offen". */
    await gotoHydrated(page, '/orders')
    const offen = page.getByRole('list', { name: 'Offen' })
    const inBearbeitung = page.getByRole('list', { name: 'In Bearbeitung' })
    const done = page.getByRole('list', { name: 'Abgeschlossen' })
    const card = offen.locator('[draggable="true"]', { hasText: title })
    await expect(card).toHaveCount(1)

    /* Dragging onto Abgeschlossen is rejected with the German toast
     * and the card stays where it was. */
    await card.dragTo(done)
    await expectToast(
      page,
      /Abschließen ist nur über die Auftragsseite möglich/
    )
    await expect(
      offen.locator('[draggable="true"]', { hasText: title })
    ).toHaveCount(1)
    await expect(done.getByText(title)).toHaveCount(0)

    /* The arrow affordance moves it instantly (optimistic Kanban). */
    await offen
      .locator('[draggable="true"]', { hasText: title })
      .getByRole('button', { name: 'In Bearbeitung verschieben' })
      .click()
    await expect(
      inBearbeitung.locator('[draggable="true"]', { hasText: title })
    ).toHaveCount(1)

    /* Cleanup: a fresh order without invoice may be deleted. */
    await gotoHydrated(page, orderUrl)
    await page.getByRole('button', { name: 'Löschen' }).first().click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, 'Auftrag gelöscht.')

    await gotoHydrated(page, '/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(customer)
    const row = page.locator('table tbody tr', { hasText: customer })
    await row.getByRole('button', { name: 'Löschen' }).click()
    await clickDialogButton(page, 'Löschen')
    await expectToast(page, /gelöscht/)
  })

  test('standalone Teileverkauf invoice with PDF preview', async ({ page }) => {
    const customer = uniqueName('Teilekunde')
    await createCustomer(page, customer)

    await gotoHydrated(page, '/invoices/new')

    /* Customer required at click time. */
    await page.getByRole('button', { name: 'Rechnung speichern' }).click()
    await expectErrorSummary(page, 'Bitte einen Kunden auswählen.')

    await pickFromSearchablePicker(page, {
      trigger: 'Kunde suchen',
      dialogTitle: 'Kunde wählen',
      query: customer
    })
    await page.getByTestId('add-position').click()
    await page
      .getByPlaceholder('z. B. Sonderposition')
      .first()
      .fill('E2e Wischerblätter')
    await page.getByLabel('Einzelpreis').first().fill('19.9')
    await page.getByRole('button', { name: 'Rechnung speichern' }).click()
    await expectToast(page, /Rechnung \S+ erstellt\./)
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)

    /* Standalone: no Auftrag card; the persisted PDF renders in the
     * native viewer via a blob iframe. */
    await expect(
      page.getByRole('heading', { name: 'Auftrag', exact: true })
    ).toHaveCount(0)
    const iframe = page.locator('iframe[title="PDF-Vorschau"]')
    await expect(iframe).toBeVisible()
    await expect(iframe).toHaveAttribute('src', /^blob:/)

    /* Keep Offene Rechnungen clean + cleanup. */
    await page
      .getByRole('button', { name: 'Als bezahlt markieren' })
      .first()
      .click()
    await expectToast(page, 'Rechnung als bezahlt markiert.')
    await archiveCustomer(page, customer)
  })
})
