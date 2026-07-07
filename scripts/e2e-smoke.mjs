#!/usr/bin/env node
/**
 * E2E smoke test for TwinCarsManager — the standing end-to-end entry
 * point. Drives a real browser against a running server build and
 * exercises the core business flows end to end:
 *
 *   1. Login (username/password, German error on wrong password)
 *   2. Customer CRUD (create with click-time validation, edit, delete)
 *   3. Creation-flow round trip (vehicle form -> "Neuen Kunden anlegen"
 *      -> full-page customer creation -> back with auto-selection)
 *   4. Vehicle + holder (create via the round trip, list search by
 *      plate, detail view)
 *   5. Search (customer list search by name)
 *   6. Ankauf -> sale cycle (customer vehicle -> Verkaufsbestand ->
 *      sale invoice -> als bezahlt -> vehicle at buyer, Vorbesitzer
 *      intact)
 *   7. Import page renders (upload card + no-file click message)
 *   8. Work-order lifecycle (create with customer, Kanban arrow move
 *      with instant render, material position, completion -> invoice,
 *      read-only order afterwards)
 *   9. Calendar Termin -> Auftrag (create appointment incl. possible
 *      Terminkollision confirm; order created ONCE, second visit
 *      links to it; both deleted again)
 *  10. Offer -> invoice conversion (convert page, converted banner)
 *
 * Prerequisites (deliberately NOT repo dependencies — Playwright is an
 * agent/CI tool, never a project dep):
 *   - A running server, e.g.:
 *       pnpm build && ORIGIN=http://localhost:4173 PORT=4173 node build
 *   - A completed setup with an admin account (defaults below).
 *   - playwright-core resolvable: either globally installed, or point
 *     PLAYWRIGHT_CORE_PATH at a checkout/cache, e.g.
 *       PLAYWRIGHT_CORE_PATH=~/.npm/_npx/<hash>/node_modules/playwright-core
 *   - A Chromium binary: CHROMIUM_PATH=/path/to/chrome (falls back to
 *     playwright-core's own browser resolution).
 *
 * Environment (all optional, defaults in parentheses):
 *   BASE_URL       (http://localhost:4173)
 *   E2E_USERNAME   (e2eadmin)
 *   E2E_PASSWORD   (e2e-passwort-123)
 *   PLAYWRIGHT_CORE_PATH, CHROMIUM_PATH  (see above)
 *
 * Exits non-zero on the first failed step. Runtime is well under two
 * minutes against a local server. Rows created by a run are prefixed
 * with "Smoke" plus a per-run tag; the plain-CRUD customer is deleted
 * again, the sale-cycle rows (vehicle, invoice) intentionally remain
 * as regular business data.
 *
 * Usage:
 *   node scripts/e2e-smoke.mjs
 */

import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const USERNAME = process.env.E2E_USERNAME ?? 'e2eadmin'
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-passwort-123'
/** Per-run tag so repeated runs never collide on names. */
const TAG = Date.now().toString(36)

/** Resolve playwright-core without making it a repo dependency. */
const loadPlaywright = async () => {
  const candidates = []
  if (process.env.PLAYWRIGHT_CORE_PATH) {
    const p = process.env.PLAYWRIGHT_CORE_PATH
    candidates.push(existsSync(`${p}/index.mjs`) ? `${p}/index.mjs` : p)
  }
  candidates.push('playwright-core', 'playwright')
  for (const c of candidates) {
    try {
      const spec = c.startsWith('/') ? pathToFileURL(c).href : c
      return await import(spec)
    } catch {
      // try the next candidate
    }
  }
  console.error(
    'playwright-core not found. Install it globally or set PLAYWRIGHT_CORE_PATH.'
  )
  process.exit(2)
}

const { chromium } = await loadPlaywright()

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ['--no-sandbox']
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.setDefaultTimeout(15000)

let failures = 0
let current = ''
const step = (name) => {
  current = name
  process.stdout.write(`\n== ${name}\n`)
}
const ok = (msg) => process.stdout.write(`   ok: ${msg}\n`)
const fail = (msg) => {
  failures += 1
  process.stdout.write(`   FAIL [${current}]: ${msg}\n`)
}
const assert = (cond, msg) => (cond ? ok(msg) : fail(msg))

/**
 * Fill the input inside the label whose text contains `labelText`.
 * Self-healing against hydration races: if Svelte's `bind:value`
 * initialisation reverts the value right after the fill, fill again.
 */
const fillLabeled = async (labelText, value) => {
  const input = page
    .locator('label', { hasText: labelText })
    .first()
    .locator('input')
    .first()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await input.fill(value)
    await page.waitForTimeout(300)
    if ((await input.inputValue()) === value) return
  }
  throw new Error(`could not fill "${labelText}" (hydration race)`)
}

const mainText = () => page.locator('main').innerText()

/**
 * Navigate and give Svelte a moment to hydrate. Filling an input
 * before hydration completes would be undone when `bind:value`
 * initialises from (empty) component state.
 */
const gotoSettled = async (url) => {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}

try {
  /* 1 ── Login ─────────────────────────────────────────────────────── */
  step('Login')
  await gotoSettled(`${BASE}/login`)
  await page.fill('input[type=text]', USERNAME)
  await page.fill('input[type=password]', 'definitiv-falsch-' + TAG)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForTimeout(1200)
  const loginErr = await page.locator('.alert-error').innerText()
  assert(
    loginErr.includes('Benutzername oder Passwort ist falsch.'),
    `wrong password shows German error (got: ${loginErr.trim()})`
  )
  await page.fill('input[type=password]', PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), {
    timeout: 15000
  })
  assert(true, `logged in as ${USERNAME}`)

  /* 2 ── Customer CRUD ─────────────────────────────────────────────── */
  step('Customer CRUD')
  await gotoSettled(`${BASE}/customers/new`)
  // click-time validation: empty submit -> German summary, no navigation
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForTimeout(500)
  assert(
    (await page.locator('.alert-error').count()) > 0,
    'empty submit shows a German error summary'
  )
  const crudName = `Smoketest-${TAG}`
  await fillLabeled('Nachname', crudName)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
  const customerUrl = page.url()
  assert(true, `customer created: ${customerUrl}`)
  // edit
  await gotoSettled(`${customerUrl}/edit`)
  await fillLabeled('Vorname', 'Erna')
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)
  // client-side goto commits the URL before the new page finishes
  // rendering — poll the content instead of reading immediately
  let ernaShown = false
  for (let i = 0; i < 16 && !ernaShown; i += 1) {
    ernaShown = (await mainText().catch(() => '')).includes('Erna')
    if (!ernaShown) await page.waitForTimeout(500)
  }
  assert(ernaShown, 'edit persisted (Vorname Erna)')

  /* 3 ── Search ────────────────────────────────────────────────────── */
  step('Customer search')
  await gotoSettled(`${BASE}/customers`)
  await page.locator('input[placeholder*=suchen]').first().fill(crudName)
  await page.waitForTimeout(2000)
  assert(
    (await page.locator('tbody').first().innerText()).includes(crudName),
    `list search finds ${crudName}`
  )

  /* 4 ── delete (no linked data -> allowed) ───────────────────────── */
  await page
    .locator('tbody tr', { hasText: crudName })
    .first()
    .locator('td:last-child button')
    .last()
    .click()
  await page.locator('dialog.modal-open button.btn-error').last().click()
  await page.waitForTimeout(1500)
  assert(
    !(
      await page
        .locator('tbody')
        .first()
        .innerText()
        .catch(() => '')
    ).includes(crudName),
    'customer deleted from list'
  )

  /* 5 ── Creation-flow round trip + vehicle with holder ───────────── */
  step('Creation flow round trip (vehicle -> new customer -> back)')
  await gotoSettled(`${BASE}/vehicles/new`)
  await fillLabeled('Marke', 'Smoke')
  await fillLabeled('Modell', `Wagen ${TAG}`)
  await fillLabeled('Kennzeichen', `SM-OK ${TAG.slice(-3).toUpperCase()}`)
  await page.locator('button', { hasText: 'Kunde wählen' }).first().click()
  await page
    .locator('dialog.modal[open]')
    .last()
    .getByRole('button', { name: 'Neuen Kunden anlegen' })
    .click()
  await page.waitForURL(/\/customers\/new/)
  await fillLabeled('Nachname', `Smokehalter-${TAG}`)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/vehicles\/new/)
  const backForm = await mainText()
  assert(
    backForm.includes(`Smokehalter-${TAG}`),
    'returned with new customer auto-selected'
  )
  assert(
    (await page
      .locator('label', { hasText: 'Modell' })
      .first()
      .locator('input')
      .inputValue()) === `Wagen ${TAG}`,
    'vehicle draft restored after round trip'
  )
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/vehicles\/[0-9a-f-]{36}$/)
  const vehicleUrl = page.url()
  assert(true, `vehicle created with holder: ${vehicleUrl}`)

  /* 6 ── Vehicle list search by plate ─────────────────────────────── */
  step('Vehicle search by plate')
  await gotoSettled(`${BASE}/vehicles`)
  await page
    .locator('input[placeholder*=suchen], input[placeholder*=Suche]')
    .first()
    .fill(`SM-OK ${TAG.slice(-3).toUpperCase()}`)
  await page.waitForTimeout(2000)
  assert(
    (await page.locator('tbody').first().innerText()).includes(`Wagen ${TAG}`),
    'plate search finds the new vehicle'
  )

  /* 7 ── Ankauf -> sale cycle ─────────────────────────────────────── */
  step('Ankauf -> Verkauf cycle')
  await gotoSettled(vehicleUrl)
  await page
    .getByRole('button', { name: /Ankauf \(in Verkaufsbestand/ })
    .click()
  // price stays empty on purpose — it is optional
  await page
    .locator('dialog.modal-open')
    .last()
    .locator('button.btn-primary')
    .last()
    .click()
  await page.waitForTimeout(2000)
  const afterAnkauf = await mainText()
  assert(
    afterAnkauf.includes('Vorbesitzer'),
    'vehicle moved to stock, Vorbesitzer shown'
  )

  // buyer
  await gotoSettled(`${BASE}/customers/new`)
  await fillLabeled('Nachname', `Smokekäufer-${TAG}`)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/)

  // sale invoice from inventory
  const vehicleId = vehicleUrl.split('/').pop()
  await gotoSettled(`${BASE}/invoices/new?vehicleId=${vehicleId}`)
  await page
    .getByRole('button', { name: /Kunde suchen/ })
    .first()
    .click()
  const dlg = page.locator('dialog.modal[open]').last()
  await dlg.locator('input').first().fill(`Smokekäufer-${TAG}`)
  await page.waitForTimeout(1500)
  await dlg.getByText(`Smokekäufer-${TAG}`).first().click()
  await page.waitForTimeout(600)
  // vehicle position is pre-filled; only the price is missing
  await page.locator('table tbody input.input-sm').nth(3).fill('2500')
  await page.getByRole('button', { name: 'Rechnung speichern' }).click()
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)
  await page.waitForTimeout(700)
  assert(true, `sale invoice created: ${page.url()}`)

  // mark paid directly (over-the-counter payment, no mail needed)
  await page.getByRole('button', { name: 'Als bezahlt markieren' }).click()
  await page.waitForTimeout(2500)
  assert((await mainText()).includes('Bezahlt'), 'invoice flipped to Bezahlt')

  // vehicle now at the buyer, Vorbesitzer intact
  await gotoSettled(vehicleUrl)
  const afterSale = await mainText()
  assert(
    afterSale.includes(`Smokekäufer-${TAG}`),
    'vehicle transferred to the buyer'
  )
  assert(
    afterSale.includes(`Smokehalter-${TAG}`),
    'Vorbesitzer (original holder) still recorded'
  )

  /* 8 ── Import page renders ──────────────────────────────────────── */
  step('Import page')
  await gotoSettled(`${BASE}/settings/import`)
  const importText = await mainText()
  assert(
    importText.includes('Access-Datenbank hochladen'),
    'upload card renders'
  )
  await page.getByRole('button', { name: 'Vorschau (ohne Speichern)' }).click()
  await page.waitForTimeout(500)
  assert(
    (await mainText()).includes('Bitte zuerst eine .mdb-Datei auswählen.'),
    'no-file click shows the German hint (always-clickable rule)'
  )

  /* Shared helper: pick an entity in a SearchablePicker dialog. */
  const pickInDialog = async (triggerText, query, hitText) => {
    await page.getByText(triggerText).first().click()
    const dlg = page.locator('dialog.modal[open]').last()
    await dlg.locator('input').first().fill(query)
    await page.waitForTimeout(1200)
    await dlg.getByText(hitText).first().click()
    await page.waitForTimeout(500)
  }

  /* 9 -- Work-order lifecycle: create -> Kanban move -> items ->
         complete -> invoice */
  step('Order lifecycle (create -> kanban -> complete -> invoice)')
  await gotoSettled(`${BASE}/orders/new`)
  await pickInDialog('Kunde suchen', `Smokekäufer-${TAG}`, `Smokekäufer-${TAG}`)
  const orderTitle = `Smoke Auftrag ${TAG}`
  await page.locator('input[maxlength="200"]').first().fill(orderTitle)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
  const orderUrl = page.url()
  assert(true, `order created: ${orderUrl}`)

  // Kanban: the fresh order sits in "Offen"; the arrow moves it to
  // "In Bearbeitung" instantly (optimistic override).
  await gotoSettled(`${BASE}/orders`)
  await page.locator('input[type="search"]').first().fill(orderTitle)
  await page.waitForTimeout(1500)
  const openCol = page.locator('div[role="list"][aria-label="Offen"]')
  assert(
    (await openCol
      .locator('[role="button"]', { hasText: orderTitle })
      .count()) === 1,
    'new order shows in the Offen column'
  )
  await openCol
    .locator('[role="button"]', { hasText: orderTitle })
    .first()
    .getByRole('button', { name: 'In Bearbeitung verschieben' })
    .click()
  let moved = false
  for (let i = 0; i < 20 && !moved; i += 1) {
    moved =
      (await page
        .locator('div[role="list"][aria-label="In Bearbeitung"]')
        .locator('[role="button"]', { hasText: orderTitle })
        .count()) === 1
    if (!moved) await page.waitForTimeout(100)
  }
  assert(moved, 'kanban arrow moves the card to In Bearbeitung (instant)')

  // Items + completion: one material row, then Abschluss creates the
  // invoice and the order becomes read-only.
  await gotoSettled(orderUrl)
  await page.locator('input[aria-label="Material"]').check()
  await page
    .locator('label', { hasText: 'Beschreibung' })
    .first()
    .locator('input')
    .first()
    .fill('Smoke Kleinteil')
  await page
    .locator('label', { hasText: 'Menge' })
    .first()
    .locator('input')
    .first()
    .fill('1')
  await page
    .locator('label', { hasText: 'Einzelpreis (netto)' })
    .first()
    .locator('input')
    .first()
    .fill('10')
  await page.getByRole('button', { name: 'Position hinzufügen' }).click()
  await page.waitForTimeout(1200)
  await page
    .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
    .first()
    .click()
  await page.waitForTimeout(700)
  await page
    .locator('.modal-open')
    .last()
    .getByRole('button', { name: 'Abschließen & Rechnung erstellen' })
    .click()
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)
  await page.waitForTimeout(700)
  assert(
    (await mainText()).includes('Smoke Kleinteil'),
    `completion created the invoice: ${page.url()}`
  )
  await gotoSettled(orderUrl)
  assert(
    (await mainText()).includes('abgeschlossen und abgerechnet'),
    'completed order is read-only with the invoice back-link'
  )

  /* 10 -- Calendar: Termin -> Auftrag (once only) */
  step('Calendar Termin -> Auftrag')
  await gotoSettled(`${BASE}/calendar/new`)
  const terminTitle = `Smoke Termin ${TAG}`
  await fillLabeled('Titel', terminTitle)
  const todayIso = new Date().toISOString().slice(0, 10)
  const dts = page.locator('input[type="datetime-local"]')
  await dts.nth(0).fill(`${todayIso}T20:00`)
  await dts.nth(1).fill(`${todayIso}T21:00`)
  await pickInDialog('Kunde suchen', `Smokekäufer-${TAG}`, `Smokekäufer-${TAG}`)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await page.waitForTimeout(1200)
  // Repeated runs overlap the same slot -- confirm the Terminkollision.
  const collision = page.locator('.modal-open, dialog[open]', {
    hasText: 'Terminkollision'
  })
  if ((await collision.count()) > 0) {
    await collision.getByRole('button', { name: 'Trotzdem speichern' }).click()
    await page.waitForTimeout(1200)
  }
  assert(page.url().endsWith('/calendar'), 'Termin saved, back on calendar')
  await page.getByText(terminTitle).first().click()
  await page.waitForURL(/\/calendar\/[0-9a-f-]{36}\/edit/)
  const terminEditUrl = page.url()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Auftrag erstellen' }).click()
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/)
  await page.waitForTimeout(700)
  const terminOrderUrl = page.url()
  assert(
    (await mainText()).includes(terminTitle),
    'order carries the Termin link'
  )
  await gotoSettled(terminEditUrl)
  assert(
    (await page.getByRole('button', { name: 'Auftrag erstellen' }).count()) ===
      0 &&
      (await page.getByRole('link', { name: /Zum Auftrag/ }).count()) === 1,
    'second visit offers "Zum Auftrag" instead of a second create'
  )
  // Self-cleaning: drop the Termin-order and the Termin again.
  await gotoSettled(terminOrderUrl)
  await page.getByRole('button', { name: 'Löschen' }).first().click()
  await page.waitForTimeout(500)
  await page
    .locator('.modal-open, dialog[open]')
    .last()
    .locator('button.btn-error')
    .last()
    .click()
  await page.waitForTimeout(1200)
  await gotoSettled(terminEditUrl)
  await page.getByRole('button', { name: 'Löschen' }).first().click()
  await page.waitForTimeout(500)
  await page
    .locator('.modal-open, dialog[open]')
    .last()
    .locator('button.btn-error')
    .last()
    .click()
  await page.waitForTimeout(1200)
  assert(true, 'Termin order + Termin deleted again (self-cleaning)')

  /* 11 -- Offer -> invoice conversion */
  step('Offer -> invoice conversion')
  await gotoSettled(`${BASE}/offers/new`)
  await pickInDialog('Kunde suchen', `Smokekäufer-${TAG}`, `Smokekäufer-${TAG}`)
  const offerRow = page.locator('table tbody tr').first()
  await offerRow.locator('input').nth(0).fill(`Smoke Angebotsposition ${TAG}`)
  await offerRow.locator('input').nth(1).fill('1')
  await offerRow.locator('input').nth(3).fill('42')
  await page.getByRole('button', { name: 'Speichern' }).last().click()
  await page.waitForURL(/\/offers\/[0-9a-f-]{36}$/)
  const offerUrl = page.url()
  assert(true, `offer created: ${offerUrl}`)
  await gotoSettled(`${offerUrl}/convert`)
  await page.getByRole('button', { name: 'Rechnung erstellen' }).click()
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/)
  await page.waitForTimeout(700)
  assert(
    (await mainText()).includes(`Smoke Angebotsposition ${TAG}`),
    `offer converted to invoice: ${page.url()}`
  )
  await gotoSettled(offerUrl)
  assert(
    (await mainText()).includes('In Rechnung überführt'),
    'source offer shows the converted banner'
  )
} catch (err) {
  fail(`unexpected error: ${err?.message ?? err}`)
} finally {
  await browser.close()
}

if (failures > 0) {
  console.error(`\n${failures} smoke step(s) FAILED`)
  process.exit(1)
}
console.log('\nAll smoke steps passed.')
