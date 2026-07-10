import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

/**
 * Playwright E2E configuration.
 *
 * The suite runs against a PRODUCTION build (`pnpm build`) served by
 * `node build`, never against `vite dev` — several past bugs (stale
 * list caches, hydration races) only reproduced in production builds.
 *
 * Recommended workflow (see docs/operations/test-database.md):
 *
 *   pnpm build
 *   node scripts/seed-test-db.mjs        # reproducible test database
 *   ORIGIN=http://localhost:4173 PORT=4173 node build &
 *   pnpm test:e2e
 *
 * Alternatively let the harness manage the server itself:
 *
 *   E2E_WEB_SERVER=1 SEED=1 pnpm test:e2e
 *
 * Environment (all optional):
 *   BASE_URL        target server        (default http://localhost:4173)
 *   CHROMIUM_PATH   chromium executable  (default: cached ms-playwright
 *                   binary, see below; browsers are never downloaded —
 *                   keep PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 when
 *                   installing dependencies)
 *   E2E_USERNAME    login user           (default e2eadmin)
 *   E2E_PASSWORD    login password       (default e2e-passwort-123)
 *   SEED=1          reseed the database from e2e/fixtures/seed.sql.gz
 *                   before the run (drives scripts/seed-test-db.mjs)
 *   E2E_WEB_SERVER=1  let global setup spawn `node build` when nothing
 *                   answers on BASE_URL (and stop it afterwards)
 */

/**
 * Resolve the Chromium executable without ever downloading a browser.
 * Order: explicit env override, then the cached ms-playwright binary
 * this dev environment ships, then Playwright's own resolution (only
 * sensible on machines where `playwright install chromium` ran).
 */
const CACHED_CHROMIUM =
  '/home/nick/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome'
const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync(CACHED_CHROMIUM) ? CACHED_CHROMIUM : undefined)

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  globalSetup: './e2e/global-setup',
  globalTeardown: './e2e/global-teardown',
  /* Specs are written to be independent; files may run in parallel
   * workers, tests within a file stay serial. */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    /* Created by global setup: a logged-in admin session. Specs that
     * must run anonymously (login tests) override this per-file. */
    storageState: 'e2e/.auth/admin.json',
    trace: 'on-first-retry',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      ...(chromiumPath ? { executablePath: chromiumPath } : {}),
      args: ['--no-sandbox']
    }
  },
  projects: [{ name: 'chromium' }]
})
