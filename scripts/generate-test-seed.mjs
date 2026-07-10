#!/usr/bin/env node
/**
 * (Re)generate the committed E2E seed fixture
 * `e2e/fixtures/seed.sql.gz` from the local legacy Access database.
 *
 * Design (see docs/operations/test-database.md for the long form):
 * the fixture is a full `pg_dump` (schema + data, --no-owner) of a
 * scratch database that this script prepares end to end through the
 * REAL application code paths — no hand-mirrored schema, no
 * re-implemented password hashing:
 *
 *   1. Wipe the scratch DB and apply all migrations.
 *   2. Start the production build (`node build`) against it.
 *   3. Drive the actual setup wizard headlessly (company data, SMTP
 *      skipped, default hours, admin `e2eadmin` / `e2e-passwort-123`).
 *   4. Run the in-app KFZ-Kaufmann import with the local .mdb. The
 *      import is stopped once the data phase is complete (the final
 *      PDF pre-render phase is skipped — the fixture ships without
 *      PDF caches; the app re-renders on demand).
 *   5. Trim to a small, referentially-intact subset (~400 newest
 *      documents incl. storno/convert partners, ~150 vehicles, their
 *      customers topped up to ~300) and ANONYMIZE all personal data
 *      deterministically (names, addresses, mails, phones, IBANs,
 *      VINs, plates, free-text scrubbing).
 *   6. Insert canonical anchor rows the specs assert on (customer
 *      "Seedkunde" E2E-1, vehicle "Seedwagen" B-E2E 1 — see
 *      e2e/helpers.ts) and drop sessions / import jobs.
 *   7. `pg_dump | gzip` → e2e/fixtures/seed.sql.gz (commit the result).
 *
 * The committed fixture contains NO real personal data and NO .mdb
 * content beyond the anonymized subset. The .mdb itself must never be
 * committed (CLAUDE.md).
 *
 * Requirements:
 *   - `pnpm build` ran (./build exists)
 *   - the legacy MDB at MDB_PATH (default
 *     /home/nick/tc/Daten/kfz-kaufmann-test.mdb)
 *   - mdbtools, psql, pg_dump on the PATH
 *   - a Chromium binary (CHROMIUM_PATH or the cached default)
 *
 * Environment:
 *   SEED_SOURCE_DATABASE_URL  (REQUIRED) scratch DB that will be WIPED
 *   MDB_PATH                  path to the legacy .mdb
 *   SEED_SERVER_PORT          port for the temporary server (4184)
 *   CHROMIUM_PATH             chromium executable override
 *   KEEP_DOCUMENTS / KEEP_VEHICLES / KEEP_CUSTOMERS  trim caps
 *
 * Usage:
 *   SEED_SOURCE_DATABASE_URL=postgres://admin:…@localhost:5432/twincars-e2e \
 *     node scripts/generate-test-seed.mjs
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import postgres from 'postgres'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'e2e', 'fixtures', 'seed.sql.gz')

const DB_URL = process.env.SEED_SOURCE_DATABASE_URL
const MDB_PATH =
  process.env.MDB_PATH ?? '/home/nick/tc/Daten/kfz-kaufmann-test.mdb'
const PORT = Number(process.env.SEED_SERVER_PORT ?? 4184)
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_USER = 'e2eadmin'
const ADMIN_PASSWORD = 'e2e-passwort-123'
const KEEP_DOCUMENTS = Number(process.env.KEEP_DOCUMENTS ?? 400)
const KEEP_VEHICLES = Number(process.env.KEEP_VEHICLES ?? 150)
const KEEP_CUSTOMERS = Number(process.env.KEEP_CUSTOMERS ?? 300)

const CACHED_CHROMIUM =
  '/home/nick/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome'
const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync(CACHED_CHROMIUM) ? CACHED_CHROMIUM : undefined)

const die = (msg) => {
  console.error(`[generate-seed] ${msg}`)
  process.exit(1)
}
const log = (msg) => console.log(`[generate-seed] ${msg}`)

/* ── Preconditions ─────────────────────────────────────────────────── */
if (!DB_URL) {
  die(
    'SEED_SOURCE_DATABASE_URL is required (a scratch database — it will be WIPED).'
  )
}
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
if (!LOCAL_HOSTS.has(new URL(DB_URL).hostname)) {
  die('SEED_SOURCE_DATABASE_URL must point at a local database.')
}
if (!existsSync(MDB_PATH)) die(`MDB not found: ${MDB_PATH} (set MDB_PATH).`)
if (!existsSync(join(ROOT, 'build', 'index.js'))) {
  die('./build missing — run `pnpm build` first.')
}
for (const bin of ['psql', 'pg_dump', 'mdb-export']) {
  if (spawnSync(bin, ['--version'], { stdio: 'ignore' }).status !== 0) {
    die(`\`${bin}\` is not available on the PATH.`)
  }
}

const psql = (input, extraArgs = []) =>
  spawnSync('psql', [DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', ...extraArgs], {
    input,
    stdio: ['pipe', 'inherit', 'inherit']
  })

/* ── 1. Wipe scratch DB + migrate ──────────────────────────────────── */
log(`wiping scratch database and applying migrations …`)
const RESET_SQL = `
DO $reset$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END
$reset$;
DROP SCHEMA IF EXISTS drizzle CASCADE;
`
if (psql(RESET_SQL, ['-q']).status !== 0) die('scratch reset failed.')
const migrate = spawnSync(process.execPath, ['scripts/migrate.js'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: DB_URL }
})
if (migrate.status !== 0) die('migrations failed.')

/* ── 2. Start the production build against the scratch DB ─────────── */
log(`starting \`node build\` on ${BASE} …`)
const server = spawn(process.execPath, ['build'], {
  cwd: ROOT,
  env: {
    ...process.env,
    DATABASE_URL: DB_URL,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    ORIGIN: BASE,
    BETTER_AUTH_URL: BASE,
    BODY_SIZE_LIMIT: '64M',
    APP_SECRET:
      process.env.APP_SECRET ?? 'e2e-seed-generator-only-not-a-real-secret'
  },
  stdio: ['ignore', 'inherit', 'inherit']
})
const stopServer = async () => {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const t = setTimeout(() => {
      server.kill('SIGKILL')
      resolve()
    }, 10_000)
    server.once('exit', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

const waitForServer = async () => {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      await fetch(BASE, { redirect: 'manual' })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('server did not come up within 60s')
}

const sql = postgres(DB_URL, { max: 1, onnotice: () => {} })

try {
  await waitForServer()

  /* ── 3. Drive the setup wizard + admin creation headlessly ──────── */
  log('driving the setup wizard …')
  const browser = await chromium.launch({
    headless: true,
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    args: ['--no-sandbox']
  })
  try {
    const page = await browser.newPage({ baseURL: BASE })
    page.setDefaultTimeout(30_000)
    const weiter = () => page.getByRole('button', { name: 'Weiter' }).click()

    await page.goto('/setup', { waitUntil: 'networkidle' })
    await page.getByText('Willkommen!').waitFor()
    await weiter()

    // Step 2 — Firmendaten
    await page.getByLabel('Firmenname').fill('TwinCars Test GmbH')
    await page.getByLabel('Straße + Hausnummer').fill('Teststraße 1')
    await page.getByLabel('PLZ').fill('10115')
    await page.getByLabel('Ort').fill('Berlin')
    await page.getByLabel('Telefon').first().fill('030 1234567')
    await page.getByLabel('E-Mail').fill('werkstatt@twincars-test.example')
    await weiter()

    // Step 3 — Steuer & Bank
    await page.getByLabel('Steuernummer').fill('30/123/45678')
    await page.getByLabel('Bankname').fill('Testbank Berlin')
    await page.getByLabel('IBAN').fill('DE89370400440532013000')
    await page.getByLabel('BIC').fill('COBADEFFXXX')
    await weiter()

    // Step 4 — Logo & Anrede (defaults) → persists company data
    await page.getByText('Logo und Anrede').waitFor()
    await weiter()

    // Step 5 — SMTP: skip
    await page.getByRole('checkbox').first().check()
    await weiter()

    // Step 6 — Öffnungszeiten (defaults)
    await page.getByText('Werkstatt-Öffnungszeiten').waitFor()
    await weiter()

    // Step 7 — Administrator
    await page.getByLabel('Benutzername').fill(ADMIN_USER)
    await page.getByLabel('Anzeigename').fill('E2E Admin')
    await page.locator('input[type=password]').nth(0).fill(ADMIN_PASSWORD)
    await page.locator('input[type=password]').nth(1).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    // Step 8 — finish
    await page.getByRole('button', { name: 'Setup abschließen' }).click()
    await page.waitForURL(/\/login/)
    log('setup completed, admin account created.')

    /* ── 4. Log in and run the real MDB import ──────────────────────── */
    await page.getByLabel('Benutzername').fill(ADMIN_USER)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))

    log(`starting the KFZ-Kaufmann import (${MDB_PATH}) …`)
    await page.goto('/settings/import', { waitUntil: 'networkidle' })
    await page.locator('input[type=file]').setInputFiles(MDB_PATH)
    await page.getByRole('button', { name: 'Import starten' }).click()
    await page.getByRole('button', { name: 'Jetzt importieren' }).click()

    /* Poll the job row until the data phase is done. The final phase
     * (PDF pre-render, progress 50→99) is skipped: we delete all PDF
     * caches anyway, and the app re-renders on demand. If the phase
     * labels ever change, the fallback is simply to wait for `done`. */
    const deadline = Date.now() + 45 * 60_000
    let lastLabel = ''
    for (;;) {
      if (Date.now() > deadline) throw new Error('import timed out (45min)')
      const [job] = await sql`
        SELECT status, progress, progress_label
        FROM access_import_jobs
        ORDER BY started_at DESC
        LIMIT 1
      `
      if (job) {
        if (job.progress_label !== lastLabel) {
          lastLabel = job.progress_label ?? ''
          log(`  import: ${job.progress}% — ${lastLabel}`)
        }
        if (job.status === 'failed') throw new Error('import job failed')
        if (
          job.status === 'done' ||
          Number(job.progress) >= 50 ||
          (job.progress_label ?? '').startsWith('PDFs erzeugen')
        ) {
          break
        }
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    log('data phase complete — stopping the server (PDF phase skipped).')
  } finally {
    await browser.close()
  }
  await stopServer()

  /* ── 5+6. Trim, anonymize, anchor rows, cleanup ─────────────────── */
  log('trimming and anonymizing …')
  const TRIM_SQL = `
BEGIN;

/* Kept documents: newest ${KEEP_DOCUMENTS} + storno/convert partners. */
CREATE TEMP TABLE kept_docs ON COMMIT DROP AS
SELECT id FROM documents
ORDER BY issue_date DESC, document_number DESC
LIMIT ${KEEP_DOCUMENTS};

INSERT INTO kept_docs
SELECT DISTINCT linked FROM (
  SELECT d.cancelled_by_document_id AS linked
    FROM documents d JOIN kept_docs k ON k.id = d.id
  UNION ALL
  SELECT d.cancels_document_id
    FROM documents d JOIN kept_docs k ON k.id = d.id
  UNION ALL
  SELECT d.converted_to_invoice_id
    FROM documents d JOIN kept_docs k ON k.id = d.id
) x
WHERE linked IS NOT NULL AND linked NOT IN (SELECT id FROM kept_docs);

/* Kept vehicles: referenced by kept docs / tire storage + newest fill. */
CREATE TEMP TABLE kept_vehicles ON COMMIT DROP AS
SELECT DISTINCT d.vehicle_id AS id
  FROM documents d JOIN kept_docs k ON k.id = d.id
 WHERE d.vehicle_id IS NOT NULL
UNION
SELECT ts.vehicle_id FROM tire_storage ts WHERE ts.vehicle_id IS NOT NULL;

INSERT INTO kept_vehicles
SELECT v.id FROM vehicles v
WHERE v.id NOT IN (SELECT id FROM kept_vehicles)
ORDER BY v.created_at DESC, v.id
LIMIT GREATEST(0, ${KEEP_VEHICLES} - (SELECT count(*) FROM kept_vehicles));

/* Kept customers: everyone kept docs / vehicles / tire storage
 * reference (referential wholeness beats the cap), topped up to
 * ~${KEEP_CUSTOMERS} with the highest customer numbers. */
CREATE TEMP TABLE kept_customers ON COMMIT DROP AS
SELECT DISTINCT d.customer_id AS id
  FROM documents d JOIN kept_docs k ON k.id = d.id
 WHERE d.customer_id IS NOT NULL
UNION
SELECT ts.customer_id FROM tire_storage ts
UNION
SELECT v.customer_id FROM vehicles v
  JOIN kept_vehicles kv ON kv.id = v.id
 WHERE v.customer_id IS NOT NULL
UNION
SELECT v.previous_owner_customer_id FROM vehicles v
  JOIN kept_vehicles kv ON kv.id = v.id
 WHERE v.previous_owner_customer_id IS NOT NULL;

INSERT INTO kept_customers
SELECT c.id FROM customers c
WHERE c.id NOT IN (SELECT id FROM kept_customers)
ORDER BY length(c.customer_number) DESC, c.customer_number DESC
LIMIT GREATEST(0, ${KEEP_CUSTOMERS} - (SELECT count(*) FROM kept_customers));

/* ALL original single-word names (captured BEFORE the trim) — used by
 * the token-level scrub below, because free text (vehicle models,
 * position descriptions) may mention customers that get trimmed away.
 * A small stoplist avoids over-scrubbing common vehicle vocabulary
 * that doubles as a surname. */
CREATE TEMP TABLE all_orig_names ON COMMIT DROP AS
SELECT DISTINCT trim(last_name) AS name FROM customers
 WHERE last_name IS NOT NULL
   AND length(trim(last_name)) >= 4
   AND trim(last_name) !~ '\\s'
UNION
SELECT DISTINCT trim(company) FROM customers
 WHERE company IS NOT NULL
   AND length(trim(company)) >= 4
   AND trim(company) !~ '\\s';
DELETE FROM all_orig_names WHERE name IN
  ('Golf','Polo','Passat','Caddy','Kombi','Variant','Touran','Tiguan',
   'Sharan','Astra','Corsa','Combo','Zafira','Meriva','Agila','Focus',
   'Fiesta','Transit','Mondeo','Vito','Viano','Sprinter','Splash',
   'Swift','Carens','Clio','Megane','Twingo','Kangoo','Micra','Leon',
   'Ibiza','Octavia','Fabia','Superb','Berlingo','Ducato','Boxer',
   'Jumper','Anhänger','Wohnmobil','Roller');
CREATE INDEX ON all_orig_names (name);

/* Trim (FK cascades take document items/payments/pdfs, reminders,
 * plate versions along; calendar entries only lose their links). */
DELETE FROM documents WHERE id NOT IN (SELECT id FROM kept_docs);
DELETE FROM vehicles  WHERE id NOT IN (SELECT id FROM kept_vehicles);
DELETE FROM customers WHERE id NOT IN (SELECT id FROM kept_customers);

/* No binary blobs in the fixture: PDFs re-render on demand. */
DELETE FROM document_pdfs;
DELETE FROM reminder_pdfs;

/* Original name map — needed for the free-text scrub below. */
CREATE TEMP TABLE name_map ON COMMIT DROP AS
SELECT c.customer_number,
       NULLIF(trim(c.last_name), '') AS orig_last_name,
       NULLIF(trim(c.company), '')   AS orig_company
FROM customers c;

/* ── Anonymization (deterministic per customer number) ────────────── */
UPDATE customers c SET
  last_name   = CASE WHEN c.last_name IS NOT NULL
                     THEN 'Kunde ' || c.customer_number END,
  first_name  = CASE WHEN c.first_name IS NOT NULL
                     THEN (ARRAY['Alex','Bernd','Claudia','Daniel','Elke',
                                 'Frank','Gisela','Hans','Ines','Jan',
                                 'Karin','Lutz','Maria','Nils','Olga',
                                 'Peter','Rita','Stefan','Tanja','Uwe'])
                          [1 + (abs(hashtext(c.customer_number)::bigint) % 20)] END,
  company     = CASE WHEN c.company IS NOT NULL
                     THEN 'Firma ' || c.customer_number || ' GmbH' END,
  street      = CASE WHEN c.street IS NOT NULL
                     THEN 'Musterstraße ' ||
                          (1 + abs(hashtext(c.customer_number || 's')::bigint) % 120) END,
  email       = CASE WHEN c.email IS NOT NULL
                     THEN 'kunde-' ||
                          lower(regexp_replace(c.customer_number, '[^A-Za-z0-9]', '', 'g')) ||
                          '@example.com' END,
  phone       = CASE WHEN c.phone IS NOT NULL
                     THEN '030 ' || lpad((abs(hashtext(c.customer_number || 'p')::bigint) % 1000000)::text, 6, '0') END,
  phone2      = CASE WHEN c.phone2 IS NOT NULL
                     THEN '030 ' || lpad((abs(hashtext(c.customer_number || 'q')::bigint) % 1000000)::text, 6, '0') END,
  mobile      = CASE WHEN c.mobile IS NOT NULL
                     THEN '0170 ' || lpad((abs(hashtext(c.customer_number || 'm')::bigint) % 10000000)::text, 7, '0') END,
  fax         = NULL,
  website     = NULL,
  birthday    = NULL,
  notes       = NULL,
  vat_id      = NULL,
  bank_iban   = NULL,
  bank_bic    = NULL,
  bank_name   = NULL,
  ebay_handle = CASE WHEN c.ebay_handle IS NOT NULL
                     THEN 'ebay-kunde-' ||
                          lower(regexp_replace(c.customer_number, '[^A-Za-z0-9]', '', 'g')) END;

UPDATE vehicles v SET
  vin           = CASE WHEN v.vin IS NOT NULL
                       THEN 'TESTVIN' || upper(substr(md5(v.id::text), 1, 10)) END,
  engine_number = NULL,
  notes         = NULL;

UPDATE vehicle_license_plate_versions p SET
  license_plate = 'B-TC ' || (1000 + abs(hashtext(p.id::text)::bigint) % 9000);

UPDATE employees e SET
  first_name              = 'Max',
  last_name               = 'Mitarbeiter ' || e.personnel_number,
  birthday                = NULL,
  birthplace              = NULL,
  street                  = NULL,
  private_email           = NULL,
  private_phone           = NULL,
  mobile                  = NULL,
  tax_id                  = NULL,
  social_insurance_number = NULL,
  health_insurance        = NULL,
  bank_account_holder     = NULL,
  bank_iban               = NULL,
  bank_bic                = NULL,
  bank_name               = NULL;

UPDATE suppliers s SET
  contact_person = NULL,
  phone          = CASE WHEN s.phone IS NOT NULL THEN '030 5550000' END,
  fax            = NULL,
  email          = CASE WHEN s.email IS NOT NULL
                        THEN 'lieferant@example.com' END,
  iban           = NULL,
  bic            = NULL,
  bank_name      = NULL,
  notes          = NULL;

UPDATE documents SET header = NULL, footer = NULL, notes = NULL;
UPDATE document_payments SET notes = NULL;
UPDATE reminders SET notes = NULL;
UPDATE tire_storage SET notes = NULL, photos = '[]'::jsonb;
UPDATE calendar_entries ce SET
  title = 'Termin ' || substr(md5(ce.id::text), 1, 4),
  notes = NULL;

/* Free-text scrub: replace original last names / company names and
 * license-plate-like tokens inside position descriptions. */
DO $scrub$
DECLARE
  r record;
  pattern text;
BEGIN
  FOR r IN
    SELECT nm.orig_last_name AS orig,
           'Kunde ' || nm.customer_number AS repl
      FROM name_map nm
     WHERE nm.orig_last_name IS NOT NULL AND length(nm.orig_last_name) >= 4
    UNION
    SELECT nm.orig_company, 'Firma ' || nm.customer_number
      FROM name_map nm
     WHERE nm.orig_company IS NOT NULL AND length(nm.orig_company) >= 4
  LOOP
    pattern := '\\m' ||
      regexp_replace(r.orig, '([.^$*+?()\\[\\]{}|\\\\])', '\\\\\\1', 'g') ||
      '\\M';
    UPDATE document_items
       SET description = regexp_replace(description, pattern, r.repl, 'gi')
     WHERE description ~* pattern;
  END LOOP;
END
$scrub$;

UPDATE document_items
   SET description = regexp_replace(
         description,
         '\\m[A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,2}[ -]?[0-9]{1,4}[EH]?\\M',
         'B-TC 1234', 'g')
 WHERE description ~ '\\m[A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,2}[ -]?[0-9]{1,4}[EH]?\\M';

/* VIN-like tokens in position free text: 17 chars from the VIN
 * alphabet containing at least one digit (the digit requirement spares
 * 17-letter part names such as ANHAENGERKUPPLUNG). The vin COLUMN is
 * anonymized above; legacy descriptions quote the original
 * ("Fahrzeug-ID: WF0…"). Deterministic per-VIN replacement, same
 * scheme as the column, so distinct vehicles stay distinct. */
DO $vinscrub$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT m[1] AS vin
      FROM document_items di,
           LATERAL regexp_matches(di.description, '\\m[A-HJ-NPR-Z0-9]{17}\\M', 'g') m
     WHERE m[1] ~ '[0-9]' AND m[1] !~ '^TESTVIN'
  LOOP
    UPDATE document_items
       SET description = replace(description, r.vin,
             'TESTVIN' || upper(substr(md5(r.vin), 1, 10)))
     WHERE strpos(description, r.vin) > 0;
  END LOOP;
END
$vinscrub$;

/* Token-level scrub against ALL original names (case-sensitive word
 * match): legacy free text like a vehicle model "Anhänger Dr. Meier"
 * or a position "Bremsen Meier" loses the name even when that
 * customer was trimmed away. Whitespace is normalized as a side
 * effect — cosmetic, and only on rows containing a match. */
CREATE FUNCTION pg_temp.scrub_names(input text) RETURNS text
LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(
    (SELECT string_agg(
        CASE WHEN EXISTS (
          SELECT 1 FROM all_orig_names n
          WHERE n.name = regexp_replace(w.word, '[^[:alnum:]äöüÄÖÜß-]', '', 'g')
        ) THEN 'Anonym' ELSE w.word END,
        ' ' ORDER BY w.ord)
     FROM regexp_split_to_table(input, '\\s+') WITH ORDINALITY AS w(word, ord)),
    input)
$fn$;

CREATE FUNCTION pg_temp.has_name(input text) RETURNS boolean
LANGUAGE sql STABLE AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(input, '\\s+') AS w(word)
    JOIN all_orig_names n
      ON n.name = regexp_replace(w.word, '[^[:alnum:]äöüÄÖÜß-]', '', 'g')
  )
$fn$;

UPDATE vehicles
   SET make  = pg_temp.scrub_names(make),
       model = pg_temp.scrub_names(model)
 WHERE pg_temp.has_name(coalesce(make, '') || ' ' || coalesce(model, ''));

UPDATE document_items
   SET description = pg_temp.scrub_names(description)
 WHERE pg_temp.has_name(description);

/* ── Canonical anchor rows (asserted by the specs, e2e/helpers.ts) ── */
INSERT INTO customers
  (id, customer_number, salutation, first_name, last_name,
   street, zip, city, phone, email, kind)
VALUES
  ('00000000-0000-4000-8000-00000000e201', 'E2E-1', 'Frau', 'Erika',
   'Seedkunde', 'Musterstraße 1', '10115', 'Berlin', '030 5551234',
   'seedkunde@example.com', 'regular');

INSERT INTO vehicles
  (id, customer_id, make, model, vin, first_registration, mileage_km)
VALUES
  ('00000000-0000-4000-8000-00000000e202',
   '00000000-0000-4000-8000-00000000e201',
   'Volkswagen', 'Seedwagen', 'TESTVINE2E0000001', '2018-06-01', 123456);

INSERT INTO vehicle_license_plate_versions
  (vehicle_id, valid_from, license_plate)
VALUES
  ('00000000-0000-4000-8000-00000000e202', '2020-01-01', 'B-E2E 1');

/* ── Runtime residue never ships in the fixture ─────────────────── */
DELETE FROM access_import_jobs;
DELETE FROM sessions;
DELETE FROM verifications;

COMMIT;
`
  if (psql(TRIM_SQL, ['-q']).status !== 0) {
    die('trim/anonymize SQL failed.')
  }

  /* ── 7. Dump, post-process, gzip ─────────────────────────────────── */
  log('dumping …')
  const dump = spawnSync(
    'pg_dump',
    [DB_URL, '--no-owner', '--no-privileges', '--no-comments'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }
  )
  if (dump.status !== 0) {
    console.error(dump.stderr)
    die('pg_dump failed.')
  }
  const cleaned = dump.stdout
    .split('\n')
    // `public` always exists on the restore side; recreating it would
    // fail for roles that do not own the schema.
    .filter((line) => line.trim() !== 'CREATE SCHEMA public;')
    .map((line) =>
      line.trim() === 'CREATE SCHEMA drizzle;'
        ? 'CREATE SCHEMA IF NOT EXISTS drizzle;'
        : line
    )
    .join('\n')

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, gzipSync(Buffer.from(cleaned, 'utf8'), { level: 9 }))

  const counts = await sql`
    SELECT
      (SELECT count(*) FROM customers)      AS customers,
      (SELECT count(*) FROM vehicles)       AS vehicles,
      (SELECT count(*) FROM documents)      AS documents,
      (SELECT count(*) FROM document_items) AS document_items,
      (SELECT count(*) FROM items)          AS items,
      (SELECT count(*) FROM users)          AS users
  `
  log(`fixture written: ${OUT}`)
  log(`contents: ${JSON.stringify(counts[0])}`)
  log('Review the diff and commit e2e/fixtures/seed.sql.gz.')
} catch (err) {
  console.error('[generate-seed] FAILED:', err)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
  await stopServer()
}
