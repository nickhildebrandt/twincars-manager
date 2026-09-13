import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { playwright } from '@vitest/browser-playwright'
import { resolveChromium } from './test/setup/chromium.ts'

// Test layout and rules: ../docs/rewrite/05-teststrategie.md
//
// `coverage`, `reporters` and `globalSetup` are ROOT-only options. Setting them
// inside a project silently does nothing.
export default defineConfig({
  test: {
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['app/**', 'server/**', 'shared/**'],
      extension: ['.ts', '.vue'],
      exclude: [
        // Generated, configuration, or executed-but-not-meaningfully-covered.
        '**/*.d.ts',
        '**/types/**',
        'server/database/migrations/**',
        'app/app.config.ts',
        '**/*.config.ts',
        // Root component: mounted by the framework, not by tests. Its
        // behaviour is covered end-to-end (test/e2e/ssr.test.ts).
        'app/app.vue',
        // Nitro plugins run inside the server runtime; they are exercised by
        // the production build in the end-to-end project, where V8 coverage
        // does not reach. Their logic is unit-tested through the helpers they
        // call (server/utils/errors.ts, shared/schemas/env.ts).
        // Stylesheets are not code; V8 reports them because the Nuxt project
        // loads them.
        'app/assets/css/**',
        'server/plugins/**',
        // Browser wiring: event listeners, a timer, a storage key and a
        // channel. The judgement it wires up is `shared/idle.ts`, covered to
        // the line; the cross-tab mechanism itself is exercised in a real
        // Chromium by test/browser/idle-logout.test.ts. What is left here is
        // the glue, and V8 cannot reach it outside a running browser.
        'app/plugins/idle-logout.client.ts',
        // Endpoint wiring without logic: it hands `useDatabase()` to
        // `checkHealth` and turns a failure into a 503. The check itself is
        // covered in test/integration/health.test.ts, the wiring by the
        // end-to-end suite against the built server.
        'server/api/health.get.ts',
        // Stylesheets are not code; V8 reports them because the Nuxt project
        // loads them.
        'app/assets/css/**',
        // Pure re-export barrel.
        'shared/schemas/index.ts',
        // Endpoint wiring without logic: it hands `useDatabase()` to
        // `checkHealth` and turns a failure into a 503. The check itself is
        // covered in test/integration/health.test.ts, the wiring by the
        // end-to-end suite against the built server.
        'server/api/health.get.ts',
        // Declarative table definitions, not logic. Their correctness is
        // proven against a real database by test/integration/schema-drift,
        // which compares every table, column and constraint.
        'server/database/schema/**',
      ],
      // Thresholds may only ever RISE. `pnpm test:cov:update` writes the
      // reached values back into this file; the change is committed with the
      // work package. In CI the flag is off, so the committed values decide.
      thresholds: {
        'autoUpdate': process.env.COV_UPDATE === '1',
        // Ratcheted from T-007 onwards. Until then the code base was only
        // schemas and helpers, which cover far more easily than an interface;
        // holding it to those numbers would have been meaningless. It now has
        // endpoints, middleware, pages and composables, so the mix is
        // representative and `pnpm test:cov:update` writes the reached values
        // back here with every package.
        'statements': 97.44,
        'branches': 90.16,
        'functions': 98.72,
        'lines': 98.8,
        // Geldarithmetik: jede Zeile gerechnet, jeder Rundungsfall belegt.
        // Ein blinder Fleck hier kostet Cent in echten Rechnungen.
        'shared/money.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'shared/schemas/**': {
          statements: 100,
          branches: 95.74,
          functions: 100,
          lines: 100,
        },
        'server/services/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'server/api/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'app/composables/**': {
          statements: 97.77,
          branches: 86.53,
          functions: 98.07,
          lines: 100,
        },
      },
    },

    projects: [
      {
        // Pure functions, schemas, calculations. No Nuxt, no DOM.
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'test/unit/**/*.test.ts',
            'app/**/*.test.ts',
            'server/**/*.test.ts',
            'shared/**/*.test.ts',
          ],
          setupFiles: ['test/setup/env.ts'],
        },
      },

      await defineVitestProject({
        // Components and composables inside the Nuxt runtime.
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
              mock: { intersectionObserver: true, indexedDb: true },
            },
          },
          setupFiles: ['test/setup/env.ts'],
        },
      }),

      {
        // Endpoints against a real PostgreSQL database, one per worker.
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.test.ts'],
          setupFiles: ['test/setup/env.ts', 'test/setup/db-per-worker.ts'],
          testTimeout: 30_000,
        },
      },

      await defineVitestProject({
        // Focus traps, keyboard handling, overlays, reduced motion.
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          // No env setup file here: browser setup files run IN the browser
          // and cannot read the filesystem. Locale and timezone come from the
          // browser context instead.
          setupFiles: ['test/setup/browser.ts'],
          browser: {
            enabled: true,
            headless: true,
            // Browsers are never downloaded; the cached build is used.
            provider: playwright({
              launchOptions: { executablePath: resolveChromium() },
              contextOptions: { locale: 'de-DE', timezoneId: 'Europe/Berlin' },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      }),

      {
        // Golden flows driven through @nuxt/test-utils/e2e.
        // Never import @nuxt/test-utils/runtime in these files.
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/e2e/**/*.test.ts'],
          setupFiles: ['test/setup/env.ts', 'test/setup/e2e-db.ts'],
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },

  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
