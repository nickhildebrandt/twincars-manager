/**
 * KFZ-Kaufmann (Microsoft Access .mdb) → Postgres Import.
 *
 * Pipeline:
 *   1. Schreibt das hochgeladene MDB-File in ein temporäres Verzeichnis.
 *   2. Ruft `mdb-export` pro Tabelle auf und parst den CSV.
 *   3. Wischt die fachlichen Tabellen leer (Stammdaten + Belege),
 *      Settings/Templates/Number-Ranges/Ledger-Categories bleiben
 *      stehen.
 *   4. Bildet die Legacy-Datensätze auf das neue Schema ab und schreibt
 *      sie in Batches.
 *   5. Setzt `number_ranges.next_value` auf max(Legacy)+1, damit das
 *      System nahtlos an die alten Nummern anschliesst (rechtlich
 *      bindend).
 *
 * Annahmen / Limitierungen (siehe Result-Modal in der UI):
 *   - Belege referenzieren in der MDB kein Fahrzeug — `documents.vehicle_id`
 *     bleibt NULL.
 *   - Belege werden direkt als `paid` (oder `cancelled` bei Status
 *     "storniert") angelegt; sie tauchen NICHT in den gesendeten
 *     Nachrichten auf, weil sie nicht durch dieses System verschickt
 *     wurden. PDFs werden bei der nächsten Detailansicht on-demand
 *     gerendert.
 *   - `mdb-tools` muss auf dem Host installiert sein
 *     (`apk add mdbtools` im Container).
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  customers,
  documentItems,
  documentPayments,
  documentPdfs,
  documents,
  employeeAbsences,
  employeeSalaryVersions,
  employees,
  itemPriceVersions,
  items,
  ledgerEntries,
  numberRanges,
  recurringEntries,
  payrollDeductions,
  payrollEntries,
  payrollLineItems,
  payrollPeriods,
  payslipPdfs,
  reminderPdfs,
  reminders,
  sentMessages,
  specialPaymentEmployees,
  specialPayments,
  suppliers,
  vehicleLicensePlateVersions,
  vehicleListings,
  vehiclePhotos,
  vehiclePurchases,
  vehicleSales,
  vehicles
} from '$lib/server/db/schema'

const execAsync = promisify(exec)

export type ImportSummary = {
  customers: number
  vehicles: number
  suppliers: number
  items: number
  invoices: number
  invoiceItems: number
  invoicePayments: number
  offers: number
  offerItems: number
  reminders: number
  /** Anzahl gerenderter PDFs (Rechnungen + Angebote + Mahnungen). */
  pdfsRendered: number
  /** Legacy-Rechnungsnummern, die `Bestandskorrektur=true` getragen haben. */
  inventoryAdjustmentInvoiceNumbers: string[]
  /**
   * Anzahl Datensätze, die im Quellsystem zwar existierten, aber keine
   * Verknüpfung zu einem Datensatz im neuen System mehr finden konnten
   * (z.B. Mahnung zu nicht importierter Rechnung). Werden im
   * Result-Modal kurz erwähnt.
   */
  skipped: {
    reminders: number
    payments: number
    invoiceItems: number
    offerItems: number
    pdfRenders: number
  }
}

/* ── Hilfsfunktionen ───────────────────────────────────────────────── */

const shellQuote = (s: string): string => `'${s.replace(/'/g, "'\\''")}'`

/** Liest eine Tabelle aus der MDB als JSON-Array. */
async function dumpTable(
  mdbPath: string,
  table: string
): Promise<Record<string, string>[]> {
  // Semikolon als Trenner — Beschreibungen enthalten oft Kommas.
  // ISO-Datums- und Datetime-Format ist deterministisch. mdb-export
  // quotet Textfelder per Default mit `"` und doppelt eingebettete
  // Quotes — das passt zu csv-parse.
  const cmd = `mdb-export -d ';' -D '%Y-%m-%d %H:%M:%S' -T '%Y-%m-%d %H:%M:%S' ${shellQuote(mdbPath)} ${shellQuote(table)}`
  const { stdout } = await execAsync(cmd, { maxBuffer: 256 * 1024 * 1024 })
  return parseCsv(stdout, {
    columns: true,
    delimiter: ';',
    quote: '"',
    escape: '"',
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true
  }) as Record<string, string>[]
}

const trim = (v: string | undefined | null): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}

/** Schneidet einen String auf max. n Zeichen — die alte MDB hat
 *  vereinzelt längere Werte als unser engerer Schema-Constraint. */
const clip = (v: string | null, n: number): string | null =>
  v == null ? null : v.length <= n ? v : v.slice(0, n)

const toInt = (v: string | undefined | null): number | null => {
  const s = trim(v)
  if (s == null) return null
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

const toFloat = (v: string | undefined | null): number | null => {
  const s = trim(v)
  if (s == null) return null
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const toBool = (v: string | undefined | null): boolean => {
  const s = trim(v)
  return s === '1' || s?.toLowerCase() === 'true'
}

/** Validiert Jahr/Monat/Tag plausibel — Legacy-Daten enthalten
 *  Tippfehler wie `0297-20-01` (Monat 20). */
const isValidYmd = (y: number, m: number, d: number): boolean =>
  Number.isFinite(y) &&
  y >= 1900 &&
  y <= 2100 &&
  m >= 1 &&
  m <= 12 &&
  d >= 1 &&
  d <= 31

const isoDate = (v: string | undefined | null): string | null => {
  const s = trim(v)
  if (s == null) return null
  // mdb-export liefert "YYYY-MM-DD HH:MM:SS"; wir brauchen nur Datum.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!isValidYmd(y, mo, d)) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

const isoTimestamp = (v: string | undefined | null): Date | null => {
  const s = trim(v)
  if (s == null) return null
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * EZ / HU-Felder im Legacy-System variieren stark:
 *   "06.2009"    → 2009-06-01
 *   "12.1999"    → 1999-12-01
 *   "04/92"      → 1992-04-01
 *   "08/30/08"   → 2008-08-30 (kommt aus mdb-export bereits ISO)
 *   "0600"       → ungültig (Mappings-Code; ignorieren)
 */
const parseLooseDate = (v: string | undefined | null): string | null => {
  const s = trim(v)
  if (s == null) return null
  // ISO direkt
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    return isValidYmd(y, m, d) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null
  }
  // MM.YYYY
  const myyyy = /^(\d{1,2})\.(\d{4})$/.exec(s)
  if (myyyy) {
    const m = Number(myyyy[1])
    const y = Number(myyyy[2])
    if (!isValidYmd(y, m, 1)) return null
    return `${y}-${String(m).padStart(2, '0')}-01`
  }
  // MM/YY
  const myy = /^(\d{1,2})\/(\d{2})$/.exec(s)
  if (myy) {
    const m = Number(myy[1])
    const yy = Number(myy[2])
    const y = yy >= 70 ? 1900 + yy : 2000 + yy
    if (!isValidYmd(y, m, 1)) return null
    return `${y}-${String(m).padStart(2, '0')}-01`
  }
  // DD.MM.YYYY
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
  if (dmy) {
    const d = Number(dmy[1])
    const m = Number(dmy[2])
    const y = Number(dmy[3])
    if (!isValidYmd(y, m, d)) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

/** Splittet "VW Caddy" / "VW Golf IV Generation" in (make, model). */
const splitMakeModel = (
  v: string | null
): { make: string | null; model: string | null } => {
  const s = trim(v)
  if (s == null) return { make: null, model: null }
  const idx = s.indexOf(' ')
  if (idx === -1) return { make: s, model: null }
  return { make: s.slice(0, idx), model: s.slice(idx + 1) }
}

/** Mappt das Legacy-`Art`-Feld auf unser `kind`. */
const mapArtToKind = (art: string | null): string => {
  const a = (art ?? '').toLowerCase().trim()
  if (a.startsWith('leistung')) return 'service'
  if (a.startsWith('material')) return 'material'
  if (a.startsWith('durchlauf')) return 'pass_through'
  return 'article'
}

/** Status-Mapping Rechnung. */
const mapInvoiceStatus = (legacy: {
  status: string | null
  bezahldatum: string | null
}): string => {
  const s = (legacy.status ?? '').toLowerCase()
  if (s.includes('storniert')) return 'cancelled'
  if (s.includes('bar') || s.includes('bezahlt') || legacy.bezahldatum)
    return 'paid'
  // Default für Legacy: alles als abgeschlossen → paid (per User-Vorgabe).
  return 'paid'
}

/** Status-Mapping Angebot/KV/AB. */
const mapOfferStatus = (status: string | null): string => {
  const s = (status ?? '').toLowerCase()
  if (s.includes('storniert')) return 'cancelled'
  return 'sent'
}

/** Formulartyp → unser type. */
const mapOfferType = (formulartyp: string | null): string => {
  const t = (formulartyp ?? '').toLowerCase()
  if (t.includes('kostenvoranschlag') || t.includes('kv'))
    return 'cost_estimate'
  if (t.includes('auftrag') || t.includes('ab')) return 'order_confirmation'
  return 'offer'
}

/* ── Wipe ──────────────────────────────────────────────────────────── */

async function wipeData(): Promise<void> {
  // Reihenfolge so, dass FK-abhängige Tabellen vor ihren Eltern fallen.
  // Tabellen mit ON DELETE CASCADE räumen sich beim Eltern-Delete zwar
  // selbst auf, aber wir listen sie explizit auf, um a) deterministisch
  // zu sein und b) bei eventuell später hinzugefügten FKs ohne Cascade
  // keine bösen Überraschungen zu erleben.
  await db.delete(reminderPdfs)
  await db.delete(reminders)
  await db.delete(documentPdfs)
  await db.delete(documentPayments)
  await db.delete(documentItems)
  await db.delete(documents)
  await db.delete(payslipPdfs)
  await db.delete(payrollDeductions)
  await db.delete(payrollLineItems)
  await db.delete(payrollEntries)
  await db.delete(payrollPeriods)
  await db.delete(employeeSalaryVersions)
  await db.delete(employeeAbsences)
  await db.delete(specialPaymentEmployees)
  await db.delete(specialPayments)
  await db.delete(employees)
  await db.delete(vehiclePhotos)
  await db.delete(vehicleSales)
  await db.delete(vehicleListings)
  await db.delete(vehiclePurchases)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(vehicles)
  await db.delete(itemPriceVersions)
  await db.delete(items)
  await db.delete(suppliers)
  await db.delete(customers)
  await db.delete(calendarEntries)
  await db.delete(recurringEntries)
  await db.delete(ledgerEntries)
  await db.delete(sentMessages)
}

/* ── Insert-Batches ────────────────────────────────────────────────── */

const CHUNK = 1000

async function insertInBatches<T>(
  rows: T[],
  fn: (chunk: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await fn(rows.slice(i, i + CHUNK))
  }
}

/* ── Hauptablauf ───────────────────────────────────────────────────── */

export async function importMdb(buffer: Buffer): Promise<ImportSummary> {
  const dir = await mkdtemp(join(tmpdir(), 'tc-import-'))
  const mdbPath = join(dir, 'kfz-kaufmann.mdb')
  await writeFile(mdbPath, buffer)
  try {
    return await runImport(mdbPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function runImport(mdbPath: string): Promise<ImportSummary> {
  const summary: ImportSummary = {
    customers: 0,
    vehicles: 0,
    suppliers: 0,
    items: 0,
    invoices: 0,
    invoiceItems: 0,
    invoicePayments: 0,
    offers: 0,
    offerItems: 0,
    reminders: 0,
    pdfsRendered: 0,
    inventoryAdjustmentInvoiceNumbers: [],
    skipped: {
      reminders: 0,
      payments: 0,
      invoiceItems: 0,
      offerItems: 0,
      pdfRenders: 0
    }
  }

  // 1. Wipe
  await wipeData()

  // 2. Quelltabellen lesen.
  const [
    kunden,
    autos,
    lieferanten,
    artikel,
    rechnungen,
    rechnungDetails,
    angebote,
    angebotDetails,
    mahnungen,
    teilzahlungen
  ] = await Promise.all([
    dumpTable(mdbPath, 'Kunden'),
    dumpTable(mdbPath, 'Autos'),
    dumpTable(mdbPath, 'Lieferanten'),
    dumpTable(mdbPath, 'Artikel'),
    dumpTable(mdbPath, 'Rechnungen'),
    dumpTable(mdbPath, 'RechnungDetails'),
    dumpTable(mdbPath, 'Angebote'),
    dumpTable(mdbPath, 'AngebotDetails'),
    dumpTable(mdbPath, 'Mahnungen'),
    dumpTable(mdbPath, 'Teilzahlungen')
  ])

  /* — 3. Kunden — */
  type CustomerInsert = typeof customers.$inferInsert
  const customerIdByLegacy = new Map<string, string>() // legacyKundenNr → uuid
  const customerRows: CustomerInsert[] = []
  for (const k of kunden) {
    const legacyNr = trim(k['Kunden-Nr'])
    if (legacyNr == null) continue
    const id = crypto.randomUUID()
    customerIdByLegacy.set(legacyNr, id)
    customerRows.push({
      id,
      customerNumber: legacyNr,
      legacyCustomerNumber: legacyNr,
      company: clip(trim(k['Firma']), 200),
      firstName: clip(trim(k['Vorname']), 100),
      lastName: clip(trim(k['Nachname']), 100),
      salutation: clip(trim(k['Anrede']), 30),
      street: clip(trim(k['Strasse']), 200),
      zip: clip(trim(k['Postleitzahl']), 10),
      city: clip(trim(k['Ort']), 150),
      phone: clip(trim(k['Telefonnummer']), 30),
      mobile: clip(trim(k['Natel']) ?? trim(k['Telefon2']), 30),
      fax: clip(trim(k['Faxnummer']), 30),
      email: clip(trim(k['Email']), 254),
      birthday: isoDate(k['Geboren']),
      website: clip(trim(k['Website']), 2048),
      vatId: clip(trim(k['UID']), 30),
      bankIban: clip(trim(k['IBAN']), 34),
      bankBic: clip(trim(k['BIC']), 11),
      bankName: clip(trim(k['BANK']), 100),
      paymentTermDays: toInt(k['zahlungsziel']),
      // Kontoinhaber-Hinweis hängen wir an die Notiz dran, wenn er vom
      // Kunden-Vorname/Nachname abweicht — eigene Spalte fehlt im neuen
      // Schema bewusst.
      notes:
        [
          trim(k['Anmerkungen']),
          trim(k['KtoInhaber']) ? `Kto: ${trim(k['KtoInhaber'])}` : null,
          trim(k['Auftragsarbeiten'])
        ]
          .filter(Boolean)
          .join('\n\n') || null
    })
  }
  await insertInBatches(customerRows, async (chunk) => {
    await db.insert(customers).values(chunk)
  })
  summary.customers = customerRows.length

  /* — 4. Fahrzeuge (Autos) — alle als Kunden-Fahrzeuge — */
  type VehicleInsert = typeof vehicles.$inferInsert
  type PlateVersionInsert = typeof vehicleLicensePlateVersions.$inferInsert
  const vehicleRows: VehicleInsert[] = []
  const plateVersionRows: PlateVersionInsert[] = []
  for (const a of autos) {
    const legacyKunde = trim(a['Kunden-Nr'])
    const customerId = legacyKunde ? customerIdByLegacy.get(legacyKunde) : null
    if (!customerId) continue // Fahrzeug ohne gültigen Halter überspringen
    const { make, model } = splitMakeModel(trim(a['KFZ-Typ']))
    const id = crypto.randomUUID()
    vehicleRows.push({
      id,
      customerId,
      legacyVehicleId: clip(trim(a['ID_Auto']), 50),
      make: clip(make, 100),
      model: clip(model, 150),
      vin: clip(trim(a['Fahrgestellnr']), 25),
      firstRegistration: parseLooseDate(a['EZ']),
      mileageKm: toInt(a['km-Stand']),
      nextHu: parseLooseDate(a['HU']),
      hsn: clip(trim(a['ff1']), 10),
      tsn: clip(trim(a['ff2']), 10),
      engineNumber: clip(trim(a['ff3']), 50),
      fuelType: clip(trim(a['ff4']), 30),
      bodyType: clip(trim(a['ff5']), 50),
      notes: trim(a['Freifeld1']),
      archived: toInt(a['Archiv']) === 1
    })
    // Initiale Kennzeichen-Version anlegen — gültig ab EZ, sonst ab
    // einem konservativen Default (alte Importe wirken so „immer schon
    // da gewesen" und werden bei einer späteren Änderung sauber von
    // einer neuen Version mit `valid_from = heute` abgelöst).
    const plate = clip(trim(a['Kennzeichen']), 20)
    if (plate) {
      plateVersionRows.push({
        id: crypto.randomUUID(),
        vehicleId: id,
        validFrom: parseLooseDate(a['EZ']) ?? '1900-01-01',
        licensePlate: plate
      })
    }
  }
  await insertInBatches(vehicleRows, async (chunk) => {
    await db.insert(vehicles).values(chunk)
  })
  await insertInBatches(plateVersionRows, async (chunk) => {
    await db.insert(vehicleLicensePlateVersions).values(chunk)
  })
  summary.vehicles = vehicleRows.length

  /* — 5. Lieferanten — */
  type SupplierInsert = typeof suppliers.$inferInsert
  const supplierIdByLegacy = new Map<string, string>()
  const supplierRows: SupplierInsert[] = []
  for (const l of lieferanten) {
    const legacyNr = trim(l['Lieferantennummer'])
    if (legacyNr == null) continue
    const id = crypto.randomUUID()
    supplierIdByLegacy.set(legacyNr, id)
    supplierRows.push({
      id,
      legacySupplierNumber: clip(legacyNr, 50),
      name: clip(trim(l['Firma']), 200) ?? '—',
      contactPerson: clip(trim(l['Kontaktperson']), 100),
      street: clip(trim(l['Strasse']), 200),
      zip: clip(trim(l['PLZ']), 10),
      city: clip(trim(l['Ort']), 150),
      country: clip(trim(l['Land']), 100),
      phone: clip(trim(l['Telefon']), 30),
      fax: clip(trim(l['Fax']), 30),
      email: clip(trim(l['Email']), 254),
      website: clip(trim(l['Website']), 2048),
      customerNumberAtSupplier: clip(trim(l['Kundennummer']), 50),
      iban: clip(trim(l['IBAN']), 34),
      bic: clip(trim(l['BIC']), 11),
      bankName: clip(trim(l['BANK']), 100)
    })
  }
  await insertInBatches(supplierRows, async (chunk) => {
    await db.insert(suppliers).values(chunk)
  })
  summary.suppliers = supplierRows.length

  /* — 6. Artikel + Preisversionen — */
  type ItemInsert = typeof items.$inferInsert
  const itemIdByLegacyArtNr = new Map<string, string>()
  const itemRows: ItemInsert[] = []
  const priceRows: (typeof itemPriceVersions.$inferInsert)[] = []
  for (const a of artikel) {
    const legacyId = trim(a['Artikel-Nr'])
    if (legacyId == null) continue
    const id = crypto.randomUUID()
    itemIdByLegacyArtNr.set(legacyId, id)
    const articleNumber = trim(a['Artikelnummer']) ?? legacyId
    itemRows.push({
      id,
      legacyItemNumber: legacyId,
      articleNumber,
      description: trim(a['Artikelbeschreibung']) ?? articleNumber,
      kind: mapArtToKind(trim(a['Art'])),
      unit: trim(a['Me']),
      stockOnHand: Math.max(0, Math.round(toFloat(a['Bestand']) ?? 0)),
      stockMin: toFloat(a['BestandMin'])
        ? Math.round(toFloat(a['BestandMin'])!)
        : null,
      stockMax: toFloat(a['BestandMax'])
        ? Math.round(toFloat(a['BestandMax'])!)
        : null,
      discontinued: toBool(a['Auslaufartikel']),
      notes: trim(a['Anmerkung'])
    })
    const price = toFloat(a['Einzelpreis'])
    if (price != null) {
      priceRows.push({
        id: crypto.randomUUID(),
        itemId: id,
        validFrom: '2000-01-01',
        unitPriceNet: String(price)
      })
    }
  }
  await insertInBatches(itemRows, async (chunk) => {
    await db.insert(items).values(chunk)
  })
  await insertInBatches(priceRows, async (chunk) => {
    await db.insert(itemPriceVersions).values(chunk)
  })
  summary.items = itemRows.length

  /* — 7. Rechnungen — */
  type DocInsert = typeof documents.$inferInsert
  type DocItemInsert = typeof documentItems.$inferInsert
  type DocPayInsert = typeof documentPayments.$inferInsert

  const invoiceIdByLegacyNr = new Map<string, string>()
  const invoiceDocRows: DocInsert[] = []

  for (const r of rechnungen) {
    const legacyNr = trim(r['Rechnungsnummer'])
    if (legacyNr == null) continue
    const customerId =
      customerIdByLegacy.get(trim(r['Kunden-Nr']) ?? '') ?? null
    const id = crypto.randomUUID()
    invoiceIdByLegacyNr.set(legacyNr, id)

    const isInventoryAdj = toBool(r['Bestandskorrektur'])
    if (isInventoryAdj) {
      summary.inventoryAdjustmentInvoiceNumbers.push(legacyNr)
    }

    const taxRate = toFloat(r['MWSteuer']) ?? 19
    const status = mapInvoiceStatus({
      status: trim(r['Status']),
      bezahldatum: trim(r['Bezahldatum'])
    })
    /**
     * In der Legacy-DB tragen viele Datensätze kein Rechnungsdatum
     * (Drafts, abgebrochene Anlage). Wir importieren sie trotzdem mit
     * einem Fallback — Reihenfolge: Bezahldatum → 1900-01-01 als
     * Marker. Im `notes`-Feld merken wir das, damit der Nutzer
     * solche Belege später schnell findet.
     */
    let issueDate = isoDate(r['Rechnungsdatum'])
    let datelessFallback = false
    if (!issueDate) {
      issueDate = isoDate(r['Bezahldatum']) ?? '1900-01-01'
      datelessFallback = true
    }

    const grossTotal = toFloat(r['RgGesamtbetrag']) ?? 0
    // `inkl=true`: Endbetrag bereits mit MwSt; netto rückrechnen.
    const inkl = toBool(r['Inkl'])
    const netTotal = inkl
      ? Math.round((grossTotal / (1 + taxRate / 100)) * 100) / 100
      : Math.round(grossTotal * 100) / 100
    const taxTotal = inkl
      ? Math.round((grossTotal - netTotal) * 100) / 100
      : Math.round(((netTotal * taxRate) / 100) * 100) / 100
    const grossDerived = inkl
      ? Math.round(grossTotal * 100) / 100
      : Math.round((netTotal + taxTotal) * 100) / 100

    invoiceDocRows.push({
      id,
      documentNumber: legacyNr,
      legacyDocumentNumber: legacyNr,
      type: 'invoice',
      status,
      customerId,
      vehicleId: null,
      issueDate,
      dueDate: isoDate(r['Bezahldatum']),
      taxRate: String(taxRate),
      netTotal: String(netTotal),
      taxTotal: String(taxTotal),
      grossTotal: String(grossDerived),
      header: null,
      footer: trim(r['Endtext']) ?? trim(r['Werbetext']),
      notes:
        [
          isInventoryAdj ? '[Bestandskorrektur]' : null,
          datelessFallback ? '[Importiert ohne Datum]' : null,
          trim(r['Sachbearbeiter'])
            ? `Sachbearbeiter: ${trim(r['Sachbearbeiter'])}`
            : null
        ]
          .filter(Boolean)
          .join(' ') || null
    })
  }
  await insertInBatches(invoiceDocRows, async (chunk) => {
    await db.insert(documents).values(chunk)
  })
  summary.invoices = invoiceDocRows.length

  /* — 8. Rechnungs-Positionen — */
  const invoiceItemRows: DocItemInsert[] = []
  // pos pro documentId aufzählen — Legacy `pos` ist global, wir wollen 1..n je Beleg.
  const posCounters = new Map<string, number>()
  for (const d of rechnungDetails) {
    const legacyNr = trim(d['Rechnungsnummer'])
    if (legacyNr == null) continue
    const documentId = invoiceIdByLegacyNr.get(legacyNr)
    if (!documentId) {
      summary.skipped.invoiceItems += 1
      continue
    }
    const pos = (posCounters.get(documentId) ?? 0) + 1
    posCounters.set(documentId, pos)

    const legacyArtNr = trim(d['Artikel-Nr'])
    const itemId =
      legacyArtNr && legacyArtNr !== '0'
        ? (itemIdByLegacyArtNr.get(legacyArtNr) ?? null)
        : null
    const qty = toFloat(d['Anzahl']) ?? 1
    const rawPrice = toFloat(d['Einzelpreis']) ?? 0
    // Legacy `Einzelpreis` folgt dem Header-`inkl`-Flag der Rechnung.
    // Wir vereinfachen: Preise auf Detail-Ebene als netto annehmen — die
    // Header-Summen wurden bereits korrekt berechnet (s. oben).
    const discountPercent = toFloat(d['Rabatt']) ?? 0
    const taxRate = 19 // Detail-Ebene hat in der Legacy-DB keine eigene Rate
    const lineNet =
      Math.round(qty * rawPrice * (1 - discountPercent / 100) * 100) / 100
    const lineGross = Math.round(lineNet * (1 + taxRate / 100) * 100) / 100

    invoiceItemRows.push({
      id: crypto.randomUUID(),
      documentId,
      positionNumber: pos,
      kind: mapArtToKind(trim(d['Art'])),
      itemId,
      articleNumber: trim(d['Artikelnummer']) ?? legacyArtNr,
      description: trim(d['Artikelbeschreibung']) ?? '—',
      quantity: String(qty),
      unit: trim(d['Mengeneinheit']),
      unitPriceNet: String(rawPrice),
      discountPercent: String(discountPercent),
      taxRate: String(taxRate),
      lineTotalNet: String(lineNet),
      lineTotalGross: String(lineGross)
    })
  }
  await insertInBatches(invoiceItemRows, async (chunk) => {
    await db.insert(documentItems).values(chunk)
  })
  summary.invoiceItems = invoiceItemRows.length

  /* — 9. Teilzahlungen — Spaltennamen aus dem MDB-Export sind
       `RGNR` / `Betrag` / `Bezahldatum` / `BezahlArt` (mit
       Großschreibung) — vorher hatten wir die fälschlicherweise
       lowercase nachgeschlagen, deshalb wurden alle 80 Zahlungen
       nicht importiert. — */
  const paymentRows: DocPayInsert[] = []
  for (const t of teilzahlungen) {
    const legacyNr = trim(t['RGNR'])
    if (legacyNr == null) continue
    const documentId = invoiceIdByLegacyNr.get(legacyNr)
    if (!documentId) {
      summary.skipped.payments += 1
      continue
    }
    const date = isoDate(t['Bezahldatum'])
    const amount = toFloat(t['Betrag'])
    if (!date || amount == null) continue
    paymentRows.push({
      id: crypto.randomUUID(),
      documentId,
      paymentDate: date,
      amount: String(amount),
      method: trim(t['BezahlArt'])
    })
  }
  await insertInBatches(paymentRows, async (chunk) => {
    await db.insert(documentPayments).values(chunk)
  })
  summary.invoicePayments = paymentRows.length

  /* — 10. Angebote (Offer / KV / AB) — */
  const offerIdByLegacyNr = new Map<string, string>()
  const offerDocRows: DocInsert[] = []
  for (const a of angebote) {
    const legacyNr = trim(a['Angebotsnummer'])
    if (legacyNr == null) continue
    const customerId =
      customerIdByLegacy.get(trim(a['Kunden-Nr']) ?? '') ?? null
    const id = crypto.randomUUID()
    offerIdByLegacyNr.set(legacyNr, id)
    const taxRate = toFloat(a['MWSteuer']) ?? 19
    let issueDate = isoDate(a['Angebotsdatum'])
    let datelessOffer = false
    if (!issueDate) {
      issueDate = '1900-01-01'
      datelessOffer = true
    }
    const grossTotal = toFloat(a['AgGesamtbetrag']) ?? 0
    const inkl = toBool(a['Inkl'])
    const netTotal = inkl
      ? Math.round((grossTotal / (1 + taxRate / 100)) * 100) / 100
      : Math.round(grossTotal * 100) / 100
    const taxTotal = inkl
      ? Math.round((grossTotal - netTotal) * 100) / 100
      : Math.round(((netTotal * taxRate) / 100) * 100) / 100
    const grossDerived = Math.round((netTotal + taxTotal) * 100) / 100

    offerDocRows.push({
      id,
      documentNumber: `AN-${legacyNr}`,
      // Angebotsnummern überschneiden sich nicht mit Rechnungen,
      // aber sicherheitshalber (uniq index) prefixen wir mit "AN-".
      legacyDocumentNumber: legacyNr,
      type: mapOfferType(trim(a['Formulartyp'])),
      status: mapOfferStatus(trim(a['Status'])),
      customerId,
      vehicleId: null,
      issueDate,
      taxRate: String(taxRate),
      netTotal: String(netTotal),
      taxTotal: String(taxTotal),
      grossTotal: String(grossDerived),
      footer: trim(a['Endtext']) ?? trim(a['Werbetext']),
      notes:
        [
          datelessOffer ? '[Importiert ohne Datum]' : null,
          trim(a['Sachbearbeiter'])
            ? `Sachbearbeiter: ${trim(a['Sachbearbeiter'])}`
            : null
        ]
          .filter(Boolean)
          .join(' ') || null
    })
  }
  await insertInBatches(offerDocRows, async (chunk) => {
    await db.insert(documents).values(chunk)
  })
  summary.offers = offerDocRows.length

  /* — 11. Angebot-Positionen — */
  const offerItemRows: DocItemInsert[] = []
  const offerPosCounters = new Map<string, number>()
  for (const d of angebotDetails) {
    const legacyNr = trim(d['angebotsnummer'])
    if (legacyNr == null) continue
    const documentId = offerIdByLegacyNr.get(legacyNr)
    if (!documentId) {
      summary.skipped.offerItems += 1
      continue
    }
    const pos = (offerPosCounters.get(documentId) ?? 0) + 1
    offerPosCounters.set(documentId, pos)

    const legacyArtNr = trim(d['Artikel-Nr'])
    const itemId =
      legacyArtNr && legacyArtNr !== '0'
        ? (itemIdByLegacyArtNr.get(legacyArtNr) ?? null)
        : null
    const qty = toFloat(d['Anzahl']) ?? 1
    const rawPrice = toFloat(d['Einzelpreis']) ?? 0
    const discountPercent = toFloat(d['Rabatt']) ?? 0
    const taxRate = 19
    const lineNet =
      Math.round(qty * rawPrice * (1 - discountPercent / 100) * 100) / 100
    const lineGross = Math.round(lineNet * (1 + taxRate / 100) * 100) / 100
    offerItemRows.push({
      id: crypto.randomUUID(),
      documentId,
      positionNumber: pos,
      kind: mapArtToKind(trim(d['Art'])),
      itemId,
      articleNumber: trim(d['Artikelnummer']) ?? legacyArtNr,
      description: trim(d['Artikelbeschreibung']) ?? '—',
      quantity: String(qty),
      unit: trim(d['Mengeneinheit']),
      unitPriceNet: String(rawPrice),
      discountPercent: String(discountPercent),
      taxRate: String(taxRate),
      lineTotalNet: String(lineNet),
      lineTotalGross: String(lineGross)
    })
  }
  await insertInBatches(offerItemRows, async (chunk) => {
    await db.insert(documentItems).values(chunk)
  })
  summary.offerItems = offerItemRows.length

  /* — 12. Mahnungen — */
  type ReminderInsert = typeof reminders.$inferInsert
  const reminderRows: ReminderInsert[] = []
  let reminderCounter = 1
  for (const m of mahnungen) {
    const legacyNr = trim(m['Rechnungsnummer'])
    if (legacyNr == null) continue
    const invoiceId = invoiceIdByLegacyNr.get(legacyNr)
    if (!invoiceId) {
      summary.skipped.reminders += 1
      continue
    }
    const issueDate = isoDate(m['Mahnung'])
    if (!issueDate) continue
    const level = toInt(m['NrMahnung']) ?? 1
    const fee = toFloat(m['Gebuehr']) ?? 0
    // Legacy speichert kein eigenes Fälligkeitsdatum — wir setzen
    // konservativ +14 Tage ab Mahnungsdatum als Default.
    const due = new Date(`${issueDate}T00:00:00Z`)
    due.setUTCDate(due.getUTCDate() + 14)
    const dueDate = due.toISOString().slice(0, 10)
    reminderRows.push({
      id: crypto.randomUUID(),
      invoiceId,
      documentNumber: `LEG-MA-${reminderCounter++}`,
      level,
      issueDate,
      dueDate,
      fee: String(fee),
      status: 'sent'
    })
  }
  await insertInBatches(reminderRows, async (chunk) => {
    await db.insert(reminders).values(chunk)
  })
  summary.reminders = reminderRows.length

  /* — 13. Number-Ranges auf Legacy-Max+1 setzen — */
  const maxCustomer = customerRows.reduce(
    (m, r) => Math.max(m, Number(r.customerNumber) || 0),
    0
  )
  const maxInvoice = invoiceDocRows.reduce(
    (m, r) => Math.max(m, Number(r.legacyDocumentNumber) || 0),
    0
  )
  const maxOffer = offerDocRows.reduce(
    (m, r) => Math.max(m, Number(r.legacyDocumentNumber) || 0),
    0
  )

  await db
    .update(numberRanges)
    .set({ nextValue: maxCustomer + 1, formatTemplate: '{N}' })
    .where(eq(numberRanges.kind, 'customer'))
  await db
    .update(numberRanges)
    .set({ nextValue: maxInvoice + 1, formatTemplate: '{N}' })
    .where(eq(numberRanges.kind, 'invoice'))
  // Angebote/KV/AB teilen den Legacy-Number-Pool — wir setzen alle drei
  // auf max+1, damit kein Zähler kleiner anfängt.
  for (const k of ['offer', 'cost_estimate', 'order_confirmation']) {
    await db
      .update(numberRanges)
      .set({ nextValue: maxOffer + 1, formatTemplate: '{N}' })
      .where(eq(numberRanges.kind, k))
  }

  /* — 14. PDF-Vorab-Generierung —
   *
   * Wir rendern alle Belege jetzt, damit der Detail-View später nur
   * noch aus dem `document_pdfs`-Cache liest. Bei 19k+ Belegen ist das
   * der Löwenanteil der Importzeit; wir parallelisieren in einem
   * begrenzten Pool, damit Memory und CPU nicht explodieren. Render-
   * Fehler werden geloggt und gezählt, brechen den Import aber nicht
   * ab — der Beleg-Datensatz bleibt erhalten und kann manuell neu
   * gerendert werden.
   */
  const { renderAndPersistDocumentPdf, renderAndPersistReminderPdf } =
    await import('./pdf-service')

  const allDocIds: string[] = [
    ...invoiceDocRows.map((r) => r.id as string),
    ...offerDocRows.map((r) => r.id as string)
  ]
  const PARALLEL = 8
  let cursor = 0
  const work = async () => {
    while (cursor < allDocIds.length) {
      const idx = cursor++
      try {
        await renderAndPersistDocumentPdf(allDocIds[idx])
        summary.pdfsRendered += 1
      } catch (err) {
        summary.skipped.pdfRenders += 1
        console.error('[import] PDF-Render fehlgeschlagen', allDocIds[idx], err)
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, work))

  for (const r of reminderRows) {
    try {
      await renderAndPersistReminderPdf(r.id as string)
      summary.pdfsRendered += 1
    } catch (err) {
      summary.skipped.pdfRenders += 1
      console.error('[import] Mahnungs-PDF-Render fehlgeschlagen', r.id, err)
    }
  }

  return summary
}
