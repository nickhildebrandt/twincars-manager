import { expect, test } from '@playwright/test'
import { gotoHydrated, SEEDED, expectPageTitle } from './helpers'

/**
 * App shell navigation: every sidebar entry reaches its page and the
 * header shows the module title; the Start dashboard renders; global
 * search finds the seeded anchor customer and vehicle.
 *
 * Sidebar labels come from src/lib/components/layout/navigation.ts;
 * the expected titles are what each page pushes into the PageHeader
 * store (rendered as `data-testid="page-title"`, which is `md:hidden`
 * — assert the text, never visibility).
 */

const NAV_WALK: Array<{ label: string; path: string; title: string }> = [
  { label: 'Start', path: '/', title: 'Start' },
  { label: 'Kalender', path: '/calendar', title: 'Kalender' },
  { label: 'Kunden', path: '/customers', title: 'Kunden' },
  { label: 'Fahrzeuge', path: '/vehicles', title: 'Fahrzeuge' },
  {
    label: 'Zu verkaufende Fahrzeuge',
    path: '/inventory',
    title: 'Zu verkaufende Fahrzeuge'
  },
  { label: 'Reifenlager', path: '/tire-storage', title: 'Reifenlager' },
  { label: 'Aufträge', path: '/orders', title: 'Aufträge' },
  {
    label: 'Angebote / Kostenvoranschläge',
    path: '/offers',
    title: 'Angebote / Kostenvoranschläge'
  },
  { label: 'Rechnungen', path: '/invoices', title: 'Rechnungen' },
  {
    label: 'Offene Rechnungen',
    path: '/reminders',
    title: 'Offene Rechnungen'
  },
  {
    label: 'Rechnungsausgangsbuch',
    path: '/sales-ledger',
    title: 'Rechnungsausgangsbuch'
  },
  {
    label: 'Leistungen, Material, Artikel',
    path: '/items',
    title: 'Leistungen, Material, Artikel'
  },
  { label: 'Reifenkatalog', path: '/tires', title: 'Reifenkatalog' },
  { label: 'Lieferanten', path: '/suppliers', title: 'Lieferanten' },
  { label: 'Mitarbeiter', path: '/employees', title: 'Mitarbeiter' },
  { label: 'Stunden', path: '/hours', title: 'Stunden' },
  { label: 'Buchhaltung', path: '/ledger', title: 'Buchhaltung' },
  // Nav label and page title deliberately differ for mailings.
  { label: 'Rundschreiben', path: '/mailings', title: 'Serienbriefe' },
  { label: 'Gesendet', path: '/sent', title: 'Gesendet' },
  {
    label: 'Aktuelle Informationen',
    path: '/posts',
    title: 'Aktuelle Informationen'
  },
  { label: 'Anfragen', path: '/settings/inquiries', title: 'Anfragen' },
  { label: 'Einstellungen', path: '/settings', title: 'Einstellungen' }
]

test.describe('Navigation', () => {
  test('every sidebar entry navigates to its module', async ({ page }) => {
    await gotoHydrated(page, '/')
    const sidebar = page.locator('aside')

    for (const entry of NAV_WALK) {
      await sidebar
        .getByRole('link', { name: entry.label, exact: true })
        .click()
      await page.waitForURL(
        (u) => u.pathname === entry.path || u.pathname === `${entry.path}/`
      )
      await expectPageTitle(page, entry.title)
      // A crashed route would render the error boundary instead.
      await expect(
        page.locator('main').getByText('Es ist leider ein Fehler aufgetreten')
      ).toHaveCount(0)
    }
  })

  test('Start dashboard renders stats, quick actions and appointments', async ({
    page
  }) => {
    await gotoHydrated(page, '/')
    await expectPageTitle(page, 'Start')

    // Stat tiles (uppercase captions, not headings).
    for (const stat of ['Monatsumsatz', 'Offene Rechnungen', 'Termine heute']) {
      await expect(
        page.locator('main').getByText(stat, { exact: true })
      ).toBeVisible()
    }

    await expect(
      page.getByRole('heading', { level: 3, name: 'Schnelle Aktionen' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Anstehende Termine' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Neuer Kunde', exact: true })
    ).toBeVisible()
  })

  test('global search finds the anchor customer and vehicle', async ({
    page
  }) => {
    await gotoHydrated(page, '/')

    // Customer by last name. The header trigger is hydration-safe
    // (the Ctrl+K listener attaches only after hydration; the second
    // search below covers the shortcut).
    await page.getByTestId('global-search-trigger').click()
    const dialog = page.getByTestId('global-search-dialog')
    await expect(dialog).toBeVisible()
    await page.getByTestId('global-search-input').fill(SEEDED.customer.lastName)
    const customerHit = page
      .getByTestId('global-search-hit')
      .filter({ hasText: SEEDED.customer.lastName })
      .first()
    await expect(customerHit).toBeVisible()
    await customerHit.click()
    await page.waitForURL(`**/customers/${SEEDED.customer.id}`)
    await expect(page.locator('main')).toContainText(SEEDED.customer.lastName)

    // Vehicle by license plate (plate lives in the hit's sublabel).
    await page.keyboard.press('Control+k')
    await expect(dialog).toBeVisible()
    await page.getByTestId('global-search-input').fill(SEEDED.vehicle.plate)
    const vehicleHit = page
      .getByTestId('global-search-hit')
      .filter({ hasText: SEEDED.vehicle.model })
      .first()
    await expect(vehicleHit).toBeVisible()
    await vehicleHit.click()
    await page.waitForURL(`**/vehicles/${SEEDED.vehicle.id}`)
    await expect(page.locator('main')).toContainText(SEEDED.vehicle.model)
  })
})
