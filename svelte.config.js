import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true, experimental: { async: true } },
  kit: {
    adapter: adapter(),
    experimental: { remoteFunctions: true },
    serviceWorker: {
      // No automatic registration: the layout registers the worker in
      // PRODUCTION only and actively unregisters stale ones in dev —
      // vite's module URLs (/@fs/…, dep hashes) are ephemeral, so a
      // dev-registered worker from a previous session throws
      // "script evaluation" errors on the next visit.
      register: false
    }
  }
}

export default config
