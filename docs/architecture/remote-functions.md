---
title: Server transport - remote functions only
tags: [architecture, sveltekit, transport]
updated: 2026-07-05
---

# Remote functions - the only server transport

`svelte.config.js` enables `kit.experimental.remoteFunctions = true` and
`compilerOptions.experimental.async = true`. Every app-internal server
interaction goes through `*.remote.ts` files using `query(schema, fn)` /
`command(schema, fn)` from `$app/server`. Rationale in
[[adr-001-remote-functions-only]].

## Forbidden

`+page.server.ts`, `+layout.server.ts`, `+server.ts` (outside the
exceptions below), form `actions`, `use:enhance`, custom `fetch` to
internal endpoints.

## The 4 documented `+server.ts` exceptions

All are "third-party plumbing or external consumer", never convenience:

1. `src/routes/api/auth/[...all]/+server.ts` - better-auth catch-all
   (session cookies, CSRF; cannot be a remote function).
2. `src/routes/api/public/*` - the Bearer-token REST API for the external
   website ([[public-rest-api]]). Each endpoint splits its testable
   handler into `endpoint.ts` next to the `+server.ts`.
3. `src/routes/api/ebay/account-deletion/+server.ts` - eBay marketplace
   account-deletion compliance endpoint; eBay's servers call it directly
   with a challenge handshake ([[ebay]]). Whitelisted in
   `hooks.server.ts` PUBLIC_PREFIXES (narrow: only this path).
4. `src/routes/api/ebay/oauth/callback/+server.ts` - eBay OAuth
   "Auth Accepted URL". Deliberately session-gated (NOT whitelisted);
   CSRF via HMAC-signed `state` with 10-minute TTL.

## Patterns

- **SSR**: pages call remote queries with top-level `await`; SvelteKit
  suspends and flushes complete HTML. After hydration the app is a SPA
  with a dehydrated query cache.
- **Single-flight mutations**: server side
  `await requested(listXRemote, 4).refreshAll()` inside the command;
  client side `await mutate(...).updates(listX.withOverride(...))` for
  optimistic deletes/status flips (the standard, not pessimistic refresh).
- **List pages**: `untrack(() => query)` SSR seed + `lastResult` fallback
  (stale-while-revalidate; the table never blanks). See `CONTRIBUTING.md` §5.
- **Detail pages**: plain top-level `await getXRemote({ id })`; no
  try/catch (the root `+error.svelte` handles thrown errors).
- **Guards first**: every query/command body starts with `requireUser()` /
  `requirePermission(...)` / `requireAnyPermission(...)` as the FIRST
  statement ([[auth-and-permissions]]). `src/routes/layout.remote.ts` is
  the deliberate exception (serves pre-login state;
  `getCurrentUserRemote` returns `null` for anonymous callers).
- **Pickers**: all entity-relation pickers live in
  `src/routes/pickers.remote.ts` (pickCustomers, pickVehicles,
  pickEmployees, pickItems, pickInventoryVehicles,
  pickSuppliers, pickDocuments, pickTires) and feed the shared
  `SearchablePicker` component. Never `<select>` for relationships.
  (Exception: `src/routes/invoices/new/pickers.remote.ts` exists for the
  invoice form; keep new pickers centralized.)
- **PDF bytes**: only through the global `src/routes/pdfs.remote.ts`
  ([[pdf-pipeline]]); list views may call only the `...PdfMetaRemote`
  queries.

## `src/hooks.ts` (universal)

Intentionally just `export const transport = {}` - required by the
remote-functions client codegen. Do not add logic there.

## JSDoc convention

Every remote export carries `@group integration` and `@module <name>`.

Related: [[validation-and-errors]], [[loading-and-busy]],
[[adr-003-pagination-fixed-25]].
