# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TwinCarsManager — SvelteKit web app for a small German Kfz/used-car business; successor to a legacy Access "Kfz-Kaufmann" database. UI strings are German; code/comments/identifiers/commits are English.

The repo lives in `/home/nick/tc/twincars-manager` (the parent `/home/nick/tc` holds screenshots and the legacy `.mdb` import sample under `Daten/`).

## Authoritative documents

`README.md` and especially **`CONTRIBUTING.md`** are binding. `CONTRIBUTING.md` is the technical rulebook — read it before making non-trivial changes. If in-tree code conflicts with `CONTRIBUTING.md`, the guideline wins, fix the code.

## Common commands

```bash
npm run dev            # Vite dev server on http://localhost:5173
npm run build          # Production build via @sveltejs/adapter-node into ./build
npm run preview        # Run the built server (node build)
npm run check          # svelte-kit sync && svelte-check — must report 0 errors / 0 warnings
npm test               # Vitest, single run
npm run test:watch     # Vitest watch
npm run test:cov       # Vitest with v8 coverage
npm run format         # Prettier write across the repo
npm run db:generate    # drizzle-kit generate (after schema change)
npm run db:migrate     # apply pending migrations
npm run db:push        # dev-only schema push, no migration file
npm run db:studio      # open Drizzle Studio
```

Run a single test file: `npx vitest run path/to/file.test.ts`. Co-located: every `<file>.test.ts` lives next to its source.

Migrations also run automatically at server startup via `src/hooks.server.ts → runMigrations()`, followed by `seedDefaults()` (idempotent).

## Environment

- Node ≥ 22, PostgreSQL ≥ 14. Optional `mdbtools` for the legacy MDB import.
- `.env` (gitignored) needs `DATABASE_URL` and `APP_ENCRYPTION_KEY` (used for AES-GCM of the SMTP password). Template in `.env.example`.

## Architecture — non-obvious essentials

### Server transport: remote functions only

`kit.experimental.remoteFunctions = true` and `compilerOptions.experimental.async = true` are on. Every server interaction goes through `*.remote.ts` files with `query(schema, fn)` / `command(schema, fn)` from `$app/server`.

- **Forbidden:** `+page.server.ts`, `+layout.server.ts`, `+server.ts`, form `actions`, `use:enhance`, custom `fetch` to internal endpoints. Pages use top-level `await` of remote queries; SvelteKit suspends and SSRs.
- Mutations use single-flight: `requested(listX, N).refreshAll()` on the server and `await mutate(...).updates(listX.withOverride(...))` on the client. Optimistic deletes/status-flips are the standard, not pessimistic refresh.
- Pickers (entity-relation selection) live exclusively in `src/routes/pickers.remote.ts`. Never `<select>` for relationships, never client-side filtering of "the many" — always `SearchablePicker` + a `pickXRemote` query.

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

### Adding a new module

Copy **customers** and **vehicles** as templates — they are the only end-to-end implemented modules and are the canonical reference. Stub modules elsewhere render a `ComingSoon` block with a feature list.

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

Per project memory and §13 of `CONTRIBUTING.md`: in addition to `npm test` and `npx svelte-check`, frontend changes must be exercised live — start `npm run dev` and walk the affected flows with the Playwright MCP (flow correctness, validation behavior, response times, visual cleanliness). **Do not add Playwright as a project dependency** — it's the agent's tool, not a repo dep.

## Code style

- TypeScript only (`.ts` / `.svelte`). Svelte 5 + Runes is binding — no `export let`, no `$:`, no `on:event` directives.
- All code, comments, JSDoc, identifiers, commit messages in **English**. UI strings in **German**.
- Prettier config: no semicolons, single quotes, no trailing comma, 2-space, LF, printWidth 80. Husky + lint-staged formats on commit; never `--no-verify`.
- Never commit `.env`, DB dumps, or `.mdb` files.
