import { expect, test } from '@playwright/test'
import { SEEDED, expectToast, fillField, uniqueTag } from './helpers'

/**
 * Customers module: seeded data, server-side search, and the
 * create → archive → reactivate → delete round trip. Runs with the
 * shared admin storage state from global setup.
 *
 * Specs rely only on (a) the seeded fixture baseline (anonymized
 * legacy import + the canonical `Seedkunde` anchor) and (b) records
 * they create themselves with a per-run unique prefix — and they
 * delete those again.
 */

test.describe('Kunden', () => {
  test('list renders the seeded customers, 25 per page', async ({ page }) => {
    await page.goto('/customers')

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
    await page.goto('/customers')
    await page.getByPlaceholder(/Kunden suchen/).fill(SEEDED.customer.lastName)

    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toContainText(SEEDED.customer.lastName)
    await expect(rows.first()).toContainText(SEEDED.customer.number)

    // Row click navigates to the detail view (fully clickable rows).
    await rows.first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await expect(page.locator('main')).toContainText(SEEDED.customer.lastName)
  })

  test('create, archive, reactivate and delete a customer', async ({
    page
  }) => {
    const name = `E2e-Kunde-${uniqueTag()}`

    /* Create — click-time validation first (empty submit), then save. */
    await page.goto('/customers/new')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByRole('alert')).toBeVisible() // German summary
    await fillField(page, 'Nachname', name)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
    await expect(page.locator('main')).toContainText(name)

    /* Archive from the detail view (ConfirmDialog + toast). */
    await page.getByRole('button', { name: 'Archivieren' }).first().click()
    await page
      .locator('dialog.modal-open')
      .getByRole('button', { name: 'Archivieren' })
      .last()
      .click()
    await expectToast(page, 'Kunde archiviert.')

    /* Hidden from the default list … */
    await page.goto('/customers')
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
    await page
      .locator('dialog.modal-open')
      .getByRole('button', { name: 'Löschen' })
      .last()
      .click()
    await expectToast(page, /gelöscht/)
    await expect(page.locator('table tbody tr', { hasText: name })).toHaveCount(
      0
    )
  })
})
