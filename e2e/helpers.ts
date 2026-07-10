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

/** Convenience: a full per-run unique record name, e.g. `E2e-Kunde-lx3f9a12`. */
export const uniqueName = (kind: string) => `E2e-${kind}-${uniqueTag()}`

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
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Benutzername').fill(username)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

/**
 * Wait for the single global toast (ToastTray renders `role="status"`)
 * to show the given (partial) text. Only ONE toast is visible at a
 * time — a new one replaces the current.
 */
export const expectToast = async (page: Page, text: string | RegExp) => {
  await expect(page.getByRole('status').filter({ hasText: text })).toBeVisible()
}

/**
 * Assert the click-time validation error summary (forms render
 * `<div class="alert alert-error" role="alert">` at the top).
 */
export const expectErrorSummary = async (page: Page, text: string | RegExp) => {
  await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible()
}

/**
 * The page title <h1> in the AppShell header carries
 * `data-testid="page-title"` but is `md:hidden` — assert its text, not
 * its visibility.
 */
export const expectPageTitle = async (page: Page, title: string | RegExp) => {
  await expect(page.getByTestId('page-title')).toHaveText(title)
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

/**
 * Activate a detail-page tab rendered by TabGroup (DaisyUI radio
 * tabs: `<input type="radio" aria-label="{label}">` inside a
 * `label.tab`). The German label is the radio's accessible name.
 */
export const openDetailTab = async (page: Page, label: string) => {
  await page.getByRole('radio', { name: label, exact: true }).check()
}

/** The TabGroup radio for `label`, e.g. to assert presence/checked state. */
export const detailTab = (page: Page, label: string) =>
  page.getByRole('radio', { name: label, exact: true })

/**
 * Drive a SearchablePicker: click the trigger (button showing the
 * placeholder or the current value), search inside the native dialog,
 * click the matching option row. Selection closes the dialog itself.
 */
export const pickFromSearchablePicker = async (
  page: Page,
  opts: {
    /** Accessible name of the closed trigger button (placeholder text). */
    trigger: string | RegExp
    /** Dialog heading, e.g. "Kunden auswählen" — disambiguates dialogs. */
    dialogTitle: string
    /** Search text typed into the dialog's "Suchen…" input. */
    query: string
    /** Text of the option row to click (defaults to `query`). */
    option?: string | RegExp
  }
) => {
  // Match the trigger by its visible text: when a FormField <label>
  // wraps the picker, the button's accessible NAME is the field label,
  // not the placeholder — hasText works in both anatomies.
  await page
    .getByRole('button')
    .filter({ hasText: opts.trigger })
    .first()
    .click()
  const dialog = page
    .locator('dialog[open]')
    .filter({ hasText: opts.dialogTitle })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder('Suchen…').fill(opts.query)
  await dialog
    .getByRole('button', { name: opts.option ?? opts.query })
    .first()
    .click()
  await expect(dialog).toBeHidden()
}

/**
 * Confirm (or cancel) the currently open modal dialog (ConfirmDialog
 * and the hand-rolled modals all render `dialog.modal-open`). `.last()`
 * because the confirm label may also appear in the page behind it.
 */
export const clickDialogButton = async (page: Page, name: string | RegExp) => {
  await page
    .locator('dialog.modal-open, dialog[open].modal')
    .last()
    .getByRole('button', { name })
    .last()
    .click()
}

/**
 * Navigate and wait until the page has settled (network idle). A bare
 * `page.goto` returns after `load`, but Svelte hydration attaches
 * event handlers and re-syncs bound inputs slightly later — clicking
 * or filling in that window is silently lost. Every spec interaction
 * that follows a full navigation goes through this helper.
 */
export const gotoHydrated = async (page: Page, path: string) => {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/**
 * Fill a field and verify the value stuck. Guards against the rare
 * race where a late-resolving remote query re-initializes a bound
 * input right after Playwright typed into it (fresh SSR loads and
 * detail pages that seed defaults asynchronously).
 */
export const fillFieldVerified = async (
  page: Page,
  labelText: string,
  value: string
) => {
  const input = page.getByLabel(labelText).first()
  for (let attempt = 0; attempt < 3; attempt++) {
    await input.fill(value)
    try {
      await expect(input).toHaveValue(value, { timeout: 1_000 })
      return
    } catch {
      // re-seeded by the app — try again
    }
  }
  await expect(input).toHaveValue(value)
}

/** Today ± n days as the YYYY-MM-DD string date inputs expect. */
export const isoDate = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
