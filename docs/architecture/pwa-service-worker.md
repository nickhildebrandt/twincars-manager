---
title: PWA and service worker
tags: [architecture, pwa, service-worker]
updated: 2026-07-05
---

# PWA / service worker

Goal: install-ability ("Zum Startbildschirm hinzufügen") + instant shell
loads. Offline data is explicitly out of scope - the app is server-driven
via remote functions, so there is nothing useful to serve offline.

## Pieces

- `static/manifest.webmanifest` - name "TwinCars Manager", `display:
standalone`, `lang: de`, theme `#1d4ed8`, icons 192/256/384/512 +
  maskable under `static/icons/`.
- `src/service-worker.ts` (+ co-located test) - cache
  `twincars-cache-<version>` (content-hash version from
  `$service-worker` = free cache busting per deploy):
  - Pre-caches `build` + `files` on install (defensive filter drops any
    stray `/.svelte-kit/` or `/node_modules/` entries that would 404 and
    poison the install).
  - Network-first for everything else; on network failure falls back to
    the cached start URL `/` HTML.
  - Prunes old cache versions on activate.

## Registration policy (important dev gotcha)

`svelte.config.js` sets `kit.serviceWorker.register: false`. The layout
registers the worker **in production only** and actively **unregisters**
stale workers in dev: Vite's ephemeral module URLs (`/@fs/...`, dep
hashes) made dev-registered workers from a previous session fail with
"script evaluation" errors on the next visit (fixed in commit
`eb77848`). If a dev browser behaves strangely, check
DevTools > Application > Service Workers for leftovers.

Related: [[known-constraints]], [[deployment]].
