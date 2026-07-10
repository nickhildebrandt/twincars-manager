---
title: Operations - reproducible test database & Playwright E2E suite
tags: [operations, testing, e2e, database, playwright]
updated: 2026-07-10
---

# Test database & Playwright E2E suite

The repo carries a **real Playwright test suite** (`e2e/`, run with
`pnpm test:e2e`) plus a **reproducible test database**: a committed,
fully anonymized fixture (`e2e/fixtures/seed.sql.gz`) and two scripts
that restore / regenerate it. The older `scripts/e2e-smoke.mjs` stays
as a quick standalone check ([[e2e-smoke]]) but is no longer the E2E
story.

## The pieces

| Piece                            | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `e2e/fixtures/seed.sql.gz`       | committed full `pg_dump` (schema + data) of the seeded baseline     |
| `scripts/seed-test-db.mjs`       | reset DATABASE_URL to that baseline (idempotent, seconds)           |
| `scripts/generate-test-seed.mjs` | regenerate the fixture from the local legacy `.mdb` (rare, minutes) |
| `playwright.config.ts` + `e2e/`  | the Playwright suite (`@playwright/test` devDependency)             |

## Seeding (`node scripts/seed-test-db.mjs`)

Resets the database behind `DATABASE_URL` (env, falling back to
`./.env`) to a deterministic state:

- completed setup ("TwinCars Test GmbH"), seeded defaults (mail
  templates, ledger categories, number ranges, roles, holidays)
- admin account **`e2eadmin` / `e2e-passwort-123`** (same defaults as
  the smoke script)
- an anonymized subset of the legacy Kfz-Kaufmann import: ~300+
  customers, ~150 vehicles, ~400 documents with positions/payments,
  the full item catalog
- canonical anchor rows for specs (see `SEEDED` in `e2e/helpers.ts`):
  customer `E2E-1` "Erika Seedkunde", vehicle "Volkswagen Seedwagen"
  with plate `B-E2E 1`

Mechanics: drop all `public` tables + the `drizzle` schema, `psql`
restore of the dump in a single transaction, then `scripts/migrate.js`
as a top-up so migrations added **after** the fixture was generated
still apply (they are idempotent by convention, [[database-schema]]).
Runtime is a few seconds. Requires `psql` on the PATH.

**Safety**: the script refuses non-local `DATABASE_URL` hosts unless
`FORCE_SEED=1` is set. It is destructive by design — that is the point.

## Regenerating the fixture (`scripts/generate-test-seed.mjs`)

Only needed when the schema/setup flow changes in a way the committed
dump can no longer bridge (a migration top-up failure), or when the
subset should change. Requires things that only exist locally, which
is why the _output_ is committed but the generator inputs are not:

- the legacy MDB at `/home/nick/tc/Daten/kfz-kaufmann-test.mdb`
  (override: `MDB_PATH`) — **never commit `.mdb` files**
- a production build (`pnpm build`), `mdbtools`, `psql`, `pg_dump`
- a Chromium binary (`CHROMIUM_PATH`, default: the cached
  `~/.cache/ms-playwright/chromium-1226/...` binary)
- a **scratch database** that may be wiped:

```sh
SEED_SOURCE_DATABASE_URL='postgres://admin:…@localhost:5432/twincars-e2e' \
  node scripts/generate-test-seed.mjs
```

The generator deliberately uses the REAL application paths instead of
mirroring them: it wipes + migrates the scratch DB, boots `node build`,
drives the actual **setup wizard** headlessly (admin account created by
`better-auth` itself — no re-implemented password hashing), runs the
in-app **KFZ-Kaufmann import** ([[kfz-kaufmann-import]]) and stops it
after the data phase (the PDF pre-render is skipped; the fixture ships
without PDF caches and the app re-renders on demand,
[[pdf-pipeline]]). It then trims to a referentially-intact subset,
**anonymizes deterministically**, inserts the spec anchor rows and
dumps.

Anonymization (nothing personal survives into the committed fixture):

- customers: `Kunde <Nummer>` / `Firma <Nummer> GmbH`, hash-picked
  first names, `Musterstraße N`, `kunde-<nr>@example.com`, fake phone
  numbers; birthday, notes, IBAN/BIC/bank, VAT id, website, fax → NULL
- vehicles: VIN → `TESTVIN…`, plates → `B-TC <hash>`; engine number,
  notes → NULL
- employees / suppliers: personal + bank fields nulled or templated
- documents: header/footer/notes → NULL; position descriptions are
  scrubbed (original last names / company names replaced via word-
  boundary regex, license-plate-like tokens normalized)
- runtime residue (sessions, verifications, import jobs, PDF caches)
  deleted

Scratch-DB privileges: the role in `SEED_SOURCE_DATABASE_URL` needs
`GRANT ALL ON SCHEMA public` and `GRANT CREATE ON DATABASE` (for the
`drizzle` migration schema) — as the database owner:
`CREATE DATABASE "twincars-e2e"; GRANT CREATE ON DATABASE "twincars-e2e" TO admin; GRANT ALL ON SCHEMA public TO admin;`

After regenerating, review and commit `e2e/fixtures/seed.sql.gz`.

## Running the E2E suite

```sh
pnpm build
node scripts/seed-test-db.mjs
ORIGIN=http://localhost:4173 PORT=4173 node build &   # or a 2nd shell
pnpm test:e2e
```

Or let the harness do everything (seed + manage the server):

```sh
pnpm build
E2E_WEB_SERVER=1 SEED=1 pnpm test:e2e
```

- The suite always targets a **production build** — several past bug
  classes only reproduced there ([[known-constraints]]).
- Global setup (`e2e/global-setup.ts`) seeds on `SEED=1`, verifies the
  server, logs in once through the real form and stores the session in
  `e2e/.auth/admin.json` (gitignored) — specs start authenticated via
  `storageState`. Auth specs opt out with an empty storage state.
- `@playwright/test` is a devDependency, but **browsers are never
  downloaded**: `playwright.config.ts` points `executablePath` at the
  cached Chromium (`CHROMIUM_PATH` to override). Keep
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` in the environment when
  installing dependencies so no postinstall ever fetches browsers.
- Env knobs: `BASE_URL` (default `http://localhost:4173`),
  `E2E_USERNAME` / `E2E_PASSWORD`, `SEED=1`, `E2E_WEB_SERVER=1`,
  `CHROMIUM_PATH`. Retries 1 + trace on first retry under `CI=1`.

### Writing specs

- Accessible locators first (`getByRole`, `getByLabel`,
  `getByPlaceholder`); shared helpers in `e2e/helpers.ts`
  (`login`, `expectToast`, `fillField`, `uniqueTag`, `SEEDED`).
- Specs are independent: they rely only on the seeded baseline plus
  records they create themselves with a unique prefix
  (`E2e-…-<tag>`) — and they clean those up again.
- Never mutate the `SEEDED` anchor records.
- Exemplary specs: `e2e/auth.spec.ts` (login/logout, German error),
  `e2e/customers.spec.ts` (seeded list, search, create → archive →
  reactivate → delete round trip).

## Vitest script taxonomy

`pnpm test` stays the full suite. Scoped subsets (plain path filters,
no config changes — together they cover every test file):

| Script                  | Scope                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm test:unit`        | `src/lib/server`, `src/lib/stores`, `src/lib/utils`, root `src/*.test.ts`                                     |
| `pnpm test:components`  | `src/lib/components` (shared UI component tests)                                                              |
| `pnpm test:integration` | `src/routes` (remote-function/pg-mem tests **and** the route-level form/page component tests that live there) |
| `pnpm test:e2e`         | Playwright suite against a running production build                                                           |

Convention: component tests co-located under `src/routes` (e.g.
`CustomerForm.test.ts`, `login/page.test.ts`) count as integration
scope — they exercise route modules and their remotes; the components
scope is the shared `$lib/components` library.

Related: [[e2e-smoke]], [[dev-environment]], [[fresh-db-reset]],
[[kfz-kaufmann-import]].
