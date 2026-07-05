/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * SvelteKit service worker — pure install-ability for the PWA.
 *
 * Offline caching of API data is explicitly out of scope: the app is
 * server-driven (remote functions only) and there is nothing useful we
 * could serve while the network is gone. What we DO want is:
 *
 *   - The browser sees a registered service worker → install banner
 *     ("Zum Startbildschirm hinzufügen") becomes available.
 *   - Static build artefacts (JS chunks, CSS, fonts, manifest icons)
 *     are pre-cached on install so the shell loads instantly on
 *     repeat visits.
 *   - A network-first strategy for everything else so live data is
 *     always fresh; only if the network fails do we fall back to the
 *     cached `start_url` (`/`) HTML so the user lands on something
 *     other than a chrome error page.
 *   - Old cache versions are pruned on activate.
 *
 * The cache key is rebuilt on every deploy because `version` from
 * `$service-worker` is content-hash based; that effectively gives us
 * cache-busting for free.
 */

import { build, files, version } from '$service-worker'

const sw = self as unknown as ServiceWorkerGlobalScope

const CACHE = `twincars-cache-${version}`
const START_URL = '/'

/**
 * Build + static assets shipped with this deploy. Defensive filter:
 * anything that accidentally lands in `static/` from tooling (a stray
 * `.svelte-kit/` sync output, a vitest cache under `node_modules/`)
 * must never end up in the pre-cache list — a single 404 there would
 * otherwise poison the install.
 */
const ASSETS = [
  ...build,
  ...files.filter(
    (f) => !f.startsWith('/.svelte-kit/') && !f.startsWith('/node_modules/')
  )
]

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Per-asset add instead of cache.addAll: addAll is all-or-nothing
      // and a single unreachable asset would fail the whole install.
      // Pre-caching is an optimisation — the network-first handler
      // backfills anything missed here.
      await Promise.all(
        [...ASSETS, START_URL].map((asset) =>
          cache.add(asset).catch(() => {
            // Skip unreachable assets; never block installation.
          })
        )
      )
      await sw.skipWaiting()
    })()
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
      await sw.clients.claim()
    })()
  )
})

sw.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GETs; anything else (POST mutations,
  // cross-origin assets) goes straight to the network.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== sw.location.origin) return

  event.respondWith(networkFirst(request))
})

/**
 * Network-first: try the network, fall back to whatever we have in
 * the cache, and for navigation requests fall back to the cached
 * start URL so the app shell still appears when offline.
 */
async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE)

  try {
    const response = await fetch(request)
    // Only cache successful, basic (same-origin) responses.
    if (response.ok && response.type === 'basic') {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const fallback = await cache.match(START_URL)
      if (fallback) return fallback
    }
    throw err
  }
}
