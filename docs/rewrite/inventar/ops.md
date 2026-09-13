---
title: Inventar Betrieb & Tooling (OPS)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (23 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Inventar: Konfiguration, Build, Deployment, Betrieb, Testbestand

Stand: 2026-09-12, Repo `/home/nick/tc/twincars-manager`, Branch `twincast-production-readiness` (HEAD `6a6d5f4 chore(release): v1.4.0`), Remote `git@github.com:nickhildebrandt/twincars-manager.git`. Alle Pfade repo-relativ. Bezeichner exakt wie im Bestand.

---

## 1. Toolchain und Skripte

### 1.1 package.json-Skripte

`package.json`: `"name": "twincars-manager"`, `"version": "1.4.0"`, `"type": "module"`, `"private": true`, `"packageManager": "pnpm@11.8.0"`, `"engines": { "node": ">=22", "pnpm": ">=11" }`. `.npmrc` (gitignored, lokal): `engine-strict=true`.

| Skript | Befehl | Zweck |
| --- | --- | --- |
| `dev` | `vite dev` | Vite-Dev-Server auf `http://localhost:5173` |
| `build` | `vite build` | Production-Build via `@sveltejs/adapter-node` nach `./build` |
| `preview` | `node build` | Gebauten Node-Server starten |
| `prepare` | `svelte-kit sync \|\| echo '' && husky` | Post-Install: SvelteKit-Typen erzeugen, Husky-Hooks installieren (im Docker-Prune per `--ignore-scripts` unterdrückt) |
| `check` | `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` | Typprüfung, muss 0 errors / 0 warnings liefern |
| `check:watch` | dito `--watch` | Typprüfung im Watch-Modus |
| `format` | `prettier --write .` | Repo-weit formatieren |
| `format:check` | `prettier --check .` | Format-Prüfung (laut README "für CI" — es gibt keine CI) |
| `test` | `vitest run` | Gesamte Vitest-Suite, Single-Run |
| `test:watch` | `vitest` | Vitest Watch |
| `test:cov` | `vitest run --coverage` | Vitest mit v8-Coverage |
| `test:ci` | `vitest run --coverage` | Identisch zu `test:cov`; nirgends aufgerufen |
| `test:unit` | `vitest run src/lib/server src/lib/stores src/lib/utils src/hooks.server src/service-worker` | Unit-Scope (Pfadfilter) |
| `test:components` | `vitest run src/lib/components` | Komponenten-Scope |
| `test:integration` | `vitest run src/routes` | Integrations-Scope (Remote-Functions/pg-mem + Route-Komponenten) |
| `test:e2e` | `playwright test` | Playwright-Suite in `e2e/` gegen Production-Build |
| `db:generate` | `drizzle-kit generate` | Migration aus `schema.ts` erzeugen |
| `db:migrate` | `node scripts/migrate.js` | Migrationen anwenden (dev + prod, derselbe Runner) |
| `db:push` | `drizzle-kit push` | Dev-only Schema-Push ohne Migrationsdatei |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio |
| `start` | `node build` | Server starten (identisch zu `preview`) |

`lint-staged` (in `package.json`): `"*": "prettier --write --ignore-unknown"`.

### 1.2 Node/pnpm-Anforderungen und Ist-Umgebung

- Vorgabe: Node ≥ 22, pnpm ≥ 11 via corepack (`packageManager: pnpm@11.8.0`), PostgreSQL ≥ 14, optional `mdbtools`, optional `pdftoppm` (poppler) für PDF-Visual-Tests.
- Ist (Dev-Maschine): Node `v24.18.0`, pnpm `11.8.0`, Debian GNU/Linux 13 (trixie), `psql`/`pg_dump` 17.11, Podman 5.4.2 (kein Docker installiert), `/usr/bin/mdb-export`, `/usr/bin/pdftoppm` vorhanden. Playwright-Chromium-Cache: `/home/nick/.cache/ms-playwright/chromium-1223|1226|1234`, `playwright-core` unter `/home/nick/.npm/_npx/86170c4cd1c5da32/node_modules/playwright-core` (und `…/9833c18b2d85bc59/…`).
- `pnpm-workspace.yaml` (6 Zeilen): einzig `allowBuilds: esbuild: true` (Build-Script-Freigabe für esbuild; pnpm 11 ignoriert das `pnpm`-Feld in package.json).
- Nie `npm install` (würde `package-lock.json` erzeugen; ADR-012).

### 1.3 Husky / lint-staged-Ablauf

- `.husky/pre-commit` (1 Zeile): `pnpm exec lint-staged`.
- `.husky/_/` (generiert, gitignored): Husky 9 Hook-Shims für alle Git-Hooks (`husky.sh`, `h`, `pre-commit`, `commit-msg`, … je 39 Byte Wrapper).
- Ablauf beim Commit: Husky → `lint-staged` → `prettier --write --ignore-unknown` über alle gestageten Dateien. Kein Lint (ESLint fehlt komplett), kein Test-, kein Typecheck-Hook. `--no-verify` ist per CONTRIBUTING §14 verboten.
- Installation der Hooks über `prepare` (läuft bei `pnpm install`).

### 1.4 Prettier-Regeln (exakt, `.prettierrc`, 19 Zeilen)

```
arrowParens: always · bracketSameLine: false · bracketSpacing: true · endOfLine: lf
htmlWhitespaceSensitivity: strict · insertPragma: false · objectWrap: collapse
plugins: [prettier-plugin-svelte, prettier-plugin-tailwindcss]
printWidth: 80 · quoteProps: as-needed · requirePragma: false · semi: false
singleQuote: true · tabWidth: 2 · trailingComma: none · useTabs: false
overrides: [{ files: "*.svelte", options: { parser: "svelte" } }]
```

`.prettierignore` (40 Zeilen): `node_modules`, `.output`, `.vercel`, `.netlify`, `.wrangler`, `.svelte-kit`, `build`, `.DS_Store`, `Thumbs.db`, `.env`, `.env.*`, `vite.config.*.timestamp-*`, `.vscode`, `.idea`, `.npmrc`, `coverage`, `.nyc_output`, `test-results`, `playwright-report`, `package-lock.json`, `drizzle`.

`.vscode/extensions.json`: einzige Empfehlung `svelte.svelte-vscode`.

### 1.5 TypeScript-Konfiguration (`tsconfig.json`, 20 Zeilen)

- `extends: ./.svelte-kit/tsconfig.json` (generiert durch `svelte-kit sync`).
- `compilerOptions`: `rewriteRelativeImportExtensions: true`, `allowJs: true`, `checkJs: true`, `esModuleInterop: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`, `skipLibCheck: true`, `sourceMap: true`, `strict: true`, `moduleResolution: "bundler"`.
- Path-Aliases ausschließlich über SvelteKit (`$lib`, `$app/*`, `$env/*`, `$service-worker`).
- `src/app.d.ts`: globale Konstante `__APP_VERSION__` (Vite `define` aus `package.json` version), `App.Locals { session, user, permissions: Set<string> }`.
- TypeScript resolved **6.0.3**, `svelte-check` 4.6.0.

### 1.6 SvelteKit-/Vite-/Vitest-Konfiguration

`svelte.config.js` (22 Zeilen): `preprocess: vitePreprocess()`, `compilerOptions: { runes: true, experimental: { async: true } }`, `kit.adapter: adapter()` (adapter-node, Defaults → `build/`), `kit.experimental.remoteFunctions: true`, `kit.serviceWorker.register: false` (manuelle Registrierung nur in Prod, siehe §6).

`vite.config.ts` (50 Zeilen):
- Plugins: `tailwindcss()` (`@tailwindcss/vite`), `sveltekit()`, `svelteTesting()` (`@testing-library/svelte/vite`).
- `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` (liest `package.json` zur Build-Zeit).
- `resolve.alias['@opentelemetry/api'] → src/lib/server/otel-noop.ts` (No-op-Shim, weil better-auth ≥ 1.6 `withSpan` nutzt und Rollup-CJS-Interop das Paket zu einem default-only-Namespace kollabieren kann → 500 auf jedem Request im Prod-Container; ADR-018).
- `ssr.noExternal: ['daisyui']`, `optimizeDeps.exclude: ['@lucide/svelte']`, `build.target: 'esnext'`.
- `test`: `globals: true`, `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`, `include: ['src/**/*.{test,spec}.{js,ts}']`.
- `test.coverage`: `provider: 'v8'`, `reporter: ['text', 'html', 'lcov']`, `include: ['src/**/*.{ts,svelte}']`, `exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/**/__fixtures__/**', 'src/app.d.ts', 'src/app.html', 'src/hooks.ts', 'src/lib/server/db/migrate.ts']`. **Keine Schwellenwerte (`thresholds`) konfiguriert.** `src/lib/server/db/migrate.ts` existiert nicht (Stale-Exclude).
- `vitest.setup.ts` (1 Zeile): `import '@testing-library/jest-dom/vitest'`.
- Keine getrennten Vitest-Environments (alles jsdom, auch reine Server-Tests). DB-Tests laufen über `src/lib/server/db/test-db.ts` (pg-mem via `drizzle-orm/pg-proxy`, wendet alle `drizzle/*.sql` mit einem Regex-Sanitizer an; `gen_random_uuid()` wird per JS registriert); Standard-Mock-Muster `vi.mock('$lib/server/db/client', …)` — in 58 Testdateien genutzt.

`drizzle.config.ts` (23 Zeilen): liest `.env` manuell per Regex (setzt `process.env` nur wenn nicht gesetzt), `schema: ./src/lib/server/db/schema.ts`, `out: ./drizzle`, `dialect: postgresql`, `dbCredentials.url: process.env.DATABASE_URL ?? 'postgres://admin:TwinCars2026!@localhost:5432/twincars-manager'`, `strict: true`, `verbose: false`.

### 1.7 Playwright-Konfiguration (`playwright.config.ts`, 78 Zeilen)

- `testDir: 'e2e'`, `outputDir: 'test-results'`, `globalSetup: './e2e/global-setup'`, `globalTeardown: './e2e/global-teardown'`.
- `fullyParallel: false` (Dateien parallel in Workern möglich, Tests innerhalb einer Datei seriell), `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`, `reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']]`, `timeout: 60_000`, `expect.timeout: 10_000`.
- `use`: `baseURL: process.env.BASE_URL ?? 'http://localhost:4173'`, `storageState: 'e2e/.auth/admin.json'` (von global-setup erzeugt), `trace: 'on-first-retry'`, `locale: 'de-DE'`, `timezoneId: 'Europe/Berlin'`, `viewport: 1440×900`, `launchOptions: { executablePath: chromiumPath?, args: ['--no-sandbox'] }`.
- Browser-Pfad: `CHROMIUM_PATH` → sonst hartcodiert `/home/nick/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome` (falls vorhanden) → sonst Playwright-eigene Auflösung. **Browser werden nie heruntergeladen** (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` als Konvention).
- Projekte: genau eines, `{ name: 'chromium' }`.
- Web-Server: kein `webServer`-Block; stattdessen `e2e/global-setup.ts`: (1) `SEED=1` → `node scripts/seed-test-db.mjs`; (2) prüft `fetch(baseURL)`; wenn kein Server antwortet und `E2E_WEB_SERVER=1`: spawnt `node build` (detached, `PORT`, `ORIGIN`, `BODY_SIZE_LIMIT ?? '64M'`), PID → `e2e/.auth/webserver.pid`, Log → `e2e/.auth/webserver.log`, wartet bis 60 s; (3) loggt über das echte Formular ein (`getByLabel('Benutzername')`, `getByLabel('Passwort')`, Button `Anmelden`) und speichert `context.storageState` nach `e2e/.auth/admin.json`. `global-teardown.ts` killt nur den selbst gestarteten Server (SIGTERM per PID-Datei).
- Fixture-Handling: `e2e/fixtures/seed.sql.gz` (288 679 Byte, committed) = vollständiger `pg_dump --no-owner --no-privileges --no-comments` einer anonymisierten Baseline; `scripts/seed-test-db.mjs` spielt ihn ein (siehe §5.3).

---

## 2. Abhängigkeiten

Versionen: Range aus `package.json` / resolved aus `pnpm-lock.yaml` (importers-Block). Exakt gepinnt (ohne Caret): `@sveltejs/kit`, `svelte`, `@testing-library/svelte` (CONTRIBUTING §2, ADR-012).

| Paket | Range → resolved | Zweck im Bestand (konkret) | Laufzeit/Dev |
| --- | --- | --- | --- |
| `@lucide/svelte` | ^1.14.0 → 1.21.0 | Icon-Set; importiert in 72 Dateien (`src/lib/components/ui/*.svelte`, alle Routen-Pages); `optimizeDeps.exclude` in vite.config | Laufzeit |
| `@sveltejs/adapter-node` | ^5.5.4 → 5.5.4 | Build-Adapter → `build/index.js` + `build/handler.js`; liefert Env-Handling (HOST/PORT/ORIGIN/BODY_SIZE_LIMIT/XFF_DEPTH …) | Laufzeit (nur Build-Zeit genutzt) |
| `better-auth` | ^1.6.11 → 1.6.20 | Identity (username-Plugin, Drizzle-Adapter `provider: 'pg'`); `src/lib/server/auth.ts`, `src/hooks.server.ts`, `src/lib/client/auth-client.ts`; Catch-all `src/routes/api/auth/[...all]/+server.ts` | Laufzeit |
| `csv-parse` | ^6.2.1 → 6.2.1 | `parse` aus `csv-parse/sync` in `src/lib/server/services/import-service.ts` (CSV von `mdb-export` parsen, `delimiter: ';'`) | Laufzeit |
| `drizzle-orm` | ^0.45.2 → 0.45.2 | ORM in 77 Dateien (alle Services, `db/client.ts` via `drizzle-orm/postgres-js`, `test-db.ts` via `drizzle-orm/pg-proxy`); Runtime-Migrator `drizzle-orm/postgres-js/migrator` in `scripts/migrate.js` | Laufzeit |
| `nanoid` | ^5.1.11 → 5.1.15 | Ausschließlich `src/lib/stores/toast.svelte.ts` (Toast-IDs) | Laufzeit |
| `nodemailer` | ^8.0.7 → 8.0.11 | SMTP-Versand in `src/lib/server/services/mail-service.ts` (Transport wird in Tests gemockt) | Laufzeit |
| `pdf-lib` | ^1.17.1 → 1.17.1 | PDF-Rendering in `src/lib/server/services/pdf-service.ts` (Rechnung/Angebot/KV/AB/Storno/Zahlungserinnerung/Verkaufsschild/Reifen-Etikett) | Laufzeit |
| `postgres` | ^3.4.9 → 3.4.9 | postgres-js-Client: `src/lib/server/db/client.ts` (`max: 10, idle_timeout: 20, connect_timeout: 10`), `scripts/migrate.js` (`max: 1`), `scripts/generate-test-seed.mjs` | Laufzeit |
| `qrcode` | ^1.5.4 → 1.5.4 | `src/lib/server/services/qr-service.ts` (`renderQrPng`, `renderQrSvg` für Verkaufsschild/Etikett) | Laufzeit |
| `valibot` | ^1.3.1 → 1.4.1 | Schemas in 60 Dateien: `src/lib/server/db/validation.ts`, jede `*.remote.ts`, `src/lib/utils/form-validation.svelte.ts` (Client-Validierung) | Laufzeit |
| `@playwright/test` | ^1.61.1 → 1.61.1 | E2E-Runner (`e2e/*.spec.ts`, 16 Dateien) + `chromium` in `scripts/generate-test-seed.mjs` und `e2e/global-setup.ts` | Dev |
| `@sveltejs/kit` | 2.58.0 (exakt) | Framework; `$app/server` (39 non-test Dateien = 38 `*.remote.ts` + Layout), `$app/navigation` (72), `$app/state` (40), `$app/stores` (1), `$app/environment` (2), `$env/dynamic/private` (6), `error`/`json`/`redirect` in 60 Dateien | Dev (Build) |
| `@sveltejs/vite-plugin-svelte` | ^6.2.4 → 6.2.4 | `vitePreprocess` in svelte.config.js | Dev |
| `@tailwindcss/vite` | ^4.2.4 → 4.3.1 | Tailwind-v4-Vite-Plugin | Dev |
| `@testing-library/jest-dom` | ^6.9.1 → 6.9.1 | Matcher via `vitest.setup.ts` (53 Komponenten-/Page-Tests) | Dev |
| `@testing-library/svelte` | 5.3.1 (exakt) | `render`/`screen` in 53 Testdateien; `svelteTesting()` Vite-Plugin | Dev |
| `@testing-library/user-event` | ^14.6.1 → 14.6.1 | Nutzerinteraktion in 43 Testdateien | Dev |
| `@types/node` | ^25.6.0 → 25.9.4 | Node-Typen | Dev |
| `@types/nodemailer` | ^8.0.0 → 8.0.1 | Typen | Dev |
| `@types/qrcode` | ^1.5.6 → 1.5.6 | Typen | Dev |
| `@vitest/coverage-v8` | ^4.1.5 → 4.1.9 | Coverage-Provider (`test:cov`, `test:ci`) | Dev |
| `daisyui` | ^5.5.19 → 5.5.23 | `@plugin 'daisyui' { themes: corporate --default; logs: false }` in `src/app.css`; `ssr.noExternal` | Dev (CSS-Build) |
| `drizzle-kit` | ^0.31.10 → 0.31.10 | `db:generate`, `db:push`, `db:studio`; nicht im Runtime-Image | Dev |
| `husky` | ^9.1.7 → 9.1.7 | Git-Hooks | Dev |
| `jsdom` | ^29.1.1 → 29.1.1 | Vitest-Environment | Dev |
| `lint-staged` | ^16.4.0 → 16.4.0 | Pre-Commit-Formatierung | Dev |
| `pg-mem` | ^3.0.14 → 3.0.14 | In-Memory-Postgres in `src/lib/server/db/test-db.ts` (24 Testdateien importieren pg-mem-Muster direkt, 58 über `test-db`) | Dev |
| `prettier` | ^3.8.3 → 3.8.4 | Formatierung | Dev |
| `prettier-plugin-svelte` | ^3.5.1 → 3.5.2 | Svelte-Parser | Dev |
| `prettier-plugin-tailwindcss` | ^0.8.0 → 0.8.0 | Klassen-Sortierung | Dev |
| `svelte` | 5.56.4 (exakt, ≥ 5.56.x Pflicht) | Framework (135 `.svelte`-Dateien); 5.55.5 hatte Stale-List-Bug in Prod-Builds | Dev (Build) |
| `svelte-check` | ^4.4.6 → 4.6.0 | Typprüfung (`check`) | Dev |
| `tailwindcss` | ^4.2.4 → 4.3.1 | `@import 'tailwindcss'` in `src/app.css` | Dev (CSS-Build) |
| `typescript` | ^6.0.2 → 6.0.3 | Compiler | Dev |
| `vite` | ^6.4.2 → 6.4.3 | Bundler/Dev-Server | Dev |
| `vitest` | ^4.1.5 → 4.1.9 | Test-Runner (141 Dateien inkl. `test-db.ts`) | Dev |

Nicht als Dependency, aber zur Laufzeit erforderlich: Systempaket `mdbtools` (`mdb-export`, Shell-Aufruf in `import-service.ts:145` via `execAsync` mit `shellQuote`, temporäre Datei unter `mkdtemp(join(tmpdir(), 'tc-import-'))`, `maxBuffer: 256 MiB`); optional `poppler-utils` (`pdftoppm`) für `pdf-visual.test.ts`; `playwright-core` + Chromium für `scripts/e2e-smoke.mjs` (bewusst keine Repo-Dependency).

Umfang: 38 `*.remote.ts`, 135 `.svelte`, 143 `.ts` (ohne Tests), ≈105 000 LOC in `src/` (inkl. ≈41 000 LOC Tests), 38 Migrationen `drizzle/0000_lying_tyger_tiger.sql … 0037_document_work_order_link.sql` (Journal 38 Einträge, `drizzle/meta/` nur 9 Dateien — Snapshots bei 0007 eingefroren).

---

## 3. Environment-Variablen

Lesekonvention im Code: `process.env[key] ?? env[key]` (`$env/dynamic/private`) über lokale `readEnv`-Helfer in `api-tokens.ts`, `crypto.ts`, `ebay-auth-service.ts`, `account-deletion/endpoint.ts`; `auth.ts` und `db/client.ts` lesen `env.X` direkt. Adapter-node liest seine Variablen in `build/index.js`/`build/handler.js` über `env(name, default)`.

### 3.1 Manager-App (SvelteKit-Prozess)

| Variable | Pflicht | Default | Zweck | verwendet in (Datei:Zeile) | Dev/Prod |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | ja | `postgres://admin:TwinCars2026!@localhost:5432/twincars-manager` (Fallback im Code!) | postgres-js-Verbindung | `src/lib/server/db/client.ts:7`, `drizzle.config.ts:18`, `scripts/migrate.js:30` (ohne Default → exit 1), `scripts/seed-test-db.mjs:55` (Fallback aus `.env`) | Dev `.env` / Prod `manager.env` (von provision.sh, `postgresql://twincars:<pw>@127.0.0.1:5432/twincars`) |
| `APP_SECRET` | ja (faktisch) | `'dev-only-fallback-secret-do-not-use-prod'` | better-auth Cookie-HMAC; Fallback-Schlüssel für AES-Verschlüsselung; HMAC für eBay-OAuth-`state` (wirft ohne Wert) | `src/lib/server/auth.ts:37`, `src/lib/server/crypto.ts:31`, `src/lib/server/services/ebay-auth-service.ts:92`, `scripts/generate-test-seed.mjs:147` | Dev `.env` / Prod: laut Doku `manager.env` — **provision.sh schreibt es nicht** (siehe B-598) |
| `APP_ENCRYPTION_KEY` | nein | → `APP_SECRET` | AES-256-GCM-Schlüssel (SHA-256-Ableitung) für eBay-Tokens + SMTP-Passwort | `src/lib/server/crypto.ts:31` | Prod: `openssl rand -hex 32` in provision.sh |
| `BETTER_AUTH_URL` | nein | → `ORIGIN` → `http://localhost:5173` | better-auth `baseURL` (Cookie-Domain) | `src/lib/server/auth.ts:46` | Dev `.env.example` / Prod `https://tc.ts13.de:5443` |
| `ORIGIN` | Prod ja | undefined | SvelteKit/adapter-node Origin (URL-Erzeugung, CSRF), `trustedOrigins` in better-auth | `src/lib/server/auth.ts:46-47`, `build/handler.js` (`env('ORIGIN', undefined)`), `account-deletion/endpoint.ts:97` (Hash-Basis) | Prod `https://tc.ts13.de:5443`; E2E `http://localhost:4173` |
| `API_TOKENS` | nein (leer = fail-closed) | `''` | Bearer-Tokens für `/api/public/*`; Trennzeichen `,` `;` Newline; ≥ 8 Zeichen; nur erste 8 Zeichen an Rate-Limit/Audit | `src/lib/server/api-tokens.ts:37,48` | Dev `.env` / Prod manuell in `manager.env` (provision.sh schreibt es nicht; Website-Token `TC_MANAGER_API_TOKEN` wird generiert, aber nicht gespiegelt) |
| `EBAY_CLIENT_ID` | nein | — | eBay App ID (OAuth) | `ebay-auth-service.ts:68,81` | optional |
| `EBAY_CERT_ID` | nein | — | eBay Cert ID (Client Secret) | `ebay-auth-service.ts:68,82` | optional |
| `EBAY_RU_NAME` | nein | — | eBay RuName (Redirect) | `ebay-auth-service.ts:68,83` | optional |
| `EBAY_ENV` | nein | `production` | `sandbox` schaltet Sandbox-Welt | `ebay-auth-service.ts:43` | optional |
| `EBAY_VERIFICATION_TOKEN` | nein (unset = 503) | — | Shared Secret für Marketplace-Account-Deletion-Challenge (32–80 Zeichen `[A-Za-z0-9_-]`) | `src/routes/api/ebay/account-deletion/endpoint.ts:77` | optional |
| `EBAY_DELETION_ENDPOINT_URL` | nein | `ORIGIN + pathname` | Exakte registrierte Endpoint-URL (Challenge-Hash byte-genau) | `account-deletion/endpoint.ts:102` | Prod `https://tc.ts13.de/api/ebay/account-deletion` |
| `EBAY_DEV_ID` | nein | — | Nur in `docs/operations/environment-variables.md` dokumentiert, **im Code nicht gelesen** | — | Prod (Vollständigkeit) |
| `NODE_ENV` | nein | Vite setzt Mode | Nie in `.env` setzen (macht `pnpm build` zum Dev-Bundle) | `Dockerfile:37` (`ENV NODE_ENV=production`), `provision.sh:113` | Prod |
| `HOST` | nein | `0.0.0.0` | adapter-node Bind | `build/index.js`; `provision.sh:114`; `generate-test-seed.mjs:142` | Prod `0.0.0.0` |
| `PORT` | nein | `3000` | adapter-node Port; Healthcheck | `build/index.js`; `scripts/healthcheck.cjs:5`; `e2e/global-setup.ts:77` | Prod 3000, E2E 4173, Seed 4184 |
| `SOCKET_PATH` | nein | false | Unix-Socket statt Port | `build/index.js` | ungenutzt |
| `BODY_SIZE_LIMIT` | Prod ja | `512K` (adapter-node) | Request-Body-Limit; MDB-Base64-Upload (~25–30 MB) | `Dockerfile:48` (`64M`), `provision.sh:120` (`67108864`), `e2e/global-setup.ts:79`, `generate-test-seed.mjs:145`, `build/handler.js` | Prod 64 MiB |
| `SHUTDOWN_TIMEOUT` | nein | `30` | adapter-node Graceful-Shutdown (s) | `build/index.js` | ungesetzt |
| `IDLE_TIMEOUT` | nein | `0` | adapter-node Idle-Shutdown | `build/index.js` | ungesetzt |
| `KEEP_ALIVE_TIMEOUT`, `HEADERS_TIMEOUT` | nein | Node-Default | HTTP-Server-Timeouts | `build/index.js` | ungesetzt |
| `LISTEN_PID`, `LISTEN_FDS` | nein | `0` | systemd Socket-Activation | `build/index.js` | ungesetzt |
| `XFF_DEPTH` | nein | `1` | adapter-node `getClientAddress()` XFF-Tiefe | `build/handler.js` | ungesetzt (Hooks lesen XFF eigenständig, s. B-600) |
| `ADDRESS_HEADER`, `PROTOCOL_HEADER`, `HOST_HEADER`, `PORT_HEADER` | nein | `''` | adapter-node Proxy-Header-Namen | `build/handler.js` | ungesetzt; Caddy setzt `X-Forwarded-Proto https` per `header_up`, aber `PROTOCOL_HEADER` ist nicht konfiguriert → adapter-node nutzt `ORIGIN` |

### 3.2 Skripte / Tests / Tooling

| Variable | Pflicht | Default | Zweck | verwendet in | Dev/Prod |
| --- | --- | --- | --- | --- | --- |
| `MAIL_CATCHER_HOST` | nein | `127.0.0.1` | Bind des Dev-SMTP-Catchers | `scripts/dev-mail-catcher.js:23` | Dev |
| `MAIL_CATCHER_PORT` | nein | `1025` | Port | `dev-mail-catcher.js:24` | Dev |
| `MAIL_CATCHER_DIR` | nein | `./tmp/mail` | Ablage der `.eml` | `dev-mail-catcher.js:26` | Dev |
| `BASE_URL` | nein | `http://localhost:4173` | Ziel-Server für E2E/Smoke | `playwright.config.ts:64`, `scripts/e2e-smoke.mjs:57` | Dev |
| `E2E_USERNAME` | nein | `e2eadmin` | Login | `playwright.config.ts` (Doku), `e2e/global-setup.ts:31`, `e2e/helpers.ts:4`, `e2e-smoke.mjs:58` | Dev |
| `E2E_PASSWORD` | nein | `e2e-passwort-123` | Login | `e2e/global-setup.ts:32`, `e2e/helpers.ts:5`, `e2e-smoke.mjs:59` | Dev |
| `PLAYWRIGHT_CORE_PATH` | nein | Modulauflösung | Pfad zu `playwright-core` (Smoke) | `e2e-smoke.mjs:66-67` | Dev |
| `CHROMIUM_PATH` | nein | gecachter Pfad | Chromium-Binary | `playwright.config.ts:45`, `e2e-smoke.mjs:89`, `generate-test-seed.mjs:78` | Dev |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | Konvention `1` | — | Verhindert Browser-Download beim Install | Doku (`test-database.md:149`) | Dev |
| `SEED` | nein | — | `1` → Reseed vor E2E | `e2e/global-setup.ts:118` | Dev |
| `E2E_WEB_SERVER` | nein | — | `1` → Setup startet `node build` | `e2e/global-setup.ts:121` | Dev |
| `CI` | nein | — | Playwright `forbidOnly`/`retries`/`reporter` | `playwright.config.ts:56-58` | (keine CI vorhanden) |
| `FORCE_SEED` | nein | — | `1` erlaubt Seeding nicht-lokaler DB | `scripts/seed-test-db.mjs:70` | Dev |
| `SEED_SOURCE_DATABASE_URL` | ja (Generator) | — | Scratch-DB, wird gewiped; nur localhost | `scripts/generate-test-seed.mjs:64,88-96` | Dev |
| `MDB_PATH` | nein | `/home/nick/tc/Daten/kfz-kaufmann-test.mdb` | Legacy-MDB für Generator | `generate-test-seed.mjs:66` | Dev |
| `SEED_SERVER_PORT` | nein | `4184` | Temp-Server des Generators | `generate-test-seed.mjs:67` | Dev |
| `KEEP_DOCUMENTS` / `KEEP_VEHICLES` / `KEEP_CUSTOMERS` | nein | 400 / 150 / 300 | Trim-Obergrenzen | `generate-test-seed.mjs:71-73` | Dev |
| `PDF_SNAPSHOTS` | nein | — | `update` schreibt PNG-Snapshots neu | `src/lib/server/services/pdf-visual.test.ts:79` | Dev |
| `PGOPTIONS` | intern gesetzt | `-c client_min_messages=warning` | psql-Ruhe beim Seeding | `seed-test-db.mjs:89` | Dev |
| `DEPLOY_DIR` | nein | `/opt/twincars-deploy` | Quelle für provision.sh | `deploy/scripts/provision.sh:28` | Prod-Host |
| `SUDO_USER`/`USER` | — | — | sshfs-Mount-Skript | `ssh/mount-backup-storage.sh:4` | Dev |

### 3.3 Andere Container (`/etc/twincars/env/*.env`, von provision.sh erzeugt)

| Variable | Container | Wert/Quelle |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `PGDATA` | postgres | `twincars` / `openssl rand -hex 24` / `twincars` / `/var/lib/postgresql/data/pgdata` (`provision.sh:95-103`) |
| `NODE_ENV`, `HOST`, `PORT=3001`, `ORIGIN=https://tc.ts13.de`, `PUBLIC_SITE_URL`, `TC_MANAGER_API_URL=http://localhost:3000`, `TC_MANAGER_API_TOKEN` | website | `provision.sh:128-148`; Token `openssl rand -hex 32`, muss manuell als `API_TOKENS` im Manager gespiegelt werden |
| `REGISTRY_HTTP_ADDR=:5001`, `REGISTRY_STORAGE_DELETE_ENABLED=true`, `REGISTRY_HTTP_HEADERS_X_Content_Type_Options=[nosniff]` | registry | `deploy/env-templates/registry.env` |

`.env.example` (58 Zeilen) enthält: `DATABASE_URL` (mit Klartext-Dev-Passwort `TwinCars2026!`), `APP_SECRET`, `BETTER_AUTH_URL`, `API_TOKENS=`, `EBAY_VERIFICATION_TOKEN=`, `EBAY_DELETION_ENDPOINT_URL=`, `EBAY_CLIENT_ID=`, `EBAY_CERT_ID=`, `EBAY_RU_NAME=`, `#EBAY_ENV=sandbox`, sowie Kommentar-Block „Production additionally sets: ORIGIN, BODY_SIZE_LIMIT, HOST, PORT". `APP_ENCRYPTION_KEY` fehlt als Zeile (nur erwähnt). Lokale `.env` existiert (798 Byte, gitignored); `.env.test` ist in `.gitignore` erlaubt, existiert aber nicht.

**Gesamt: 12 App-Variablen + 15 adapter-node-Variablen + `NODE_ENV` + `EBAY_DEV_ID` (doc-only) + 22 Skript-/Tooling-Variablen + 10 Fremdcontainer-Variablen ≈ 61 Variablen.**

---

## 4. Build und Deployment

### 4.1 Dockerfile (65 Zeilen) Schritt für Schritt

```
# syntax=docker/dockerfile:1.7
Stage build:   FROM node:lts-slim AS build · WORKDIR /app · RUN corepack enable
               COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
               RUN pnpm install --frozen-lockfile
               COPY . .                      ← gesamter Build-Kontext (siehe .dockerignore)
               RUN pnpm run build && pnpm prune --prod --ignore-scripts
Stage runtime: FROM node:lts-slim AS runtime · WORKDIR /app · ENV NODE_ENV=production
               RUN apt-get update && apt-get install -y --no-install-recommends mdbtools && rm -rf /var/lib/apt/lists/*
               ENV BODY_SIZE_LIMIT=64M
               COPY --from=build /app/build ./build
               COPY --from=build /app/node_modules ./node_modules
               COPY --from=build /app/package.json ./package.json
               COPY --from=build /app/scripts ./scripts
               COPY --from=build /app/drizzle ./drizzle
               EXPOSE 3000
               CMD ["sh", "-c", "node scripts/migrate.js && node build"]
```

- Base-Image: `node:lts-slim` (nicht digest-/major-gepinnt; README behauptet fälschlich `node:lts-alpine`). apt-Paket: nur `mdbtools`, ungepinnt.
- Build-Args: keine. `USER`: keiner → Container läuft als **root**. `HEALTHCHECK`: keiner im Dockerfile (nur im Quadlet). Kein Label/OCI-Metadaten.
- `.dockerignore` (16 Zeilen): `.git`, `.gitignore`, `.husky`, `.svelte-kit`, `.vscode`, `.env`, `.env.*`, `!.env.example`, `node_modules`, `build`, `coverage`, `tmp`, `*.log`, `README.md`, `CONTRIBUTING.md`, `docs`. **Nicht ausgeschlossen:** `ssh/` (enthält den privaten Key `ssh/twincars-manager`), `e2e/` (inkl. `seed.sql.gz`), `test-results/`, `.playwright-mcp/`, `drizzle/meta`. Sie landen im Build-Stage-Layer (nicht im Runtime-Image).
- `--ignore-scripts` beim Prune ist Pflicht (sonst `prepare` = `svelte-kit sync && husky` ohne devDeps).
- `pnpm prune --prod` entfernt drizzle-kit, vite, vitest, svelte-check, prettier, typescript, testing-library, @playwright/test.
- Runtime-Inhalt: `build/`, `node_modules/` (prod), `package.json`, `scripts/` (alle 6 Skripte, auch Dev-only wie `e2e-smoke.mjs`, `generate-test-seed.mjs`), `drizzle/`.
- Migrationslauf: `scripts/migrate.js` (53 Zeilen) — `postgres(DATABASE_URL, { max: 1 })`, `migrate(drizzle(client), { migrationsFolder: './drizzle' })`, exit 1 bei Fehler (kein Connection-String im Log), `&&` verhindert App-Start bei Fehlschlag. Kein Backup, kein Lock (Single-Instance-Annahme, CONTRIBUTING §17). `seedDefaults()` läuft beim ersten Request in `hooks.server.ts` (`ensureSeeded`, prozess-lokaler Promise-Guard).
- Port 3000, HTTP-only (TLS via Caddy).

### 4.2 Pod-Aufbau (Podman Quadlet, `deploy/quadlet/`)

`twincars.pod` (19 Zeilen): `PodName=twincars`, `PublishPort=80:80`, `443:443`, `5000:5000`, `5443:5443`; `Wants/After=network-online.target`; alle Container teilen den Netzwerk-Namespace (Loopback `127.0.0.1`).

| Unit | Image | EnvironmentFile | Volumes | HealthCmd / Intervall / Retries / StartPeriod | Restart | Besonderheiten |
| --- | --- | --- | --- | --- | --- | --- |
| `postgres.container` | `docker.io/library/postgres:18-alpine` | `/etc/twincars/env/postgres.env` | `/srv/twincars/data/postgres:/var/lib/postgresql/data:Z` | `pg_isready -U twincars -d twincars` / 10s / 5 / 30s | always, 5s, TimeoutStartSec 300 | kein PublishPort |
| `manager.container` | `tc.ts13.de:5000/twincars-manager:latest` | `/etc/twincars/env/manager.env` | keine | `node /app/scripts/healthcheck.cjs` / 15s / 4 / 60s | always, 10s, 300 | `Label=io.containers.autoupdate=registry`, `Pull=missing`, Requires/After `twincars-pod.service postgres.service` |
| `website.container` | `tc.ts13.de:5000/twincars-website:latest` | `/etc/twincars/env/website.env` | keine | `node /app/scripts/healthcheck.cjs` / 15s / 4 / 60s | always, 10s, 300 | autoupdate=registry, Port 3001 intern |
| `registry.container` | `docker.io/library/registry:2` | `/etc/twincars/env/registry.env` | `/srv/twincars/data/registry:/var/lib/registry:Z` | `wget --quiet --spider http://127.0.0.1:5001/v2/` / 30s / 4 / 15s | always, 5s | keine eigene Auth |
| `caddy.container` | `docker.io/library/caddy:2-alpine` | — | `/etc/twincars/caddy/Caddyfile:/etc/caddy/Caddyfile:ro,Z`, `/srv/twincars/data/caddy-data:/data:Z`, `/srv/twincars/data/caddy-config:/config:Z` | `wget --quiet --spider https://tc.ts13.de/` / 30s / 4 / 60s | always, 5s, 300 | Requires `twincars-pod.service registry.service`, After zusätzlich `postgres.service` |

Keine Ressourcenlimits (kein `Memory=`, `CPUQuota=`, `PidsLimit=`), keine `User=`/`UserNS=`-Angaben (rootful Podman als root), keine `ReadOnly=`/`NoNewPrivileges`. Alle Units `WantedBy=multi-user.target default.target`.

**Caddy-Routing (`deploy/Caddyfile.tmpl`, 81 Zeilen):**
- Global: `email admin@ts13.de`, `protocols h1 h2 h3`. Snippet `security_headers`: HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy geolocation=(), microphone=(), camera=()`, `-Server`.
- `tc.ts13.de` (443): `encode zstd gzip`; `handle /api/ebay/account-deletion*` → `reverse_proxy localhost:3000` (Manager, `header_up X-Forwarded-Proto https`) — eBay-Validator funktioniert nur auf 443; sonst `reverse_proxy localhost:3001` (Website).
- `tc.ts13.de:5443`: Manager, `request_body max_size 64MB`, `reverse_proxy localhost:3000` mit `X-Forwarded-Proto https`.
- `tc.ts13.de:5000`: Registry, `request_body max_size 4GB`, `basic_auth /v2/* { deploy {{BCRYPT_HASH}} }`, `reverse_proxy localhost:5001` (`Host {host}`).
- TLS: Caddy-Auto-TLS (Let's Encrypt), ein Zertifikat für alle drei Ports. Kein Access-Log konfiguriert, keine `trusted_proxies`.
- Provisionierung rendert `{{BCRYPT_HASH}}` per `podman run caddy hash-password` in `/etc/twincars/caddy/Caddyfile` (mode 600).

**Registry:** self-hosted `registry:2` im Pod, extern `https://tc.ts13.de:5000/v2`, Nutzer `deploy` (Passwort in `/etc/twincars/registry.deploy.pw`), Podman-Pull-Auth in `/root/.config/containers/auth.json`. Image-Push vom Dev-Rechner: `podman build -t tc.ts13.de:5000/twincars-manager:latest . && podman push …`. Website-Container ist ein zweites SvelteKit-Repo (`/home/nick/tc/twincars-website`).

### 4.3 systemd-Timer (`deploy/systemd/`)

| Unit | Inhalt |
| --- | --- |
| `twincars-backup.timer` | `OnCalendar=*-*-* 03:00:00`, `Persistent=true`, `RandomizedDelaySec=10m` |
| `twincars-backup.service` | `Type=oneshot`, `ExecStart=/usr/local/bin/twincars-backup-db.sh daily`, `Requires/After=postgres.service`, `TimeoutStartSec=30min` |
| `twincars-update.timer` | `OnBootSec=3min`, `OnUnitInactiveSec=2min`, `AccuracySec=30s` |
| `twincars-update.service` | `Type=oneshot`, `ExecStart=/usr/local/bin/twincars-update.sh`, `TimeoutStartSec=20min`, `After=network-online.target twincars-pod.service` |

### 4.4 `deploy/scripts/backup-db.sh` (102 Zeilen)

1. `mode=${1:-daily}`; `ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)`; `local_dir=/srv/twincars/backups/pg`; Storagebox `u589158@u589158.your-storagebox.de` Port 23 (restricted shell: `ls mkdir rm cat …`, kein `find`), Key `/etc/twincars/storagebox.key`.
2. Modi: `daily` → `remote_dir=/home/backups/postgres`, lokal 3 Tage, remote 14 Tage; `predeploy` → Suffix `_predeploy`, `remote_dir=/home/backups/postgres-predeploy`, lokal 7 Tage, remote 7 Tage.
3. `podman exec postgres pg_dump -U twincars -d twincars | gzip -9 > <local_dir>/<ts><suffix>.sql.gz` (logisches Voll-Backup, ohne Globals/Rollen).
4. Wenn Key vorhanden: `ssh mkdir <remote_dir>` (Fehler ignoriert), `rsync -e "ssh -p 23 …"` hochladen; Remote-Retention: `ls`-Liste lexikografisch gegen Cutoff-Timestamp filtern, ein `rm` mit allen alten Pfaden; Daily-Modus rührt `*_predeploy.sql.gz` nie an.
5. Lokale Retention via `find -mtime +N -delete` (getrennt nach Modus).
6. Ohne Key: nur lokales Backup, Log-Hinweis. Kein Restore-Test, keine Prüfsumme, keine Verschlüsselung.

### 4.5 `deploy/scripts/update.sh` (33 Zeilen)

`podman auto-update --dry-run --format '{{.Updated}}'`; wenn eine Zeile exakt `true` oder `pending` ist: `twincars-backup-db.sh predeploy` → `podman auto-update` (pullt und restartet nur Container mit `io.containers.autoupdate=registry`, also manager + website). Alle 2 min per Timer; „keine Updates" wird nicht geloggt. Rollback: `podman tag tc.ts13.de:5000/twincars-manager@sha256:<digest> …:latest && systemctl restart manager.service`; DB-Rollback nur per Restore.

### 4.6 `deploy/scripts/provision.sh` (284 Zeilen, idempotent, root)

1. `apt-get install podman catatonit uidmap slirp4netns fuse-overlayfs ufw fail2ban rsync openssl ca-certificates curl wget jq`; prüft `podman-system-generator` (Quadlet, Podman ≥ 4.4).
2. ufw: `default deny incoming`, `allow outgoing`, `allow routed` + `DEFAULT_FORWARD_POLICY=ACCEPT`; erlaubt 22/80/443/5000/5443 tcp. fail2ban nur `[sshd]` (aggressive, maxretry 5, findtime 10m, bantime 1h).
3. Verzeichnisse: `/etc/twincars` (0700), `/etc/twincars/env` (0700), `/etc/twincars/caddy`, `/srv/twincars/data/{postgres,registry,caddy-data,caddy-config}`, `/srv/twincars/backups/pg`, `/etc/containers/systemd`.
4. Secrets (nur wenn Datei fehlt): `postgres.env` (`POSTGRES_PASSWORD=openssl rand -hex 24`), `manager.env` (`NODE_ENV, HOST, PORT, ORIGIN, BETTER_AUTH_URL, DATABASE_URL, APP_ENCRYPTION_KEY=openssl rand -hex 32, BODY_SIZE_LIMIT=67108864` — **ohne `APP_SECRET`, ohne `API_TOKENS`, ohne `EBAY_*`**), `website.env` (`TC_MANAGER_API_TOKEN=openssl rand -hex 32`), `registry.env` (Kopie des Templates), `registry.deploy.pw` (32 Zeichen base64-Derivat). Alle mode 600.
5. Caddyfile rendern (bcrypt via `podman run --rm caddy:2-alpine caddy hash-password`).
6. `/root/.config/containers/auth.json` mit `deploy:<pw>` base64 für `tc.ts13.de:5000`.
7. Installiert Quadlets nach `/etc/containers/systemd/`, Skripte nach `/usr/local/bin/twincars-backup-db.sh` / `twincars-update.sh`, Timer-Units nach `/etc/systemd/system/`.
8. `systemctl daemon-reload`, `systemctl start twincars-pod.service`, `enable --now twincars-backup.timer twincars-update.timer` (manager/website scheitern bis zum ersten Push; `Restart=always`).
9. Wartet bis 90 s auf `http://127.0.0.1/`.
10. Schreibt `/etc/twincars/secrets.firstrun.txt` (600) mit POSTGRES_PASSWORD, APP_ENCRYPTION_KEY, TC_MANAGER_API_TOKEN, Registry-Passwort + „Next steps" und gibt sie einmal aus.

### 4.7 Bootstrap-Ablauf (`deploy/README.md`)

`ssh install -d -m 0700 /etc/twincars` → `scp ssh/twincars-manager $SERVER:/etc/twincars/storagebox.key` (derselbe Key wie für Server-Login) → `rsync deploy/ → /opt/twincars-deploy/` → `bash provision.sh` → Images pushen → Timer übernimmt. Ops-Befehle: `systemctl list-units twincars-* postgres.service manager.service website.service caddy.service registry.service`, `journalctl -u manager.service -e -n 200`, manuelles Backup, Rollback, Restore (`gunzip -c <dump> | ssh … 'podman exec -i postgres psql -U twincars -d twincars'`).

### 4.8 Healthcheck, Logging, Secrets

- `scripts/healthcheck.cjs` (14 Zeilen): `fetch('http://127.0.0.1:${PORT||3000}/')`, 3 s Abort, exit 0 bei Status < 400. `/` liefert für Anonyme 302 → `/login` (oder → `/setup`) → „gesund" ohne DB-Prüfung; kein `/health`-Endpoint im Code.
- Logging: ausschließlich `console.*` → stdout/stderr → Podman → journald (`journalctl -u manager.service`). Keine strukturierten Logs, keine Request-IDs, kein Log-Shipping, kein Caddy-Access-Log, keine Metriken (OTel bewusst zu No-op geshimmt).
- Secrets-Handling: Env-Files mode 600 root; `APP_ENCRYPTION_KEY`-Ableitung SHA-256 → AES-256-GCM (`v1:iv:tag:data`); Registry-Passwort als bcrypt in Caddyfile und Klartext in `registry.deploy.pw` + `auth.json`; Storagebox-Key als Datei. Im Repo-Verzeichnis: `ssh/twincars-manager` (privat, 0600, gitignored), `ssh/twincars-manager.pub`, `ssh/mount-backup-storage.sh` (committed; enthält Storagebox-Account).
- Zielumgebung laut Docs: Hetzner KVM, Debian 13, Podman ≥ 4.4 (Doku: Quadlet `AuthFile=` erst nach Podman 5.4 → Zielversion ~5.4.x), rootful. Postgres 18 (Major-Upgrade manuell, Minor über Image-Pull — praktisch nur bei Neu-Pull, da `Pull=missing` ohne Autoupdate-Label).

---

## 5. Betrieb

### 5.1 Backup/Restore

- Täglich 03:00 (+ ≤ 10 min Jitter) `pg_dump | gzip` → lokal 3 d, Storagebox 14 d; Predeploy-Snapshot vor jedem Auto-Update, lokal/remote 7 d. Verzeichnis `/srv/twincars/backups/pg/`.
- Restore: optional `DROP DATABASE twincars; CREATE DATABASE twincars;` (als `-d postgres`), dann `gunzip -c <dump> | podman exec -i postgres psql -U twincars -d twincars`; beim nächsten Manager-Start laufen neuere Migrationen nach.
- Doku-Abweichung: `backup-and-restore.md` nennt Suffix `_predeploy_<digest>`, Skript erzeugt `<ts>_predeploy.sql.gz` (kein Digest).
- Nicht gesichert: Caddy-Zertifikate/-Config (`/srv/twincars/data/caddy-*`), Registry-Storage, `/etc/twincars/` (Env-Files, Keys) — nur über `secrets.firstrun.txt`/Passwortmanager rekonstruierbar. Binärdaten (PDF-Caches, Fotos, Dokumente, Logo) liegen als bytea in Postgres → im Dump enthalten.
- Restore-Probe: nicht automatisiert (README fordert „mindestens einmal pro Release", kein Skript).

### 5.2 Fresh-DB-Reset (`docs/operations/fresh-db-reset.md`)

- Prod (durchgeführt 2026-06-22): Predeploy-Backup → `systemctl stop manager.service` → `DROP/CREATE DATABASE` → `systemctl start manager.service` (CMD migriert 0000…0037) → `/` leitet auf `/setup`.
- Dev: Rolle `admin` besitzt Schema `public` nicht → `DROP OWNED BY current_user CASCADE` per `node -e "import('postgres')…"`, dann `pnpm db:migrate`, dann `pnpm dev` (Seed beim ersten Request).
- Hintergrund: Dev-DB driftete einst vom Journal (25 Migrationen registriert, tires-Tabellen fehlten) → `db:migrate` scheiterte bei 0026; Migrationen sind per Konvention idempotent (`IF NOT EXISTS`-Guards, `DO $$ … EXCEPTION WHEN duplicate_object`).

### 5.3 Testdatenbank (`docs/operations/test-database.md`, `scripts/seed-test-db.mjs`, `scripts/generate-test-seed.mjs`)

**Einspielen (`node scripts/seed-test-db.mjs`, 183 Zeilen, Sekunden):** `DATABASE_URL` aus Env oder `./.env`; Safety-Gate (nur `localhost/127.0.0.1/::1`, sonst `FORCE_SEED=1`); `DROP TABLE … CASCADE` für alle `public`-Tabellen + `DROP SCHEMA drizzle`; `psql --single-transaction` Restore aus `e2e/fixtures/seed.sql.gz` (gunzip-Stream); `scripts/migrate.js` als Top-up für neuere Migrationen; Zusammenfassung (customers/vehicles/documents/document_items/users). Ergebnis: abgeschlossenes Setup „TwinCars Test GmbH", Admin `e2eadmin` / `e2e-passwort-123`, Seed-Defaults, anonymisierter Legacy-Subset (~300 Kunden, ~150 Fahrzeuge, ~400 Belege, 131 Artikel, 7 Angebote/KV, 1 Lieferant, 2 Reifeneinlagerungen), Anker-Datensätze `SEEDED` (Kunde `E2E-1` „Erika Seedkunde" id `00000000-0000-4000-8000-00000000e201`, Fahrzeug „Volkswagen Seedwagen" id `…e202`, Kennzeichen `B-E2E 1`).

**Erzeugen (`SEED_SOURCE_DATABASE_URL=… node scripts/generate-test-seed.mjs`, 644 Zeilen, Minuten):** Voraussetzungen `./build`, MDB unter `MDB_PATH`, `psql`, `pg_dump`, `mdb-export`, Chromium. Ablauf: (1) Scratch-DB wipen + `migrate.js`; (2) `node build` auf `SEED_SERVER_PORT` (4184) mit `APP_SECRET`-Fallback `e2e-seed-generator-only-not-a-real-secret`; (3) Setup-Wizard headless (Willkommen → Firmendaten → Steuer & Bank → Logo & Anrede → SMTP überspringen → Öffnungszeiten → Administrator → `Setup abschließen`); (4) Login, `/settings/import`: Datei setzen, `Import starten`, `Jetzt importieren`, Job-Polling in `access_import_jobs` bis `progress ≥ 50` oder Label `PDFs erzeugen` (PDF-Phase übersprungen, 45-min-Timeout); (5) Trim (`kept_docs` newest 400 + Storno-/Convert-Partner, `kept_vehicles` referenzierte + Auffüllung 150, `kept_customers` referenzierte + Auffüllung 300), `DELETE FROM document_pdfs, reminder_pdfs`; (6) deterministische Anonymisierung per `hashtext(customer_number)`: Kunden (`Kunde <Nr>`, `Firma <Nr> GmbH`, 20 Vornamen, `Musterstraße N`, `kunde-<nr>@example.com`, `030 …`, `0170 …`, `ebay-kunde-<nr>`; fax/website/birthday/notes/vat_id/IBAN/BIC/bank → NULL), Fahrzeuge (`TESTVIN<md5>`, engine_number/notes NULL), Kennzeichen `B-TC <1000-9999>`, Mitarbeiter (`Max Mitarbeiter <PersNr>`, alle Personal-/Bankfelder NULL), Lieferanten, Belege (header/footer/notes NULL), Zahlungen/Reminder/Reifenlager-Notizen NULL, Kalender `Termin <hash>`; Freitext-Scrub in `document_items.description` (Namens-Regex mit Wortgrenzen, Kennzeichen-Muster → `B-TC 1234`, 17-stellige VIN-Token → `TESTVIN…`, tokenweise `Anonym` gegen alle Original-Namen ≥ 4 Zeichen mit Fahrzeug-Stoplist), gleiches Token-Scrub auf `vehicles.make/model`; Anker-Rows einfügen; `DELETE FROM access_import_jobs, sessions, verifications`; (7) `pg_dump --no-owner --no-privileges --no-comments`, `CREATE SCHEMA public;` entfernt, `CREATE SCHEMA drizzle;` → `IF NOT EXISTS`, gzip Level 9 → `e2e/fixtures/seed.sql.gz`. Scratch-Rolle braucht `GRANT CREATE ON DATABASE` + `GRANT ALL ON SCHEMA public`.

### 5.4 Dev-Umgebung

- `pnpm install`, `cp .env.example .env`, `pnpm db:migrate`, `pnpm dev` → `/setup`.
- Mail-Catcher `node scripts/dev-mail-catcher.js` (104 Zeilen, reines `node:net`): antwortet EHLO/HELO (`250 SIZE 26214400`), MAIL/RCPT/DATA/RSET/NOOP/QUIT, schreibt jede Nachricht als `tmp/mail/<ISO-ts>-<n>.eml`; `smtp_settings` auf `host=127.0.0.1 port=1025 secure=none`. Aktueller `tmp/mail/` ist gefüllt (Runtime-Reste), `tmp/` enthält außerdem alte Ad-hoc-E2E-Skripte/Screenshots (`e2e-ankauf.mjs`, `e2e-0*.png`) und `tmp/pdf-visual/`.
- Playwright-MCP ist laut `known-constraints.md`/`dev-environment.md` defekt (Chrome-Channel, braucht root) → headless `playwright-core` aus dem npx-Cache + `~/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome`. `.playwright-mcp/` liegt (gitignored) im Repo.
- Dev-only-Hydration-Fehler auf Async-Pages (`Failed to hydrate: HierarchyRequestError`) — nur Vite-Dev, Prod hydriert sauber; deshalb laufen E2E immer gegen `node build`.

### 5.5 Bekannte Betriebs-Constraints (`docs/architecture/known-constraints.md`)

- Exakt-Pins `@sveltejs/kit` 2.58.0 / `svelte` 5.56.4 / `@testing-library/svelte` 5.3.1; Svelte nie < 5.56.
- OTel-No-op-Shim darf nicht entfernt werden.
- `src/hooks.ts` muss leeres `transport = {}` bleiben.
- Kein `NODE_ENV` in `.env`.
- `drizzle/meta/` Snapshots eingefroren bei 0007; Runtime-Migrator nutzt nur Journal + SQL; angewendete Migrationen nie editieren.
- Kein In-Process-Scheduler (ADR-009): `autoSendDuePaymentReminders`, Reifen-Erinnerungen etc. sind Button-getriggert, Cron-fähig vorbereitet, aber es existiert **kein** Cron/Timer dafür.
- Rate-Limiter (`src/lib/server/rate-limit.ts`) ist In-Memory, Fixed-Window 60 s (Sign-in 10/min per IP; Public-API 120/min + 60 Burst per Token-Präfix/IP) — Single-Replica-Annahme, bei Scale-out durch Redis zu ersetzen.
- Ein Runtime-Container; Migration-Race per Design ausgeschlossen.

---

## 6. PWA / Service Worker

- `static/manifest.webmanifest` (23 Zeilen): `name "TwinCars Manager"`, `short_name "TwinCars"`, `description "Werkstatt- und Kunden-Manager"`, `start_url "/"`, `scope "/"`, `display "standalone"`, `background_color "#ffffff"`, `theme_color "#1d4ed8"`, `lang "de"`, Icons `/icons/icon-192.png`, `-256.png`, `-384.png`, `-512.png`, `-512-maskable.png` (purpose maskable).
- `static/` (13 Dateien): `icon.png` (1,1 MB Favicon!), `icons/apple-touch-icon-180.png`, `icon-128.webp`, `icon-192.png`, `icon-256.png`, `icon-256.webp`, `icon-384.png`, `icon-512-maskable.png`, `icon-512.png`, `icon-512.webp`, `icon-64.webp`, `manifest.webmanifest`, `robots.txt` (63 Byte). `.gitignore` schützt `static/.svelte-kit/` und `static/node_modules/` (würden in die SW-Asset-Liste leaken).
- `src/app.html` (37 Zeilen): `<html lang="de" data-theme="corporate">`, `<link rel="manifest" href="/manifest.webmanifest">`, Favicons `/icon.png`, `/icons/icon-192.png`, `/icons/icon-512.png`, `apple-touch-icon` 180, `<meta name="theme-color" content="#1d4ed8">`, `data-sveltekit-preload-data="hover"`, Wrapper `<div style="display: contents" class="bg-base-200 text-base-content min-h-dvh">`.
- `src/service-worker.ts` (118 Zeilen, + `service-worker.test.ts` 10 Tests): Cache `twincars-cache-${version}` (`version` = Content-Hash aus `$service-worker` → Cache-Busting pro Deploy). Install: `[...build, ...files.filter(!/.svelte-kit/, !/node_modules/), '/']` einzeln per `cache.add().catch(() => {})` (kein `addAll`), dann `skipWaiting()`. Activate: alle fremden Cache-Keys löschen, `clients.claim()`. Fetch: nur same-origin GET; **Network-first**: erfolgreiche `response.ok && type === 'basic'` werden per `cache.put` gecacht (also auch HTML-Seiten und Remote-Function-GET-Queries), bei Netzfehler Cache-Treffer, bei `mode === 'navigate'` Fallback auf gecachtes `/`.
- Registrierung: `kit.serviceWorker.register: false`; `src/routes/+layout.svelte:62-71` registriert `/service-worker.js` in `onMount` nur wenn `!dev`; in Dev werden alle Registrierungen aktiv deregistriert (Fix `eb77848`, ephemere Vite-URLs).
- Update-Verhalten: `skipWaiting` + `clients.claim` → neuer Worker übernimmt sofort, kein Update-Prompt; alte Caches werden beim Activate gelöscht.
- Offline-Umfang: bewusst nur Shell (Installierbarkeit + Instant-Load); keine Offline-Daten, keine Background-Sync, keine Push-Notifications.

---

## 7. Testbestand

### 7.1 Zusammenfassung

| Art | Dateien | `it(`/`test(`-Aufrufe (statisch gezählt) |
| --- | --- | --- |
| Unit (`src/lib/server`, `src/lib/stores`, `src/lib/utils`, `src/hooks.server.test.ts`, `src/service-worker.test.ts`) | 60 | ≈ 1 145 |
| Visual (PDF-Snapshots, `pdf-visual.test.ts`, Teil des Unit-Scopes) | 1 | 11 (15 Fixture-Dokumente, 17 PNGs in `src/lib/server/services/__pdf_snapshots__/`) |
| Komponenten (`src/lib/components`) | 23 | ≈ 274 |
| Integration (`src/routes`: Remote-Functions/pg-mem, Endpoint-Handler, Route-Komponenten/Pages) | 57 | ≈ 590 |
| **Vitest gesamt** | **140 Dateien** (+ `src/lib/server/db/test-db.ts` Helfer) | **2 020 statisch**; dokumentierter Lauf 2026-07-10: **2 051 passed + 1 skipped in 140 Dateien (~40 s)**; `test:components` = 250 |
| E2E (`e2e/*.spec.ts`) | 12 Specs | **55** (49 statische `test(` + 7 parametrisierte in `smoke.spec.ts`, ~30 s) |
| Smoke-Skript (`scripts/e2e-smoke.mjs`) | 1 | 10 Schritte, ≈ 40 `assert`-Aufrufe |

Mocking: 92 Testdateien nutzen `vi.mock(`; 58 mocken `$lib/server/db/client` per `createTestDb()` (pg-mem); 53 rendern Komponenten (`render(` aus `@testing-library/svelte`); 43 nutzen `user-event`. Skips: 2 (`pdf-visual` self-skip ohne `pdftoppm`, plus 1 dokumentierter Skip).

Coverage: **kein aktueller Report.** `coverage/` (gitignored) stammt vom **2026-05-25T22:36Z** (vor dem Test-Backfill): Statements 15,58 % (2462/15799), Branches 19,32 % (1055/5460), Functions 14,16 % (494/3488), Lines 18,08 % (2017/11154), 178 Dateien in `lcov.info`. Keine `coverage-summary.json`. **Keine Coverage-Schwellen** in `vite.config.ts`.

### 7.2 Tabelle aller Testdateien

Art: U = Unit, V = Visual, K = Komponente (`$lib/components`), I-R = Integration Remote/pg-mem, I-E = Integration Endpoint, I-K = Integration Route-Komponente/Page.

| Pfad | Art | Zeilen | Tests | Inhalt |
| --- | --- | --- | --- | --- |
| `src/hooks.server.test.ts` | U | 328 | 18 | Rate-Limit Sign-in + Public-API, `resolveClientIp`, `handleValidationError`-Feldlabels |
| `src/service-worker.test.ts` | U | 311 | 10 | Install/Activate/Fetch-Strategie des Service Workers |
| `src/lib/components/layout/AppShell.test.ts` | K | 373 | 19 | Loading-Bar/Overlay, Sidebar/User-Block, Global-Search-Trigger, Unsaved-Changes-Guard |
| `src/lib/components/layout/navigation.test.ts` | K | 128 | 11 | `filterNavigationByPermissions` gegen reale Navigation |
| `src/lib/components/layout/PageHeader.test.ts` | K | 72 | 6 | PageHeader |
| `src/lib/components/ui/CompactCustomerCard.test.ts` | K | 59 | 3 | CompactCustomerCard |
| `src/lib/components/ui/ConfirmDialog.test.ts` | K | 282 | 14 | ConfirmDialog (native `<dialog>`, rejecting `onConfirm`) |
| `src/lib/components/ui/CustomerVehiclePicker.test.ts` | K | 305 | 14 | CustomerVehiclePicker |
| `src/lib/components/ui/EmailComposer.test.ts` | K | 57 | 4 | EmailComposer |
| `src/lib/components/ui/EmptyState.test.ts` | K | 36 | 3 | EmptyState |
| `src/lib/components/ui/FormField.test.ts` | K | 97 | 11 | FormField (Harness `FormField.test.harness.svelte`) |
| `src/lib/components/ui/GlobalSearch.test.ts` | K | 309 | 17 | GlobalSearch-Dialog |
| `src/lib/components/ui/ImageUploader.test.ts` | K | 428 | 24 | ImageUploader inkl. Gallery-Modus |
| `src/lib/components/ui/Loader.test.ts` | K | 57 | 8 | Loader-Varianten |
| `src/lib/components/ui/MultiSearchablePicker.test.ts` | K | 378 | 18 | MultiSearchablePicker |
| `src/lib/components/ui/MultiSelect.test.ts` | K | 168 | 10 | MultiSelect |
| `src/lib/components/ui/Pagination.test.ts` | K | 193 | 13 | Pagination (Ellipsis disabled, compact/full) |
| `src/lib/components/ui/PdfViewer.test.ts` | K | 146 | 7 | PdfViewer Blob-iframe |
| `src/lib/components/ui/QuickTimeEntryModal.test.ts` | K | 161 | 7 | QuickTimeEntryModal |
| `src/lib/components/ui/SearchablePicker.test.ts` | K | 498 | 23 | SearchablePicker inkl. Header-„Neu anlegen" |
| `src/lib/components/ui/StatCard.test.ts` | K | 47 | 5 | StatCard |
| `src/lib/components/ui/TabGroup.test.ts` | K | 197 | 15 | TabGroup State- und Nav-Modus (Harness) |
| `src/lib/components/ui/ToastTray.test.ts` | K | 82 | 6 | ToastTray |
| `src/lib/components/ui/Toolbar.test.ts` | K | 49 | 4 | Toolbar |
| `src/lib/components/ui/VehicleDocuments.test.ts` | K | 241 | 9 | VehicleDocuments |
| `src/lib/server/api-tokens.test.ts` | U | 172 | 18 | `verifyApiToken`, `authenticateRequest` (timingSafeEqual, Separatoren) |
| `src/lib/server/auth-permissions.test.ts` | U | 135 | 12 | `hasPermission`, `ALL_PERMISSIONS`, `loadUserPermissions` |
| `src/lib/server/auth-users.test.ts` | U | 214 | 11 | `normaliseUsername`, `createUserWithCredential`, Deaktivierung |
| `src/lib/server/crypto.test.ts` | U | 109 | 9 | AES-GCM `encryptSecret`/`decryptSecret`, `decryptSecretIfNeeded` |
| `src/lib/server/db/seed-defaults.test.ts` | U | 136 | 5 | `seedDefaults` (Work-Order-Ergänzungen) |
| `src/lib/server/db/smtp-settings.test.ts` | U | 85 | 3 | `smtp_settings.password` Verschlüsselung |
| `src/lib/server/db/validation.test.ts` | U | 262 | 45 | Valibot-Schemas (name/email/zip/iban/…) |
| `src/lib/server/rate-limit.test.ts` | U | 107 | 8 | Fixed-Window-Limiter |
| `src/lib/server/services/absence-service.test.ts` | U | 897 | 47 | Abwesenheiten CRUD, Feiertags-Arbeitstage, Overlap-Semantik |
| `src/lib/server/services/calendar-service.test.ts` | U | 777 | 32 | Kalender CRUD, Kollisionen |
| `src/lib/server/services/customer-service.test.ts` | U | 525 | 38 | Kunden CRUD, Nummernkreis, Liste/Suche, Archiv |
| `src/lib/server/services/datev-export-service.test.ts` | U | 416 | 14 | `exportDatevCsv` |
| `src/lib/server/services/document-service.test.ts` | U | 847 | 46 | Belege, Nummern, Rechnungen, Storno |
| `src/lib/server/services/ebay-auth-service.test.ts` | U | 264 | 13 | Konfiguration, `buildAuthorizeUrl`, OAuth-State-CSRF, `exchangeAuthCode` |
| `src/lib/server/services/ebay-listing-service.test.ts` | U | 508 | 14 | `importEbayListings` Happy Path, Idempotenz, Fehler-Mapping |
| `src/lib/server/services/employee-service.test.ts` | U | 394 | 27 | Mitarbeiter CRUD, Gehaltsversionen |
| `src/lib/server/services/holiday-service.test.ts` | U | 346 | 24 | Gauß-Ostern, 16 Bundesländer |
| `src/lib/server/services/import-service.test.ts` | U | 394 | 22 | Trim/Clip, numerische Koerzion, Datumsparsing, Feldmapping |
| `src/lib/server/services/item-service.test.ts` | U | 422 | 27 | Artikel CRUD, Preisversionen |
| `src/lib/server/services/ledger-service.test.ts` | U | 270 | 14 | Buchhaltung Kategorien/Buchungen |
| `src/lib/server/services/mail-service.test.ts` | U | 1576 | 67 | Vorlagen-Rendering, SMTP-Settings, PDF-Anhänge, Broadcast, Testversand |
| `src/lib/server/services/number-range-service.test.ts` | U | 133 | 8 | atomare `allocateNumber` (Lost-Update-Regression) |
| `src/lib/server/services/pdf-service.test.ts` | U | 548 | 30 | Input-Hash, Etikett, Verkaufsschild, Storno-Render |
| `src/lib/server/services/pdf-visual.test.ts` | V | 1147 | 11 | Paginierungsstruktur + deterministisches Rendering, Pixel-Diff (Δ > 32, > 0,5 % → fail) |
| `src/lib/server/services/post-service.test.ts` | U | 181 | 12 | Slugify, CRUD/Publish, Public-Read |
| `src/lib/server/services/public-api-service.test.ts` | U | 256 | 12 | Public-API-Service |
| `src/lib/server/services/qr-service.test.ts` | U | 60 | 7 | `renderQrPng`, `renderQrSvg` |
| `src/lib/server/services/reminder-service.test.ts` | U | 240 | 7 | Zahlungserinnerung, Wiederholung |
| `src/lib/server/services/search-service.test.ts` | U | 674 | 19 | `globalSearch` |
| `src/lib/server/services/settings-service.test.ts` | U | 56 | 3 | `getSettings` |
| `src/lib/server/services/smtp-settings-service.test.ts` | U | 128 | 6 | `upsertSmtpSettings` |
| `src/lib/server/services/supplier-service.test.ts` | U | 154 | 12 | Lieferanten CRUD |
| `src/lib/server/services/time-entry-service.test.ts` | U | 520 | 27 | Zeiterfassung CRUD |
| `src/lib/server/services/tire-reminder-service.test.ts` | U | 302 | 12 | Reifen-Erinnerungen Kandidaten/Preview/Versand |
| `src/lib/server/services/tire-service.test.ts` | U | 461 | 32 | Reifen CRUD, Artikelnummern, Filter |
| `src/lib/server/services/tire-storage-service.test.ts` | U | 309 | 20 | Einlagerung, QR-Lookup, Nummernkreis |
| `src/lib/server/services/vehicle-document-service.test.ts` | U | 257 | 14 | Fahrzeugdokumente, `sanitizeFileName` |
| `src/lib/server/services/vehicle-photo-service.test.ts` | U | 255 | 13 | Fotos (Stock-only) |
| `src/lib/server/services/vehicle-service.test.ts` | U | 1278 | 68 | Fahrzeuge CRUD, Kennzeichen-Versionen, Ankauf/Verkauf, Archiv |
| `src/lib/server/services/work-order-service.test.ts` | U | 1261 | 51 | Aufträge, Termin-Verknüpfung, Abschluss → Rechnung, Storno-Zyklus |
| `src/lib/server/services/workshop-hours-service.test.ts` | U | 174 | 14 | Öffnungszeiten, `isWithinHours` |
| `src/lib/server/services/xrechnung-service.test.ts` | U | 472 | 26 | XRechnung-XML, Pflicht-Stammdaten |
| `src/lib/stores/busy.svelte.test.ts` | U | 119 | 10 | `busy`-Store (active/slow) |
| `src/lib/stores/creation-flow.svelte.test.ts` | U | 276 | 17 | Draft-Stack, sessionStorage, Stale-Drop |
| `src/lib/stores/form-dirty.svelte.test.ts` | U | 35 | 4 | `formDirty` |
| `src/lib/stores/idle-logout.svelte.test.ts` | U | 98 | 7 | `startIdleLogout` |
| `src/lib/stores/page-title.svelte.test.ts` | U | 29 | 3 | `pageTitle` |
| `src/lib/stores/toast.svelte.test.ts` | U | 64 | 6 | Toast-Store |
| `src/lib/utils/client-error.test.ts` | U | 63 | 5 | `handleClientError` |
| `src/lib/utils/ebay-detection.test.ts` | U | 76 | 11 | `isEbayCustomerName` |
| `src/lib/utils/form-validation.svelte.test.ts` | U | 243 | 17 | `useFormValidation`, Klassen-Helfer |
| `src/lib/utils/iban.test.ts` | U | 50 | 7 | IBAN/BIC-Validierung |
| `src/lib/utils/money.test.ts` | U | 74 | 11 | Brutto/Netto/Rundung |
| `src/lib/utils/numbering.test.ts` | U | 50 | 6 | `renderNumber` |
| `src/lib/utils/pagination.test.ts` | U | 57 | 8 | `clampPagination`, `paginationButtons` |
| `src/lib/utils/pdf-download.test.ts` | U | 208 | 11 | Base64→Bytes, `openPdfInNewTab`, Download |
| `src/lib/utils/picker-labels.test.ts` | U | 120 | 11 | Picker-Label-Formate |
| `src/lib/utils/status-labels.test.ts` | U | 119 | 11 | Status-Labels/Badges |
| `src/routes/api/ebay/account-deletion/endpoint.test.ts` | I-E | 146 | 9 | Challenge-Hash, GET-Handshake, POST-Ack |
| `src/routes/api/ebay/oauth/callback/endpoint.test.ts` | I-E | 82 | 4 | `handleOauthCallback` |
| `src/routes/api/public/public-api-security.test.ts` | I-E | 416 | 14 | SQL-Injection-Inputs, Mengen-Grenzen |
| `src/routes/api/public/public-api.test.ts` | I-E | 1479 | 57 | alle Public-Endpoints, Auth-Wrapper |
| `src/routes/calendar/CalendarForm.test.ts` | I-K | 260 | 10 | CalendarForm |
| `src/routes/customers/CustomerForm.test.ts` | I-K | 204 | 13 | CustomerForm |
| `src/routes/customers/customers.remote.test.ts` | I-R | 480 | 18 | Ad-hoc-Mail, Archivieren, Aufträge-Tab |
| `src/routes/customers/[id]/detail-email.test.ts` | I-K | 113 | 3 | E-Mail-Dialog Kundendetail |
| `src/routes/customers/[id]/detail-tabs.test.ts` | I-K | 204 | 6 | Detail-Tabs inkl. Aufträge |
| `src/routes/dashboard.remote.test.ts` | I-R | 310 | 7 | `getDashboardKpis` |
| `src/routes/employees/EmployeeForm.test.ts` | I-K | 229 | 14 | EmployeeForm |
| `src/routes/employees/employees.remote.test.ts` | I-R | 717 | 30 | Absence-Remotes, Guards |
| `src/routes/employees/[id]/AbsenceSection.test.ts` | I-K | 245 | 13 | AbsenceSection |
| `src/routes/hours/HoursForm.test.ts` | I-K | 362 | 17 | HoursForm |
| `src/routes/hours/hours.remote.test.ts` | I-R | 618 | 31 | Guards, `hours:write_own`-Ownership |
| `src/routes/inventory/inventory.remote.test.ts` | I-R | 176 | 4 | `listInventoryRemote` |
| `src/routes/invoices/invoices.remote.test.ts` | I-R | 279 | 6 | Fahrzeug-Transfer bei Zahlung |
| `src/routes/invoices/PositionsEditor.test.ts` | I-K | 292 | 12 | PositionsEditor |
| `src/routes/items/ItemForm.test.ts` | I-K | 102 | 9 | ItemForm |
| `src/routes/ledger/[id]/edit/page.test.ts` | I-K | 82 | 2 | Buchung bearbeiten |
| `src/routes/ledger/new/page.test.ts` | I-K | 67 | 3 | Buchung neu |
| `src/routes/login/page.test.ts` | I-K | 64 | 3 | Login-Page |
| `src/routes/login/sign-in-error.test.ts` | U | 54 | 7 | `signInErrorMessage` |
| `src/routes/mailings/mailings.remote.test.ts` | I-R | 381 | 13 | Broadcast-Preview/Send, Guards |
| `src/routes/mailings/page.test.ts` | I-K | 77 | 3 | Mailings-Page |
| `src/routes/orders/[id]/page.test.ts` | I-K | 214 | 2 | Arbeitserfassungs-Lock |
| `src/routes/orders/orders.remote.test.ts` | I-R | 589 | 17 | Board/CRUD, Status-Moves, Termin-Integration |
| `src/routes/orders/WorkOrderForm.test.ts` | I-K | 371 | 15 | WorkOrderForm, Creation-Flow |
| `src/routes/pickers.remote.test.ts` | I-R | 393 | 21 | alle Picker-Remotes, Guards |
| `src/routes/posts/PostForm.test.ts` | I-K | 85 | 6 | PostForm |
| `src/routes/posts/posts.remote.test.ts` | I-R | 185 | 9 | posts.remote |
| `src/routes/search.remote.test.ts` | I-R | 402 | 23 | `globalSearchRemote` |
| `src/routes/settings/account/account.remote.test.ts` | I-R | 291 | 8 | `changeOwnPasswordRemote` |
| `src/routes/settings/account/page.test.ts` | I-K | 63 | 3 | Konto-Page |
| `src/routes/settings/ebay/ebay-page.test.ts` | I-K | 461 | 14 | eBay-States, Listing-Import-UI |
| `src/routes/settings/ebay/ebay.remote.test.ts` | I-R | 178 | 9 | Permission-Gating, Listing-Import |
| `src/routes/settings/import/page.test.ts` | I-K | 125 | 4 | Import-Page |
| `src/routes/settings/inquiries.remote.test.ts` | I-R | 287 | 9 | Anfragen |
| `src/routes/settings/settings.remote.test.ts` | I-R | 387 | 16 | Stundensatz, Guards |
| `src/routes/settings/SmtpTestSend.test.ts` | I-K | 124 | 6 | SmtpTestSend |
| `src/routes/settings/users/[id]/edit/page.test.ts` | I-K | 95 | 3 | Benutzer bearbeiten |
| `src/routes/settings/users/new/page.test.ts` | I-K | 79 | 2 | Benutzer neu |
| `src/routes/settings/users/roles/RoleForm.test.ts` | I-K | 238 | 14 | RoleForm |
| `src/routes/settings/users/users.remote.test.ts` | I-R | 782 | 39 | Users/Rollen, Guards, Happy Paths |
| `src/routes/settings/workshop-hours/workshop-hours.remote.test.ts` | I-R | 159 | 6 | Öffnungszeiten-Remote |
| `src/routes/setup/setup.remote.test.ts` | I-R | 380 | 15 | Wizard-Schritte, `createInitialAdmin`, SMTP-Secrets |
| `src/routes/setup/wizard.test.ts` | I-K | 296 | 6 | Setup-Wizard-UI |
| `src/routes/suppliers/SupplierForm.test.ts` | I-K | 187 | 11 | SupplierForm |
| `src/routes/tires/TireForm.test.ts` | I-K | 195 | 13 | TireForm |
| `src/routes/tire-storage/labels.remote.test.ts` | I-R | 165 | 4 | Etikett-PDF-Remote |
| `src/routes/tire-storage/TireStorageForm.test.ts` | I-K | 394 | 18 | TireStorageForm, Creation-Flow |
| `src/routes/vehicles/[id]/detail-tabs.test.ts` | I-K | 307 | 9 | Detail-Tabs Bestand/Kundenfahrzeug/Aufträge/Historie |
| `src/routes/vehicles/PurchaseIntoStockModal.test.ts` | I-K | 127 | 7 | Ankauf-Modal |
| `src/routes/vehicles/sale-sign.remote.test.ts` | I-R | 222 | 6 | Verkaufsschild-PDF-Remote |
| `src/routes/vehicles/vehicle-documents.remote.test.ts` | I-R | 310 | 11 | Dokument-Upload/List |
| `src/routes/vehicles/VehicleForm.test.ts` | I-K | 509 | 28 | VehicleForm, Vorbesitzer |
| `src/routes/vehicles/vehicles.remote.test.ts` | I-R | 752 | 34 | Vorbesitzer, Ankauf, Archiv + Delete-Guard |

### 7.3 E2E-Suite (`e2e/`, 12 Specs, 2 051 Zeilen)

**Infrastruktur:** `global-setup.ts` (133), `global-teardown.ts` (22), `helpers.ts` (201): `ADMIN_USERNAME`/`ADMIN_PASSWORD`, `SEEDED`, `uniqueTag`/`uniqueName` (`E2e-<kind>-<tag>`), `login`, `expectToast` (`role="status"`), `expectErrorSummary` (`role="alert"`), `expectPageTitle` (`data-testid="page-title"`, `md:hidden` → Text statt Sichtbarkeit), `fillField`/`fillFieldVerified` (3 Versuche, Guard gegen späte Remote-Query-Reinit), `openDetailTab`/`detailTab` (`getByRole('radio', { name })`), `pickFromSearchablePicker` (Trigger per `hasText`, Dialog per `dialog[open]` + Titel, `getByPlaceholder('Suchen…')`), `clickDialogButton` (`dialog.modal-open, dialog[open].modal` `.last()`), `gotoHydrated` (goto + `networkidle`), `isoDate`.

**Selektor-Strategie (Zählung über alle Specs):** `getByRole` 175, `locator(` 84, `getByText` 32, `getByLabel` 25, `getByPlaceholder` 24, `getByTestId` 20. Rollen-/Label-first; `data-testid` nur für 22 Shell-/Widget-Anker (`page-title`, `header-primary-action`, `user-menu`, `global-search-*`, `multiselect-*`, `pagination-full|compact`, `page-pending`, `wizard-pending`, `last-import`, `add-position`, `global-loading-bar`). Helper-Nutzung: `gotoHydrated` 96, `expectToast` 76, `clickDialogButton` 35, `uniqueName` 30, `SEEDED` 23, `pickFromSearchablePicker` 16, `fillFieldVerified` 9.

| Spec | Tests | Testnamen | Fixture-Abhängigkeit | Besonderheit |
| --- | --- | --- | --- | --- |
| `auth.spec.ts` | 3 | wrong password shows the curated German error · valid credentials log in and land in the app shell · logout returns to the login page and drops the session | Admin `e2eadmin` | `test.use({ storageState: { cookies: [], origins: [] } })` (anonym), `login`-Helper |
| `navigation.spec.ts` | 3 | every sidebar entry navigates to its module · Start dashboard renders stats, quick actions and appointments · global search finds the anchor customer and vehicle | `SEEDED` ×9 | alle Nav-Einträge |
| `customers.spec.ts` | 9 | list renders the seeded customers, 25 per page · search finds the seeded anchor customer by name · kind filter tabs switch the list · pagination pages through and a filter change resets to page 1 · click-time validation shows German summary and field errors · detail tabs render and support ?tab= deep links · edit guards unsaved changes and saves after Bleiben · delete guard refuses a customer with a linked vehicle · create, archive, reactivate and delete a customer | `SEEDED` ×8, ≥ 26 Kunden | Exemplar-Spec |
| `vehicles.spec.ts` | 4 | list renders seeded vehicles and finds the anchor by plate · validation: missing holder and invalid plate produce German errors · lifecycle: create for a customer, Ankauf into stock, archive round trip · inventory can create a stock vehicle directly | `SEEDED` ×6 | — |
| `orders-invoices.spec.ts` | 3 | storno cycle: complete → invoice → Storno → correct → re-complete · Kanban: drag to Abgeschlossen is rejected, click-move works · standalone Teileverkauf invoice with PDF preview | eigene Datensätze | GoBD-Cleanup (bezahlt markieren, archivieren) |
| `employees.spec.ts` | 7 | create employee: validation negatives incl. IBAN, then save · vacation spanning weekend + holiday counts business days only · half-day is only allowed for single-day absences · same-type overlap is rejected with the German range error · vacation↔sick overlap asks to replace and replaces on confirm · year picker switches the balance strip · cleanup: delete absences and the employee | Feiertage berechnet | `test.describe.serial` — Folgetests übersprungen bei Fehler |
| `calendar.spec.ts` | 3 | month grid renders holidays; no "Neuer Auftrag" on the page · Termin form shows the two separated group cards · create a Termin, filter by employee, delete it again | Feiertage | — |
| `hours.spec.ts` | 2 | log a time entry and delete it again · reports page switches between its two tabs | — | — |
| `pdf.spec.ts` | 2 | invoice PDF viewer loads the persisted PDF as a blob iframe · Verkaufsschild for a stock vehicle opens as a PDF tab | `add-position` testid | Blob-iframe, Popup-Tab |
| `settings.spec.ts` | 6 | every settings tab is reachable with exactly one tablist · company form saves with a German success toast · legacy /settings?tab=smtp redirects to /settings/smtp · SMTP Testversand validates the recipient at click time · import rejects non-MDB uploads with a German message · eBay shows the disconnected state and guards the import | 11 Settings-Tabs | — |
| `users.spec.ts` | 3 | create a user and assign the Mitarbeiter role · the limited user sees a filtered sidebar and hits 403 pages · cleanup: delete the user again | Rolle `Mitarbeiter` | `describe.serial`; verschachteltes `describe` mit leerem storageState (frischer Kontext) |
| `smoke.spec.ts` | 4 + 7 | lists render their seeded baseline · Offene Rechnungen: batch action reports nothing due · mailings compose validates at click time · create-validate-cancel: `/tires/new`, `/tire-storage/new`, `/posts/new`, `/ledger/new`, `/items/new`, `/suppliers/new`, `/offers/new` | 7 Angebote, 131 Artikel, 1 Lieferant, 2 Einlagerungen, alle Rechnungen bezahlt | parametrisierte Schleife |

**Login-Helfer:** einmalige echte Anmeldung in `global-setup.ts` → `e2e/.auth/admin.json` (gitignored; `e2e/.auth/` enthält aktuell `admin.json` + `webserver.log`); `login()` in `helpers.ts` nur für anonyme Specs.

**Flakiness-Hinweise aus Docs (`test-database.md`, `known-constraints.md`):** Hydration-Race (immer `gotoHydrated`), Async-Navigation-Old-Page-Fill-Hazard (nach `waitForURL` erst auf Zielinhalt ankern), FormField-Picker-Namen (`getByLabel` mit Feldlabel), Warm-Runs ohne Reseed akkumulieren GoBD-Reste (Reseed empfohlen), `retries: 1` + `trace: on-first-retry` nur unter `CI=1`, Prod-Build-Pflicht (Dev-Hydration-Fehler). Das Smoke-Skript arbeitet mit festen `waitForTimeout`-Sleeps (300–2500 ms) und einer „self-healing" `fillLabeled` (3 Versuche gegen `bind:value`-Reinit).

### 7.4 Lücken (Abgleich `src/routes/*`, Services, Komponenten)

- **Remote-Dateien ohne co-located Test (16 von 38):** `calendar/calendar.remote.ts`, `invoices/xrechnung.remote.ts`, `items/items.remote.ts`, `layout.remote.ts`, `ledger/datev.remote.ts`, `ledger/ledger.remote.ts`, `offers/offers.remote.ts`, `pdfs.remote.ts` (globaler PDF-Zugang!), `reminders/reminders.remote.ts`, `sales-ledger/sales-ledger.remote.ts`, `sent/sent.remote.ts`, `settings/import/import.remote.ts` (MDB-Upload-Pfad), `settings/tire-reminders.remote.ts`, `suppliers/suppliers.remote.ts`, `tires/tires.remote.ts`, `tire-storage/tire-storage.remote.ts`. (Die zugrunde liegenden Services sind meist getestet, die Guard-/Refresh-Schicht nicht.)
- **Route-Module ganz ohne Vitest-Datei:** `offers/`, `reminders/`, `sales-ledger/`, `sent/`. E2E deckt sie nur per Smoke (Liste rendert / leere Validierung).
- **Services ohne Test:** `dashboard-service.ts` (indirekt via `dashboard.remote.test.ts`), `user-admin-service.ts` (indirekt via `users.remote.test.ts`).
- **Server-Root ohne Test:** `auth-guards.ts`, `auth.ts`, `public-api.ts` (indirekt), `otel-noop.ts`; `src/lib/client/auth-client.ts` (vom `test:unit`-Filter nicht erfasst).
- **Komponenten:** alle 25 `$lib/components`-Svelte-Dateien haben Tests (nur die zwei `*.test.harness.svelte` sind Hilfsdateien).
- **Flows ohne E2E:** Offer→Invoice-Konvertierung (nur Smoke-Skript), Mail-Versand real (nur Validierung), DATEV-/XRechnung-Download, Reifen-Erinnerungsversand, eBay-OAuth-Roundtrip, Setup-Wizard (nur im Seed-Generator „getestet"), Posts-Publish/Public-API-Abruf, Import-Durchlauf mit echter MDB (nur Generator), Kunden-Ad-hoc-Mail, Ledger-Monatsansicht/Recurring, PWA-Install/Offline, Idle-Logout, Rate-Limit-429 im Browser.
- **Nicht-funktionale Lücken:** keine Accessibility-Audits (axe), keine Performance-Budgets, keine Last-/Concurrency-Tests (Nummernkreis nur unit-seitig), keine Migrations-Roundtrip-Tests gegen echtes Postgres (pg-mem-Sanitizer entfernt Features), keine Contract-Tests der Public-API gegen die Website.

---

## 8. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung |
| --- | --- | --- | --- | --- | --- |
| B-595 | Keine CI/CD: kein `.github/`, kein `.gitlab-ci.yml`; `test:ci`, `format:check`, `CI`-Zweige in `playwright.config.ts` sind tote Konfiguration. Qualitätssicherung hängt allein am lokalen Husky-Hook (nur Prettier). | Repo-Root, `package.json:23`, `playwright.config.ts:56-58` | Regressionen können ungetestet auf `main`/ins Prod-Image gelangen; Push-to-Deploy ohne Gate. | Pipeline mit `pnpm check`, `pnpm test`, `pnpm test:e2e` (Service-Container Postgres + Seed), Image-Build + Push nur nach grünem Lauf. | im Rewrite beheben |
| B-596 | Coverage-Report veraltet (2026-05-25, 15,6 % Statements) und **keine Coverage-Schwellen**; `coverage.exclude` referenziert nicht existentes `src/lib/server/db/migrate.ts`. | `coverage/index.html`, `vite.config.ts:36-47` | Kein belastbarer Coverage-Wert, kein Absinken erkennbar. | Thresholds definieren, Report in CI erzeugen, Exclude-Liste bereinigen. | im Rewrite beheben |
| B-597 | **`APP_SECRET` wird von `provision.sh` nicht in `manager.env` geschrieben**; `auth.ts` fällt still auf `'dev-only-fallback-secret-do-not-use-prod'` zurück. `API_TOKENS` und `EBAY_*` ebenfalls nicht provisioniert (Website-Token wird erzeugt, aber nicht gespiegelt). | `deploy/scripts/provision.sh:110-121`, `src/lib/server/auth.ts:37`, `docs/operations/environment-variables.md:18` | Sofern nicht manuell nachgetragen, laufen Prod-Session-Cookies mit öffentlich bekanntem HMAC-Secret (Session-Forgery möglich); Public-API fail-closed bis manueller Eingriff. | App muss bei fehlendem Secret in Production **fail-fast** abbrechen; provision.sh muss `APP_SECRET` generieren und `API_TOKENS` = `TC_MANAGER_API_TOKEN` setzen. Prod-Stand verifizieren. | Entscheidung nötig (Prod prüfen), im Rewrite beheben |
| B-598 | Klartext-Default-Credentials im Code: `DATABASE_URL`-Fallback `postgres://admin:TwinCars2026!@…` in `db/client.ts:7` und `drizzle.config.ts:19`; identisch in `.env.example`/README. | `src/lib/server/db/client.ts`, `drizzle.config.ts`, `.env.example:1`, `README.md:91` | App startet ohne Konfiguration gegen eine erratbare DB; Passwort ist Teil der Git-Historie. | Keine Fallbacks für Secrets; `.env.example` mit Platzhaltern. | im Rewrite beheben |
| B-599 | Privater SSH-Key `ssh/twincars-manager` liegt im Repo-Verzeichnis (gitignored), dient **gleichzeitig** als Server-Root-Login und Storagebox-Key; `ssh/mount-backup-storage.sh` (committed) und `backup-db.sh:25` enthalten den Storagebox-Account `u589158`. `.dockerignore` schließt `ssh/` **nicht** aus → Key landet in der Build-Stage-Layer. | `ssh/`, `.dockerignore`, `Dockerfile:22`, `deploy/README.md:22-33` | Key-Leak über Build-Cache/Zwischenimages möglich; ein kompromittierter Key gibt Root auf dem Server und Zugriff auf alle Backups. | Key aus dem Repo-Baum entfernen (Agent/Keychain), getrennte Keys je Zweck, `ssh/` + `e2e/` in `.dockerignore`. | im Rewrite beheben (sofort) |
| B-600 | Sign-in-Rate-Limit vertraut `x-forwarded-for` (erstes Element) ungeprüft; Caddy setzt keine `trusted_proxies`, adapter-node `ADDRESS_HEADER`/`XFF_DEPTH` nicht konfiguriert. | `src/hooks.server.ts:87-98`, `deploy/Caddyfile.tmpl`, `build/handler.js` | Brute-Force-Schutz per gefälschtem Header umgehbar; Public-API-IP-Bucket ebenso. | Proxy-Header nur aus vertrauenswürdiger Quelle akzeptieren (Caddy `trusted_proxies` + `ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1`) oder `getClientAddress()` allein. | im Rewrite beheben |
| B-601 | Healthcheck prüft nur `GET /` → 302 = gesund; keine DB-Probe, kein dedizierter `/health`. Caddy-Healthcheck geht über den öffentlichen Hostnamen (DNS/TLS-Abhängigkeit). | `scripts/healthcheck.cjs`, `deploy/quadlet/manager.container:17`, `caddy.container:16` | Hängende DB-Verbindungen bleiben „healthy"; Auto-Update-Restart-Logik greift nicht. | Health-Endpoint mit DB-Ping (`SELECT 1`) und Readiness/Liveness-Trennung. | im Rewrite beheben |
| B-602 | Container läuft als **root**, keine Ressourcenlimits (`Memory=`, `CPUQuota=`, `PidsLimit=`), kein `ReadOnly`, Base-Image `node:lts-slim` und `mdbtools` ungepinnt. Runtime-Image enthält Dev-Skripte (`e2e-smoke.mjs`, `generate-test-seed.mjs`). | `Dockerfile`, `deploy/quadlet/*.container` | Größere Angriffsfläche (Shell-Exec von `mdb-export`), OOM kann den ganzen Pod destabilisieren, unbeabsichtigte Node-Major-Sprünge. | `USER node`, Major-Pin (`node:24-slim`), Limits in Quadlets, nur `migrate.js`/`healthcheck.cjs` kopieren. | im Rewrite beheben |
| B-603 | Backup nur logisches `pg_dump` (keine Rollen/Globals), kein automatisierter Restore-Test, keine Sicherung von `/etc/twincars/`, Caddy-Zertifikaten, Registry; Doku nennt Suffix `_predeploy_<digest>`, Skript erzeugt `_predeploy`. | `deploy/scripts/backup-db.sh`, `docs/operations/backup-and-restore.md:27` | Wiederherstellung ungeprüft; Verlust der Env-Files = Verlust von `APP_ENCRYPTION_KEY` → verschlüsselte SMTP-/eBay-Secrets unlesbar. | Restore-Drill als Timer/CI-Job, `/etc/twincars` mitsichern (verschlüsselt), Doku angleichen. | bewusst später (Ops), Doku sofort |
| B-604 | Service Worker cached **alle** erfolgreichen same-origin GETs (HTML mit Session-Kontext, Remote-Query-Antworten) in CacheStorage; kein Purge bei Logout. | `src/service-worker.ts:99-108` | Geschäftsdaten bleiben auf dem Gerät nach Logout lesbar (Shared-Device-Risiko); Offline zeigt veraltete Daten ohne Hinweis. | Cache auf Build-Assets beschränken (Precache-only), Navigations-Fallback separat; Cache bei Logout leeren. | im Rewrite beheben |
| B-605 | Zwei-Minuten-Auto-Update auf `:latest` ohne Freigabe/Staging; Rollback manuell per Digest; Migrations-Rollback nur per DB-Restore. `Pull=missing` ohne Autoupdate für postgres/caddy/registry → Minor-Sicherheitsupdates werden nie gezogen. | `deploy/scripts/update.sh`, `deploy/quadlet/*.container` | Jeder Push geht ungeprüft live; Infrastruktur-Images veralten. | Versionierte Tags + expliziter Deploy-Schritt; regelmäßiges Pull der Basis-Images. | Entscheidung nötig |
| B-606 | Registry weltweit auf :5000 erreichbar (nur Caddy basic_auth, 4 GB Body, `REGISTRY_STORAGE_DELETE_ENABLED=true`, keine GC); Manager-Admin auf :5443 ohne IP-/Client-Cert-Restriktion; fail2ban nur für sshd. | `deploy/Caddyfile.tmpl:64-81`, `provision.sh:55-73` | Öffentliche Angriffsfläche für Registry und Login. | Registry auf VPN/IP-Allowlist oder GHCR; Login-Fail2ban-Jail über Caddy-Logs; Admin-App ggf. hinter Allowlist. | Entscheidung nötig |
| B-607 | Kein Logging-/Observability-Konzept: nur `console.*` → journald; kein Caddy-Access-Log; keine Request-IDs; OTel per Design deaktiviert; kein Alerting (Backup-Fehler, Health-Fail). | `deploy/Caddyfile.tmpl`, `vite.config.ts:27`, `src/hooks.server.ts` | Vorfälle schwer nachvollziehbar; stille Backup-Ausfälle. | Strukturierte JSON-Logs, Access-Log, minimales Alerting (systemd `OnFailure=`). | im Rewrite beheben (Basis), bewusst später (Alerting) |
| B-608 | Drei verschiedene DB-Engines im Lebenszyklus: Prod `postgres:18-alpine`, Dev `17.11`, Tests `pg-mem` (Regex-sanitisierte Migrationen, JSONB-Einschränkungen). | `deploy/quadlet/postgres.container:7`, `src/lib/server/db/test-db.ts` | Migrations-/Query-Fehler werden erst in Prod sichtbar. | Integrationstests gegen echtes Postgres (Testcontainer/Service), pg-mem nur für schnelle Unit-Läufe. | im Rewrite beheben |
| B-609 | `drizzle/meta`-Snapshots eingefroren bei 0007 (9 Dateien / 38 Migrationen); `db:generate` diffst gegen veralteten Stand, Migrationen werden manuell geschrieben. | `drizzle/meta/`, `docs/architecture/known-constraints.md:65-67` | Generator unbrauchbar, Schema-Drift-Risiko. | Im Rewrite Snapshot-Kette neu aufsetzen (Baseline-Migration). | im Rewrite beheben |
| B-610 | E2E-Chromium-Pfad hartcodiert auf `/home/nick/.cache/ms-playwright/chromium-1226/…`; `fullyParallel: false`; zwei Specs `describe.serial` mit „cleanup"-Tests; Warm-Runs akkumulieren GoBD-Reste; Smoke-Skript mit festen Sleeps. | `playwright.config.ts:42-46`, `scripts/generate-test-seed.mjs:75`, `e2e/employees.spec.ts:42`, `e2e/users.spec.ts:24`, `scripts/e2e-smoke.mjs` | Suite nicht portabel (CI, andere Entwickler), Reihenfolge-Abhängigkeiten, Timing-Flakes. | `playwright install chromium` in CI zulassen, Pfad nur per Env; Fixtures pro Test isolieren; Smoke-Skript in die Suite überführen. | im Rewrite beheben |
| B-611 | README-Stale-Angaben: Base-Image `node:lts-alpine` (real `lts-slim`), `package-lock.json` (real `pnpm-lock.yaml`), nicht existente `src/lib/server/utils/crypto.test.ts` und `src/lib/server/db/migrate.ts`, Beispiel-`.env` mit `NODE_ENV=development` entgegen `.env.example`-Warnung, „6 Schritte"-Wizard (Generator fährt 8 Screens). `EBAY_DEV_ID` nur in Doku. | `README.md:82-96,155,162,262,569`, `docs/operations/environment-variables.md:27` | Fehlleitung bei Rewrite-Planung. | Doku bereinigen bzw. im Rewrite neu schreiben. | im Rewrite beheben |
| B-612 | Operator-getriggerte Wiederholjobs (Zahlungserinnerungen, Reifen-Erinnerungen) haben **keinen** Timer/Cron, obwohl „cron-fähig" vorbereitet. | ADR-009, `docs/architecture/known-constraints.md:70-72` | Erinnerungen bleiben liegen, wenn niemand klickt. | Im Rewrite: Nitro-Task/Cron oder systemd-Timer gegen einen internen, token-geschützten Endpoint. | Entscheidung nötig |
| B-613 | Body-Limit an drei Stellen unterschiedlich notiert (`64M` Dockerfile, `67108864` manager.env, `64MB` Caddy, „60 Mio. Zeichen" README); MDB-Upload als Base64 durch die Remote-Function (~33 % Overhead, RAM-Spitze). | `Dockerfile:48`, `provision.sh:120`, `Caddyfile.tmpl:53`, `README.md:536` | Konsistenz-Risiko, Speicherbedarf im Import. | Einen Wert als Quelle; Upload als Multipart/Stream. | im Rewrite beheben |
| B-614 | `static/icon.png` ist 1,1 MB und als Favicon verlinkt; wird vom Service Worker vorgecacht. | `static/icon.png`, `src/app.html:8` | Unnötige Ladezeit auf jedem Erstbesuch. | Kleines Favicon (≤ 32 KB), Original entfernen. | im Rewrite beheben |
| B-615 | Repo-Baum enthält Laufzeit-Reste: `tmp/` (Screenshots, Ad-hoc-E2E-Skripte, Mails, PDF-Diffs), `.playwright-mcp/`, `e2e/.auth/`, `test-results/`, `coverage/`, `build/`, `.svelte-kit/` — alle gitignored, aber im Docker-Build-Kontext teils nicht ausgeschlossen (`e2e/.auth`, `test-results`, `.playwright-mcp`). | `.dockerignore`, Arbeitsverzeichnis | Aufgeblähter Build-Kontext, potenzielle Session-Leaks (`e2e/.auth/admin.json` enthält Session-Cookie). | `.dockerignore` erweitern; Build aus sauberem Checkout. | im Rewrite beheben |
| B-616 | Kein ESLint/Typ-Lint im Hook, nur Prettier; `svelte-check` läuft nur manuell. | `.husky/pre-commit`, `package.json` | Typfehler/Unused Code können committed werden. | Lint + `check` in CI (siehe B-595). | im Rewrite beheben |
| B-617 | `seedDefaults()` läuft im Request-Pfad (erster Request) mit prozesslokalem Guard; bei mehreren Instanzen/Restarts parallel. | `src/hooks.server.ts:41-53` | Bei Scale-out doppelte Seeds/Races; erster Request langsam. | Seed in den Migrations-/Startschritt verlagern. | im Rewrite beheben |

---

## 9. Gelesene Dateien (Datei · Zeilenzahl)

| Datei | Zeilen |
| --- | --- |
| `package.json` | 78 |
| `pnpm-workspace.yaml` | 6 |
| `.npmrc` | 1 |
| `tsconfig.json` | 20 |
| `svelte.config.js` | 22 |
| `vite.config.ts` | 50 |
| `vitest.setup.ts` | 1 |
| `playwright.config.ts` | 78 |
| `.prettierrc` | 19 |
| `.prettierignore` | 40 |
| `.husky/pre-commit` (+ `.husky/_/` Listing) | 1 |
| `.gitignore` | 58 |
| `.dockerignore` | 16 |
| `.env.example` | 58 |
| `drizzle.config.ts` | 23 |
| `.vscode/extensions.json` | 3 |
| `Dockerfile` | 65 |
| `deploy/README.md` | 95 |
| `deploy/Caddyfile.tmpl` | 81 |
| `deploy/env-templates/registry.env` | 8 |
| `deploy/quadlet/caddy.container` | 27 |
| `deploy/quadlet/manager.container` | 30 |
| `deploy/quadlet/postgres.container` | 24 |
| `deploy/quadlet/registry.container` | 22 |
| `deploy/quadlet/website.container` | 25 |
| `deploy/quadlet/twincars.pod` | 19 |
| `deploy/scripts/backup-db.sh` | 102 |
| `deploy/scripts/provision.sh` | 284 |
| `deploy/scripts/update.sh` | 33 |
| `deploy/systemd/twincars-backup.service` | 14 |
| `deploy/systemd/twincars-backup.timer` | 12 |
| `deploy/systemd/twincars-update.service` | 12 |
| `deploy/systemd/twincars-update.timer` | 12 |
| `scripts/dev-mail-catcher.js` | 104 |
| `scripts/e2e-smoke.mjs` | 578 |
| `scripts/generate-test-seed.mjs` | 644 |
| `scripts/healthcheck.cjs` | 14 |
| `scripts/migrate.js` | 53 |
| `scripts/seed-test-db.mjs` | 183 |
| `docs/operations/backup-and-restore.md` | 46 |
| `docs/operations/deployment.md` | 73 |
| `docs/operations/dev-environment.md` | 69 |
| `docs/operations/e2e-smoke.md` | 73 |
| `docs/operations/environment-variables.md` | 50 |
| `docs/operations/fresh-db-reset.md` | 39 |
| `docs/operations/test-database.md` | 218 |
| `docs/architecture/known-constraints.md` | 74 |
| `docs/architecture/pwa-service-worker.md` | 38 |
| `docs/releases/v1.4.0.md` | 128 |
| `docs/INDEX.md` | 107 |
| `README.md` | 618 |
| `CONTRIBUTING.md` (§2, §3, §13, §14, §15, §17 vollständig; Überschriftenindex komplett) | 1474 |
| `e2e/global-setup.ts` | 133 |
| `e2e/global-teardown.ts` | 22 |
| `e2e/helpers.ts` | 201 |
| `e2e/smoke.spec.ts` (vollständig); übrige 11 Specs: Testnamen/Imports/Serial-Marker per grep | 134 / 1917 |
| `static/manifest.webmanifest` (+ Dateiliste `static/`) | 23 |
| `src/service-worker.ts` | 118 |
| `src/app.html` | 37 |
| `src/app.d.ts` | 21 |
| `src/app.css` | 19 |
| `src/lib/server/otel-noop.ts` | 75 |
| `src/lib/server/db/client.ts` | 22 |
| `src/lib/server/db/test-db.ts` (Kopf, Z. 1-45) | 45 |
| `src/lib/server/auth.ts` (Z. 28-50) | 71 |
| `src/lib/server/rate-limit.ts` (Z. 1-30) | — |
| `src/hooks.server.ts` (Z. 28-104, 105-165) | 470 |
| `src/routes/+layout.svelte` (Z. 50-80) | 88 |
| `src/lib/server/services/import-service.ts` (Z. 130-160, Temp-File-Zeilen) | — |
| `ssh/mount-backup-storage.sh` | 32 |
| `coverage/index.html` (Kopfzahlen) | — |
| `pnpm-lock.yaml` (importers-Block) | — |
| `build/index.js`, `build/handler.js` (Env-Aufrufe per grep) | — |
| 140 × `src/**/*.test.ts` (Zeilen, `it/test`-Zähler, `describe`-Namen per grep) | 41 196 gesamt |

Gesamt vollständig gelesene Dateien: 66 (≈ 7 400 Zeilen) plus grep-basierte Auswertung von 12 E2E-Specs, 140 Vitest-Dateien, Lockfile und Build-Output.
