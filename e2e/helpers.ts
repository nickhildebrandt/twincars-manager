import { expect, type Page } from '@playwright/test'

/** Default credentials of the seeded admin (see e2e/fixtures/seed.sql.gz). */
export const ADMIN_USERNAME = process.env.E2E_USERNAME ?? 'e2eadmin'
export const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-passwort-123'

/**
 * Canonical anchor records baked into the seed fixture by
 * scripts/generate-test-seed.mjs — stable across regenerations, safe
 * for specs to assert on. Never mutate them from a spec.
 */
export const SEEDED = {
  customer: {
    id: '00000000-0000-4000-8000-00000000e201',
    number: 'E2E-1',
    lastName: 'Seedkunde',
    firstName: 'Erika'
  },
  vehicle: {
    id: '00000000-0000-4000-8000-00000000e202',
    make: 'Volkswagen',
    model: 'Seedwagen',
    plate: 'B-E2E 1'
  }
} as const

/**
 * Per-run unique tag for records a spec creates itself. Specs must
 * prefix their own rows (`E2e-<tag>`) and clean them up again.
 */
export const uniqueTag = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

/**
 * Log in through the real login form. Only needed by specs that run
 * without the shared admin storage state (e.g. the auth specs) — all
 * others start authenticated via `storageState` from global setup.
 */
export const login = async (
  page: Page,
  username: string = ADMIN_USERNAME,
  password: string = ADMIN_PASSWORD
) => {
  await page.goto('/login')
  await page.getByLabel('Benutzername').fill(username)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/**
 * Wait for the single global toast (ToastTray renders `role="status"`)
 * to show the given (partial) text.
 */
export const expectToast = async (page: Page, text: string | RegExp) => {
  await expect(page.getByRole('status').filter({ hasText: text })).toBeVisible()
}

/**
 * Fill the input rendered inside the FormField label whose text starts
 * with `labelText` (the project renders `<label><span>Text *</span>
 * <input …></label>` everywhere, so implicit label association makes
 * getByLabel work; this helper narrows to the first match).
 */
export const fillField = async (
  page: Page,
  labelText: string,
  value: string
) => {
  await page.getByLabel(labelText).first().fill(value)
}
