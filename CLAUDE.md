# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TwinCarsManager — SvelteKit web app for a small German Kfz/used-car business; successor to a legacy Access "Kfz-Kaufmann" database. UI strings are German; code/comments/identifiers/commits are English.

The repo lives in `/home/nick/tc/twincars-manager` (the parent `/home/nick/tc` holds screenshots and the legacy `.mdb` import sample under `Daten/`).

## Authoritative documents

`README.md` and especially **`CONTRIBUTING.md`** are binding. `CONTRIBUTING.md` is the technical rulebook — read it before making non-trivial changes. If in-tree code conflicts with `CONTRIBUTING.md`, the guideline wins, fix the code.

## Common commands

```bash
pnpm dev            # Vite dev server on http://localhost:5173
pnpm build          # Production build via @sveltejs/adapter-node into ./build
pnpm preview        # Run the built server (node build)
pnpm check          # svelte-kit sync && svelte-check — must report 0 errors / 0 warnings
pnpm test               # Vitest, single run
pnpm test:watch     # Vitest watch
pnpm test:cov       # Vitest with v8 coverage
pnpm format         # Prettier write across the repo
pnpm db:generate    # drizzle-kit generate (after schema change)
pnpm db:migrate     # apply pending migrations
pnpm db:push        # dev-only schema push, no migration file
pnpm db:studio      # open Drizzle Studio
```

Run a single test file: `pnpm exec vitest run path/to/file.test.ts` (a substring also works, e.g. `pnpm exec vitest run client-error`). Co-located: every `<file>.test.ts` lives next to its source. Tests run against `pg-mem`, so no live Postgres is required.

Migrations do **not** run inside the request lifecycle. In production they run once via `scripts/migrate.js` before `node build` boots (see `Dockerfile` CMD); in dev use `pnpm db:migrate` or `pnpm db:push`. What `src/hooks.server.ts` _does_ run on the first request is `seedDefaults()` (idempotent — mail templates, ledger categories, number ranges); after the first hit it's a no-op. There is **no** in-process scheduler — recurring work (e.g. `autoSendDuePaymentReminders` in `reminder-service.ts`) is operator-triggered from the UI ("Jetzt prüfen"), designed so a future external cron can call the same path. `hooks.server.ts` also brute-force-throttles `POST /api/auth/sign-in/*` per client IP (`rate-limit.ts`, 10/min) and gates every non-public route behind an authenticated session.

`src/hooks.ts` (universal) is intentionally an empty `transport = {}` map — it exists only to satisfy remote-functions client codegen. Do not add logic there.

## Environment

- Node ≥ 22, PostgreSQL ≥ 14. Optional `mdbtools` for the legacy MDB import (the runtime container is `node:lts-slim` and installs it via `apt-get`, and bumps `BODY_SIZE_LIMIT=64M` so the base64-encoded `.mdb` upload, ~25 MB, doesn't hit adapter-node's 512 KB default).
- `.env` (gitignored) needs `DATABASE_URL` and `APP_SECRET` (HMAC secret for better-auth cookie signing — not data encryption). Template in `.env.example`.
- Local SMTP development: `node scripts/dev-mail-catcher.js` listens on `127.0.0.1:1025` and writes every captured message as a timestamped `.eml` under `tmp/mail/`. Point `smtp_settings` at it (`host=127.0.0.1 port=1025 secure=none`) to exercise mail flows without a real server.

## Architecture — non-obvious essentials

### Server transport: remote functions only

`kit.experimental.remoteFunctions = true` and `compilerOptions.experimental.async = true` are on. Every server interaction goes through `*.remote.ts` files with `query(schema, fn)` / `command(schema, fn)` from `$app/server`.

- **Forbidden:** `+page.server.ts`, `+layout.server.ts`, `+server.ts`, form `actions`, `use:enhance`, custom `fetch` to internal endpoints. Pages use top-level `await` of remote queries; SvelteKit suspends and SSRs.
- **Four documented exceptions:** (1) `src/routes/api/auth/[...all]/+server.ts` is the better-auth catch-all — library plumbing for session cookies / CSRF that cannot be expressed as a remote function. (2) `src/routes/api/public/*` is the external read/write REST API (used-cars, services, tires, appointments, free-slots, orders, contact, company, shipping-options, posts), Bearer-token authenticated for third-party consumers. (3) `src/routes/api/ebay/account-deletion/+server.ts` is the eBay marketplace-account-deletion compliance endpoint — eBay's servers call it directly (challenge handshake + notifications), unauthenticated, whitelisted in `hooks.server.ts`, configured via `EBAY_VERIFICATION_TOKEN`. (4) `src/routes/api/ebay/oauth/callback/+server.ts` is the eBay OAuth redirect target (RuName "Auth Accepted URL") — browser round-trip plumbing, session-gated (NOT whitelisted), CSRF-protected via HMAC-signed `state`. Each endpoint splits the testable handler into `endpoint.ts` next to its `+server.ts`. App-internal data flow still uses remote functions exclusively; new exceptions need the same justification ("third-party plumbing or external consumer", not "convenience").
- Mutations use single-flight: `requested(listX, N).refreshAll()` on the server and `await mutate(...).updates(listX.withOverride(...))` on the client. Optimistic deletes/status-flips are the standard, not pessimistic refresh.
- Pickers (entity-relation selection) live exclusively in `src/routes/pickers.remote.ts`. Never `<select>` for relationships, never client-side filtering of "the many" — always `SearchablePicker` + a `pickXRemote` query.

### Auth & authorization

- **Identity:** `better-auth` with the `username` plugin — username + password only. Email signup is disabled; the admin creates accounts manually from `/settings/users`. The synthesized `<username>@twincars.local` address never leaves the server. The very first admin is created in the last step of `/setup`.
- **Session:** `event.locals.{session, user, permissions}` is populated for every request by `hooks.server.ts`. Unauthenticated visitors to non-public routes are redirected to `/login` (whitelist: `/login`, `/api/auth`, `/api/public`, `/setup`).
- **Authorization:** `src/lib/server/auth-permissions.ts` defines `MODULE_PERMISSIONS` (canonical permission keys: `customers:read|write|delete`, `hours:write_own`, …) and the wildcard `*`. `src/lib/server/auth-guards.ts` exports `requireUser()`, `requirePermission(key)`, `requireAnyPermission(...keys)`. **Every** `query`/`command` body in a `*.remote.ts` starts with one of these guards as the FIRST statement, before any DB access. `layout.remote.ts` is the deliberate exception (it serves both pre-login and post-login state); `getCurrentUserRemote` there returns `null` for anonymous callers.
- **Navigation filtering:** sidebar items carry an optional `permission` key in `src/lib/components/layout/navigation.ts`; `filterNavigationByPermissions(...)` drops items + empty groups. The fallback for a user without any matching permissions is the bare "Start" item alone.
- **Roles:** seeded by `seedDefaults` — `Administrator` (`*`), `Werkstattleiter` (everything except `settings|users`), `Mitarbeiter` (broad reads + `hours:write_own`). The `Administrator` role is undeletable; the last user holding `*` is undeletable.
- **Public REST API tokens:** `/api/public/*` is authenticated by Bearer tokens read from the `API_TOKENS` env var — comma-separated (newline / semicolon also work), each entry ≥ 8 chars, ideally a cryptographically random ≥ 16-char secret. Tokens are valid from server start; rotation is a config change + restart, no admin UI, no DB table. Empty / unset value fails closed (every request rejected). The implementation in `src/lib/server/api-tokens.ts` uses `timingSafeEqual` and exposes only the first 8 chars to downstream code (rate-limit bucket key + audit prefix). When working on public-API tests, stub the env with `vi.stubEnv('API_TOKENS', '<token>')` in `beforeAll` and `vi.unstubAllEnvs()` in `afterAll`.

### Loading: one global `busy` store, three signals

`src/lib/stores/busy.svelte.ts` is the single source of truth. `busy.active` drives a thin progress bar in the `AppShell` header (the **only** loading bar in the entire app — no second one anywhere). `busy.slow` (≥ 250 ms) drives a full-area overlay over the main slot. Inline submit buttons read `busy.active` directly to disable on click. Wrap mutations in `await busy.run(() => …)`. Never introduce a local `let busy = $state(false)`.

List pages keep `lastResult` as a fallback so filter/pagination changes don't blank the table (stale-while-revalidate).

### Pagination is fixed at 25, server-side

No page-size selector anywhere. List remote returns `{ items, total, page, size, pageCount }`. Filter/search changes **must reset `pageNum = 1`**. Use the shared `Pagination` component (`src/lib/components/ui/Pagination.svelte`).

### Validation & errors

- Valibot validates every remote function arg. Reusable schemas in `src/lib/server/db/validation.ts` (`emailSchema`, `ibanSchema`, `moneySchema`, `dateStringSchema`, …) — reach for these first. Every pipe step needs a **German** message.
- Server-side: `handleValidationError` and `handleError` in `src/hooks.server.ts` produce the only message the user ever sees. Use `error(status, 'german message')` from `@sveltejs/kit` for curated 4xx.
- Client-side: every page/form `catch` goes through `handleClientError(err, baseMessage?)` from `src/lib/utils/client-error.ts`. Toasts surface only curated German; raw errors are logged to console only. Root `+error.svelte` handles thrown route errors.

### Styling: DaisyUI v5 + Tailwind v4, no custom CSS

Single `corporate` theme. Card baseline is `<div class="card border border-base-300 bg-base-100"><div class="card-body">…</div></div>` — no shadows, no dashed borders, no zebra striping, no custom rounding, no custom keyframes. `<style>` blocks in `.svelte` files and additions to `app.css` (beyond Tailwind/DaisyUI directives + the one `scrollbar-gutter` rule) are forbidden. Confirm class names via the **DaisyUI Blueprint MCP** before writing markup. Icons from `@lucide/svelte` only.

Shell rhythm: `p-4` on the main column (`pb-12` at the bottom), `px-4` on the header, `gap-4` on top-level grids — single 1rem rhythm.

### Tables / detail pattern

Tables show only the most useful columns; detail views show everything. Every row is fully clickable (`hover:bg-base-200 cursor-pointer` + `goto(...)` on the `<tr>`). Action cells use `<td onclick={(e) => e.stopPropagation()}>`. Totals/summary rows live in `<tfoot>`.

### PDFs

PDF generation/caching lives in `src/lib/server/services/pdf-service.ts` (built on `pdf-lib`) and is exposed through a **single global** `src/routes/pdfs.remote.ts` (not per-module). List views may only call the `getXPdfMetaRemote` queries — the bytes never travel through metadata calls. Viewing in the browser uses `pdfjs-dist` through `PdfViewer.svelte`.

### Adding a new module

All modules are now end-to-end implemented (customers, vehicles, inventory, suppliers, employees, items, offers, invoices, reminders, sent, ledger, sales-ledger, calendar, mailings, import, settings, plus time tracking under `hours`, tire catalog/reminders under `tires`, `tire-storage`, and `posts` (Aktuelle Informationen / news, with a paginated public API)) — there are no remaining `ComingSoon` stubs. Note the **payroll** and **special-payments** modules were removed: payroll was replaced by time tracking (`time-entry-service.ts`, `workshop-hours-service.ts`, route `/hours`). **customers** and **vehicles** remain the canonical templates — they're the cleanest illustration of the list / detail / form + form-component + co-located test pattern.

1. `src/lib/server/services/<x>-service.ts` — pure typed Drizzle calls.
2. `src/routes/<x>/<x>.remote.ts` — `listXRemote`, `getXRemote`, mutations; mutations refresh via `requested(listXRemote, 4).refreshAll()`.
3. `src/routes/<x>/+page.svelte` — list with `untrack(() => query)` snapshot + `lastResult` fallback.
4. `src/routes/<x>/[id]/+page.svelte` — top-level await detail page (no try/catch; let `+error.svelte` catch).
5. `src/routes/<x>/[id]/edit/` and `src/routes/<x>/new/` — form pages calling `busy.run(...)` inside `handleSave`.
6. If the form references another entity, add a `pickXRemote` to `pickers.remote.ts` and use `SearchablePicker`.
7. Co-located tests for service logic, schemas, form component.

### Setup gate

Until `company_settings.setupCompleted = true`, every route redirects to `/setup` (6-step wizard). Setup completion seeds default mail templates, ledger categories, and number ranges.

## Verification before declaring done

Per project memory and §13 of `CONTRIBUTING.md`: in addition to `pnpm test` and `pnpm exec svelte-check`, frontend changes must be exercised live — start `pnpm dev` and walk the affected flows with the Playwright MCP (flow correctness, validation behavior, response times, visual cleanliness). **Do not add Playwright as a project dependency** — it's the agent's tool, not a repo dep.

## Code style

- TypeScript only (`.ts` / `.svelte`). Svelte 5 + Runes is binding — no `export let`, no `$:`, no `on:event` directives.
- All code, comments, JSDoc, identifiers, commit messages in **English**. UI strings in **German**.
- Prettier config: no semicolons, single quotes, no trailing comma, 2-space, LF, printWidth 80. Husky + lint-staged formats on commit; never `--no-verify`.
- Never commit `.env`, DB dumps, or `.mdb` files.
