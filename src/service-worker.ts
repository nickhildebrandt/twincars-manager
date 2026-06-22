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

/** Build + static assets shipped with this deploy. */
const ASSETS = [...build, ...files]

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(ASSETS)
      // Make sure the start URL is in the cache so the offline fallback
      // has something to serve.
      try {
        await cache.add(START_URL)
      } catch {
        // Fine if the server isn't reachable during install — the
        // network-first handler will populate the cache on first hit.
      }
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
