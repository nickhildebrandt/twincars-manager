import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { resolveChromium } from './test/setup/chromium.ts'

// Golden flows only (04-ux.md §9). Everything smaller belongs in one of the
// Vitest projects. Waiting happens on hydration, never on a fixed timeout.
export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 90_000,
  expect: { timeout: 10_000 },

  use: {
    nuxt: { rootDir: fileURLToPath(new URL('.', import.meta.url)) },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Browsers are never downloaded; the newest cached build is used.
        launchOptions: { executablePath: resolveChromium() },
      },
    },
  ],
})
