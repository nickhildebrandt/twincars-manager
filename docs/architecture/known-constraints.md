---
title: Known constraints and gotchas
tags: [architecture, constraints, pinning, gotchas]
updated: 2026-07-05
---

# Known constraints and gotchas

## Pinned versions and why

- `@sveltejs/kit` 2.58.0, `svelte` 5.55.5, `@testing-library/svelte`
  5.3.1 are pinned **exact** (no caret) in `package.json`: the
  remote-functions and runes APIs are experimental and change behavior
  between minors. Bump deliberately, then run
  `pnpm check && pnpm test && pnpm build`. See [[adr-012-pnpm-and-exact-pins]].
- pnpm itself is pinned via `packageManager: pnpm@11.8.0` (corepack).
  Never `npm install` (would regenerate a package-lock.json).
- `pnpm-workspace.yaml` carries the esbuild build-script approval
  (`allowBuilds`).
- Node >= 22 required; runtime image `node:lts-slim`.
- Postgres pinned to major 18 in production (minor updates via image
  pull; major upgrades are manual).

## Dev-only hydration issue on async pages

Pages using top-level `await` (all detail/list pages) fail hydration in
the **Vite dev server** app-wide: `Failed to hydrate:
HierarchyRequestError`, after which Svelte recovers by client
re-rendering. The **production build hydrates cleanly** - this is a
dev-server-only artifact of the experimental async SSR. Consequences:

- Do not chase dev hydration warnings on async pages as app bugs.
- Code that must survive the recovery re-render (e.g. the eBay OAuth
  flag handling on `/settings/ebay`) reads one-shot URL flags in a
  deferred `onMount` + `window.location` (never `page.url` at mount, no
  mount-time `goto`), so the recovery cannot double-fire it.

## OpenTelemetry no-op shim

better-auth >= 1.6 wraps every dispatch in `withSpan`; Rollup CJS interop
can bundle `@opentelemetry/api` into a default-only namespace (named
`trace` export undefined) which 500s EVERY request in the production
container. `vite.config.ts` aliases `@opentelemetry/api` to
`src/lib/server/otel-noop.ts`. Do not remove. [[adr-018-otel-noop-shim]]

## Docker build quirks

- `pnpm prune --prod --ignore-scripts` is required: without
  `--ignore-scripts`, prune re-runs the root `prepare` (svelte-kit sync /
  husky) after devDeps are gone and fails the build.
- `BODY_SIZE_LIMIT=64M` in the runtime image so the base64 `.mdb` upload
  (~25 MB) clears adapter-node's 512 KB default.
- `mdbtools` is apt-installed in the runtime image for the import.

## Other gotchas

- `src/hooks.ts` must stay an empty `transport = {}` map.
- Do not set `NODE_ENV` in `.env` - it silently turns `pnpm build` into a
  dev-flagged bundle.
- Migrations: snapshots under `drizzle/meta/` are hand-maintained /
  frozen at 0007 in this repo - the runtime migrator uses journal + SQL
  only; never edit applied migrations.
- The dev Playwright MCP is broken in this environment (Chrome channel);
  use headless playwright-core instead - see [[dev-environment]].
- No in-process scheduler ([[adr-009-no-in-process-scheduler]]):
  recurring jobs are operator-triggered buttons designed to be
  cron-callable later.

Related: [[deployment]], [[dev-environment]], [[pwa-service-worker]].
