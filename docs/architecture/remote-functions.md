---
title: Server transport - remote functions only
tags: [architecture, sveltekit, transport]
updated: 2026-07-07
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
  `await requested(listXRemote, 4).refreshAll()` inside the command
  (NEVER a fixed-arg `listXRemote({...}).refresh()` for parameterized
  queries - it would refresh a different cache key than the one the
  client renders); client side
  `await mutate(...).updates(listX.withOverride(...))` for optimistic
  deletes/status flips (the standard, not pessimistic refresh).
- **List pages**: only-set-key `queryArgs` (`{}` and `{ q: undefined }`
  are different cache keys), `await untrack(() => listXRemote(queryArgs))`
  SSR seed, read via
  `$derived.by(() => listXRemote(queryArgs).current ?? lastResult)`
  (stale-while-revalidate; the table never blanks), one `$effect`
  syncing `lastResult` + errors, fresh instances in mutation handlers.
  **Never memoize a remote-query proxy**: a proxy holds its cache entry
  only for the lifetime of the effect run that created it, so a
  memoized instance from async init stays `current === undefined` and
  `refreshAll`/`withOverride` land on an unrendered entry. Reference:
  `src/routes/customers/+page.svelte`, `src/routes/orders/+page.svelte`;
  binding long form in `CONTRIBUTING.md` §5.
- **Queries in event handlers need `.run()`**: `await someQuery(args)`
  only works in reactive contexts (top-level await, `$derived`,
  `$effect`). In an event handler (button click, poll callback, picker
  search) the bare proxy throws or silently never resolves - call
  `await someQuery(args).run()` instead (usually inside `busy.run`).
  This class produced 7+ real bugs in the 2026-07 QA rounds
  (XRechnung/DATEV downloads, absences, hours pickers, import
  progress polling).
- **Detail pages**: plain top-level `await getXRemote({ id })`; no
  try/catch (the root `+error.svelte` handles thrown errors).
  Because the detail page freezes `page.params.id` at init,
  **same-route detail-to-detail links need a keyed route layout**:
  `{#key page.params.id}{@render children()}{/key}` in a
  `[id]/+layout.svelte` forces a clean remount per id (reference:
  `src/routes/invoices/[id]/+layout.svelte` for the invoice ↔ Storno
  banner links).
- **Guards first**: every query/command body starts with `requireUser()` /
  `requirePermission(...)` / `requireAnyPermission(...)` as the FIRST
  statement ([[auth-and-permissions]]). `src/routes/layout.remote.ts` is
  the deliberate exception (serves pre-login state;
  `getCurrentUserRemote` returns `null` for anonymous callers).
- **Pickers**: all entity-relation pickers live in
  `src/routes/pickers.remote.ts` (pickCustomers, pickVehicles,
  pickEmployees, pickItems, pickInventoryVehicles,
  pickSuppliers, pickDocuments, pickTires) and feed the shared
  `SearchablePicker` / `MultiSearchablePicker` components
  ([[creation-flow]] for the in-picker create affordance). Never
  `<select>` for relationships.
  (Exception: `src/routes/invoices/new/pickers.remote.ts` exists for the
  invoice form; keep new pickers centralized.)
- **PDF bytes**: only through the global `src/routes/pdfs.remote.ts`
  ([[pdf-pipeline]]); list views may call only the `...PdfMetaRemote`
  queries.

## Search coverage (list queries and pickers)

Every entity is searchable by ALL sensible attributes, always with
server-side ILIKE + pagination (never client-side filtering). Current
coverage of the `q` term:

- **customers** (list): customer number, last/first name, company,
  city, zip, street, phone, mobile, email, eBay handle. Picker:
  company, last/first name, number, city, phone, mobile, email.
- **vehicles** (list + picker): license plate (via
  `vehicle_license_plate_versions`), VIN, make, model, HSN, TSN, plus
  the holder's name/company.
- **employees** (list): first/last name, personnel number, position,
  department, private email/phone, mobile (picker: same minus
  department).
- **suppliers** (list): name, city, contact person, email, phone
  (picker: same minus phone).
- **tires** (list + picker): article number, brand, model, EAN; a
  size-shaped query ("205/55R16") additionally matches the parsed size
  components exactly.

Performance note: the infix `%term%` ILIKE on the newly added fields
has **no trigram indexes** yet (the only GIN index is the jsonb one on
`items.attributes`). That is acceptable at current scale (about 10k
customers from the legacy import); revisit with `pg_trgm` GIN indexes
if the dataset grows.

## `src/hooks.ts` (universal)

Intentionally just `export const transport = {}` - required by the
remote-functions client codegen. Do not add logic there.

## JSDoc convention

Every remote export carries `@group integration` and `@module <name>`.

Related: [[validation-and-errors]], [[loading-and-busy]],
[[adr-003-pagination-fixed-25]].
