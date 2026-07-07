---
title: Operations - E2E smoke test (scripts/e2e-smoke.mjs)
tags: [operations, testing, e2e, playwright]
updated: 2026-07-07
---

# E2E smoke test - `scripts/e2e-smoke.mjs`

The **standing end-to-end entry point**, born in the 2026-07 QA rounds.
Drives a real headless browser against a running server build and
exercises the core business flows. Playwright is deliberately **not** a
repo dependency ([[dev-environment]], CONTRIBUTING §13) - the script
resolves `playwright-core` at runtime.

## What it covers (steps, in order)

1. **Login** - username/password, German error on a wrong password.
2. **Customer CRUD** - create with click-time validation, edit, the
   full archive round trip (archive -> Archiv tab -> reactivate),
   delete.
3. **Customer search** - list search by name.
4. **Creation-flow round trip** - vehicle form -> "Neuen Kunden
   anlegen" -> full-page customer creation -> back with
   auto-selection ([[creation-flow]]).
5. **Vehicle search by plate** - list search, detail view.
6. **Ankauf -> Verkauf cycle** - customer vehicle -> Verkaufsbestand ->
   sale invoice -> als bezahlt -> vehicle at the buyer, Vorbesitzer
   intact ([[inventory]], [[vehicles]]).
7. **Import page** - upload card renders, no-file click message.
8. **Order lifecycle** - create with customer, Kanban arrow move with
   an instant-render assert, material position, completion -> invoice,
   read-only order afterwards ([[orders]]).
9. **Calendar Termin -> Auftrag** - appointment (incl. a possible
   Terminkollision confirm); the order is created ONCE, a second visit
   links to it; both deleted again ([[calendar]]).
10. **Offer -> invoice conversion** - convert page, converted banner
    ([[offers]]).

Exits non-zero on the first failed step. Runtime is well under two
minutes against a local server. Created rows are prefixed "Smoke" plus
a per-run tag; the plain-CRUD customer is deleted again, the
sale-cycle rows (vehicle, invoice) intentionally remain as regular
business data.

## Prerequisites

- A running server, e.g.
  `pnpm build && ORIGIN=http://localhost:4173 PORT=4173 node build`.
- A completed setup with an admin account matching the env defaults.
- `playwright-core` resolvable (globally installed, or point
  `PLAYWRIGHT_CORE_PATH` at a checkout/npx cache) and a Chromium
  binary (`CHROMIUM_PATH`, falls back to playwright-core's own
  resolution). See [[dev-environment]] for the cache paths that work
  in this dev environment.

## Environment (all optional, defaults in parentheses)

| Variable               | Default                   |
| ---------------------- | ------------------------- |
| `BASE_URL`             | `http://localhost:4173`   |
| `E2E_USERNAME`         | `e2eadmin`                |
| `E2E_PASSWORD`         | `e2e-passwort-123`        |
| `PLAYWRIGHT_CORE_PATH` | module resolution         |
| `CHROMIUM_PATH`        | playwright-core's browser |

## Usage

```
node scripts/e2e-smoke.mjs
```

Related: [[dev-environment]], [[known-constraints]] (dev-only hydration
recovery when asserting right after navigation).
