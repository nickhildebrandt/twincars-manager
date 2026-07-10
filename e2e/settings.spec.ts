import { expect, test } from '@playwright/test'
import {
  gotoHydrated,
  expectPageTitle,
  expectToast,
  uniqueName
} from './helpers'

/**
 * Settings area: the flat tab navigation (one tablist per page, no
 * nesting), the company form save, the legacy ?tab= redirect, SMTP
 * Testversand click-time validation, the KFZ-Kaufmann import file
 * gate, and the eBay disconnected state. No real mail is sent and no
 * real import is run.
 */

const SETTINGS_TABS: Array<{ label: string; path: string }> = [
  { label: 'Allgemein', path: '/settings' },
  { label: 'Mailvorlagen', path: '/settings/mail' },
  { label: 'Zahlungserinnerung', path: '/settings/reminders' },
  { label: 'SMTP', path: '/settings/smtp' },
  { label: 'Benutzer & Rollen', path: '/settings/users' },
  { label: 'Öffnungszeiten', path: '/settings/workshop-hours' },
  { label: 'Reifen-Erinnerungen', path: '/settings/tire-reminders' },
  { label: 'Anfragen', path: '/settings/inquiries' },
  { label: 'eBay', path: '/settings/ebay' },
  { label: 'Import', path: '/settings/import' },
  { label: 'Konto', path: '/settings/account' }
]

test.describe('Einstellungen', () => {
  test('every settings tab is reachable with exactly one tablist', async ({
    page
  }) => {
    await gotoHydrated(page, '/settings')
    await expectPageTitle(page, 'Einstellungen')

    for (const tab of SETTINGS_TABS) {
      // TabGroup navigation mode: selecting the radio triggers goto().
      await page.getByRole('radio', { name: tab.label, exact: true }).check()
      await page.waitForURL(
        (u) => u.pathname === tab.path || u.pathname === `${tab.path}/`
      )
      await expect(
        page.getByRole('radio', { name: tab.label, exact: true })
      ).toBeChecked()
      // Exactly one tablist — no nested tab bars inside settings pages.
      await expect(page.getByRole('tablist')).toHaveCount(1)
      await expect(
        page.locator('main').getByText('Es ist leider ein Fehler aufgetreten')
      ).toHaveCount(0)
    }
  })

  test('company form saves with a German success toast', async ({ page }) => {
    await gotoHydrated(page, '/settings')

    const owner = page.getByLabel('Inhaber')
    const original = await owner.inputValue()
    await owner.fill(uniqueName('Inhaber'))
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Einstellungen gespeichert.')

    // Restore the original value (self-cleaning).
    await owner.fill(original)
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expectToast(page, 'Einstellungen gespeichert.')
  })

  test('legacy /settings?tab=smtp redirects to /settings/smtp', async ({
    page
  }) => {
    await gotoHydrated(page, '/settings?tab=smtp')
    await page.waitForURL(/\/settings\/smtp$/)
    await expect(page.getByRole('radio', { name: 'SMTP' })).toBeChecked()
  })

  test('SMTP Testversand validates the recipient at click time', async ({
    page
  }) => {
    await gotoHydrated(page, '/settings/smtp')
    // The Testversand card seeds a default recipient once the company
    // query resolves — wait for that before overwriting the field.
    await page.waitForLoadState('networkidle')

    const send = page.getByRole('button', { name: 'Testnachricht senden' })
    const recipient = page.getByLabel('Empfängeradresse')

    // Invalid recipient — no mail is sent, German field error appears.
    await recipient.fill('keine-adresse')
    await expect(recipient).toHaveValue('keine-adresse')
    await send.click()
    await expect(
      page.getByText('Bitte eine gültige Empfängeradresse eingeben.')
    ).toBeVisible()

    // Empty recipient — same curated click-time message, still no send.
    await recipient.fill('')
    await expect(recipient).toHaveValue('')
    await send.click()
    await expect(
      page.getByText('Bitte eine gültige Empfängeradresse eingeben.')
    ).toBeVisible()
    // Only the field error rendered — no server call, no inline alert.
    await expect(page.locator('.alert-error')).toHaveCount(0)
  })

  test('import rejects non-MDB uploads with a German message', async ({
    page
  }) => {
    await gotoHydrated(page, '/settings/import')
    await expectPageTitle(page, 'Daten aus KFZ-Kaufmann importieren')

    // No file picked → inline click-time error.
    await page
      .getByRole('button', { name: 'Vorschau (ohne Speichern)' })
      .click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Bitte zuerst eine .mdb-Datei auswählen.' })
    ).toBeVisible()

    // Wrong file type → curated German toast, nothing uploaded.
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'not-a-database.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('definitely not an mdb')
      })
    await expectToast(page, 'Bitte eine .mdb-Datei auswählen.')
  })

  test('eBay shows the disconnected state and guards the import', async ({
    page
  }) => {
    await gotoHydrated(page, '/settings/ebay')
    await expectPageTitle(page, 'eBay-Verbindung')

    await expect(
      page.getByRole('heading', { name: 'eBay-Verkäuferkonto' })
    ).toBeVisible()

    // Import while disconnected → curated German toast (server 409).
    await page.getByRole('button', { name: 'Angebote importieren' }).click()
    await expectToast(
      page,
      /Der Angebots-Import ist fehlgeschlagen: Kein eBay-Konto verbunden/
    )
  })
})
