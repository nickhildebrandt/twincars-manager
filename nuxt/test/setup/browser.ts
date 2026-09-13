/**
 * Setup for the browser project.
 *
 * It only pulls in `@nuxt/test-utils/browser`, but from a file of our own:
 * listed directly in `setupFiles`, Vite treats it as a dependency and
 * pre-bundles it, which hands the setup a second copy of Vitest whose runner
 * is not registered yet. The first run against a cold cache then fails with
 * "Vitest failed to find the runner". Imported from source, it resolves to the
 * same instance the runner uses.
 *
 * No filesystem access here: browser setup files run in the browser. Locale
 * and time zone come from the browser context in `vitest.config.ts`.
 */
import '@nuxt/test-utils/browser'
