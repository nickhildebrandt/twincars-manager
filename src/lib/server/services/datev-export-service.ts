/**
 * DATEV CSV (Buchungsstapel) export.
 *
 * The DATEV "Format CSV" is the file the Steuerberater imports into
 * DATEV Rechnungswesen / Kanzlei-Rechnungswesen. Spec:
 * https://developer.datev.de/de/datev-apis/datev-rechnungswesen/dateischnittstelle-online-datev-format-csv/
 *
 * Structure (EXTF header version 700, Buchungsstapel Formatversion 13):
 *
 *   Line 1: EXTF header — exactly 31 semicolon-separated fields
 *           ("EXTF";700;21;"Buchungsstapel";13;<created-at>;...;
 *           <consultant-no>;<client-no>;...;<from>;<to>;... plus
 *           trailing empty fields up to 31).
 *   Line 2: Column-name header — the full 125-field Buchungsstapel
 *           column set of Formatversion 13, in fixed order.
 *   Line 3..N: Buchungssätze — one row per posting, always padded to
 *              125 semicolon-separated cells. The columns we actually
 *              populate are:
 *                 Umsatz (Soll/Haben-Betrag), Soll-/Haben-Kennzeichen
 *                 (S/H), WKZ Umsatz (EUR), Konto, Gegenkonto,
 *                 BU-Schlüssel (empty), Belegdatum (DDMM),
 *                 Belegfeld 1 (document number), Buchungstext.
 *              All other cells stay empty but are present as semicolon
 *              placeholders so every row matches the header width.
 *
 * Encoding: DATEV requires CP1252 (Windows-1252). We build the file in
 * memory as a JS string and convert it at the end into a "Latin-1
 * string": every `charCodeAt(i)` is exactly the CP1252 byte. The
 * caller wraps it in `Buffer.from(s, 'latin1')` and base64-encodes it
 * for the wire.
 *
 * Account mapping (SKR03-oriented, minimal default):
 *   - sales invoices               → Konto 8400 (Erlöse 19% USt),
 *                                    Gegenkonto 1400 (Debitor Sammel)
 *   - ledger income w/o category   → like invoices
 *   - ledger expenses (material)   → Konto 3400, Gegenkonto 1600
 *   - ledger expenses (other)      → Konto 4980, Gegenkonto 1600
 * The Steuerberater corrects the accounts on import anyway; the
 * defaults here only aim to be sensible starting points.
 */

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  documents,
  ledgerCategories,
  ledgerEntries
} from '$lib/server/db/schema'

/* ------------------------------------------------------------------ */
/* Account mapping                                                    */
/* ------------------------------------------------------------------ */

/**
 * Lightweight mapping from a ledger-category name to a default DATEV
 * Konto + Gegenkonto. The Steuerberater can override on import — the
 * defaults aim to be "obviously close" rather than authoritative.
 */
type AccountPair = { konto: string; gegenkonto: string }

const ACCOUNT_MAP: { match: RegExp; accounts: AccountPair }[] = [
  // Werkstatt / Material
  {
    match: /material|werkstatt|teile/i,
    accounts: { konto: '3400', gegenkonto: '1600' }
  },
  // Bürobedarf / Verwaltung
  {
    match: /büro|office|verwaltung/i,
    accounts: { konto: '4930', gegenkonto: '1600' }
  },
  // Miete / Pacht
  {
    match: /miete|pacht|raum/i,
    accounts: { konto: '4210', gegenkonto: '1600' }
  },
  // Telefon / Internet
  {
    match: /telefon|internet|porto/i,
    accounts: { konto: '4920', gegenkonto: '1600' }
  },
  // Versicherung
  { match: /versicherung/i, accounts: { konto: '4360', gegenkonto: '1600' } },
  // Kraftstoff
  {
    match: /kraftstoff|sprit|tank/i,
    accounts: { konto: '4530', gegenkonto: '1600' }
  },
  // Fahrzeugverkauf / Erlöse
  {
    match: /verkauf|erlös|umsatz/i,
    accounts: { konto: '8400', gegenkonto: '1400' }
  }
]

const accountsForCategory = (
  direction: 'income' | 'expense',
  categoryName: string | null
): AccountPair => {
  if (categoryName) {
    for (const entry of ACCOUNT_MAP) {
      if (entry.match.test(categoryName)) return entry.accounts
    }
  }
  return direction === 'income'
    ? { konto: '8400', gegenkonto: '1400' }
    : { konto: '4980', gegenkonto: '1600' }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * DATEV writes monetary amounts with comma decimal and at most two
 * decimal places, sign in a separate column (S/H), no thousand
 * separators. We always store the absolute value here.
 */
const fmtAmount = (v: number | string | null | undefined): string => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return Math.abs(Math.round(n * 100) / 100)
    .toFixed(2)
    .replace('.', ',')
}

/** DDMM (just the day+month) — DATEV expects the year via the header. */
const fmtDateDdmm = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}${m[2]}` : ''
}

/** DD.MM.YYYY — used for the file-name + the header dates. */
export const fmtDateDot = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}

/** YYYYMMDD — DATEV uses this in the EXTF header for from/to date. */
const fmtDateCompact = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

/**
 * DATEV CSV string quoting: text fields are wrapped in double quotes;
 * embedded quotes are doubled. Numbers stay unquoted.
 */
const csvText = (s: string | null | undefined): string => {
  if (s === null || s === undefined) return ''
  const escaped = String(s).replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Sanitize a Buchungstext for DATEV: line breaks and semicolons would
 * break the CSV row structure, so they are collapsed into spaces; the
 * spec caps the field at 60 characters.
 */
export const sanitizeBookingText = (s: string | null | undefined): string => {
  if (!s) return ''
  return s
    .replace(/[\r\n;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/**
 * Sanitize Belegfeld 1 (receipt / document number). The DATEV spec
 * allows only digits, letters and the special characters $ % & * + - /
 * with a maximum length of 36. Everything else is dropped.
 */
export const sanitizeBelegfeld = (s: string | null | undefined): string => {
  if (!s) return ''
  return s.replace(/[^0-9A-Za-z$%&*+\-/]/g, '').slice(0, 36)
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

/**
 * DATEV Buchungsstapel columns, Formatversion 13 — the full 125-field
 * set. DATEV Rechnungswesen validates that the column header and every
 * data row carry exactly this column count, so we must list all fields
 * even though we only populate a small subset. Field names follow the
 * official spec; the one field the spec marks as reserved is emitted
 * as "Leerfeld".
 */
const COLUMN_HEADER: string[] = [
  // 1-20
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  // 21-36: Beleginfo pairs 1..8
  ...Array.from({ length: 8 }, (_, i) => [
    `Beleginfo - Art ${i + 1}`,
    `Beleginfo - Inhalt ${i + 1}`
  ]).flat(),
  // 37-41
  'KOST1 - Kostenstelle',
  'KOST2 - Kostenstelle',
  'KOST-Menge',
  'EU-Land u. UStID (Bestimmung)',
  'EU-Steuersatz (Bestimmung)',
  // 42-47
  'Abw. Versteuerungsart',
  'Sachverhalt L+L',
  'Funktionsergänzung L+L',
  'BU 49 Hauptfunktionstyp',
  'BU 49 Hauptfunktionsnummer',
  'BU 49 Funktionsergänzung',
  // 48-87: Zusatzinformation pairs 1..20
  ...Array.from({ length: 20 }, (_, i) => [
    `Zusatzinformation - Art ${i + 1}`,
    `Zusatzinformation - Inhalt ${i + 1}`
  ]).flat(),
  // 88-102
  'Stück',
  'Gewicht',
  'Zahlweise',
  'Forderungsart',
  'Veranlagungsjahr',
  'Zugeordnete Fälligkeit',
  'Skontotyp',
  'Auftragsnummer',
  'Buchungstyp',
  'USt-Schlüssel (Anzahlungen)',
  'EU-Land (Anzahlungen)',
  'Sachverhalt L+L (Anzahlungen)',
  'EU-Steuersatz (Anzahlungen)',
  'Erlöskonto (Anzahlungen)',
  'Herkunft-Kz',
  // 103: reserved in Formatversion 13
  'Leerfeld',
  // 104-114
  'KOST-Datum',
  'SEPA-Mandatsreferenz',
  'Skontosperre',
  'Gesellschaftername',
  'Beteiligtennummer',
  'Identifikationsnummer',
  'Zeichnernummer',
  'Postensperre bis',
  'Bezeichnung SoBil-Sachverhalt',
  'Kennzeichen SoBil-Buchung',
  'Festschreibung',
  // 115-125
  'Leistungsdatum',
  'Datum Zuord. Steuerperiode',
  'Fälligkeit',
  'Generalumkehr (GU)',
  'Steuersatz',
  'Land',
  'Abrechnungsreferenz',
  'BVV-Position',
  'EU-Land u. UStID (Ursprung)',
  'EU-Steuersatz (Ursprung)',
  'Abw. Skontokonto'
]

/** Number of fields the EXTF header line must carry (header version 5). */
const EXTF_HEADER_FIELD_COUNT = 31

/**
 * EXTF/DTVF header line. Header version 700, data category 21
 * ("Buchungsstapel"), Formatversion 13 — the combination current DATEV
 * Rechnungswesen releases accept. DATEV reads the consultant/client
 * number from fields 11/12. The line must carry exactly 31
 * semicolon-separated fields; the unused trailing ones stay empty.
 */
const buildExtfHeader = (params: {
  from: string
  to: string
  now: Date
  consultantNo: string
  clientNo: string
}): string => {
  const createdAt =
    params.now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14) + '000'
  const yyyy = params.from.slice(0, 4)
  const wjBegin = `${yyyy}0101`
  // Fields per DATEV spec, semicolon-separated:
  //  1 "EXTF"
  //  2 header version (700)
  //  3 data category (21 = Buchungsstapel)
  //  4 "Buchungsstapel"
  //  5 Formatversion (13 for the 700 header)
  //  6 created at (YYYYMMDDHHMMSSmmm)
  //  7 imported (empty, reserved)
  //  8 origin ("RE" generic)
  //  9 exported by (max 25)
  // 10 imported by (empty, reserved)
  // 11 consultant number
  // 12 client number
  // 13 fiscal-year begin (YYYYMMDD)
  // 14 G/L account length (4)
  // 15 date from (YYYYMMDD)
  // 16 date to (YYYYMMDD)
  // 17 description
  // 18 dictation shorthand (empty)
  // 19 posting type (1 = Finanzbuchführung)
  // 20 accounting purpose (0)
  // 21 Festschreibung (1)
  // 22 currency (EUR)
  // 23-31 reserved / unused (empty)
  const cols: string[] = [
    csvText('EXTF'),
    '700',
    '21',
    csvText('Buchungsstapel'),
    '13',
    createdAt,
    '',
    csvText('RE'),
    csvText('TwinCarsManager'),
    '',
    params.consultantNo,
    params.clientNo,
    wjBegin,
    '4',
    fmtDateCompact(params.from),
    fmtDateCompact(params.to),
    csvText(`TwinCars ${params.from}-${params.to}`),
    '',
    '1',
    '0',
    '1',
    csvText('EUR')
  ]
  while (cols.length < EXTF_HEADER_FIELD_COUNT) cols.push('')
  return cols.join(';')
}

const buildColumnHeader = (): string =>
  COLUMN_HEADER.map((h) => csvText(h)).join(';')

/* ------------------------------------------------------------------ */
/* Row builder                                                        */
/* ------------------------------------------------------------------ */

type Row = {
  amount: number
  soHa: 'S' | 'H'
  konto: string
  gegenkonto: string
  date: string // YYYY-MM-DD
  beleg: string
  text: string
}

const renderRow = (r: Row): string => {
  const cells: string[] = new Array(COLUMN_HEADER.length).fill('')
  cells[0] = fmtAmount(r.amount) // Umsatz (no S/H)
  cells[1] = csvText(r.soHa) // Soll/Haben-Kennzeichen
  cells[2] = csvText('EUR') // WKZ Umsatz
  cells[6] = csvText(r.konto) // Konto
  cells[7] = csvText(r.gegenkonto) // Gegenkonto
  cells[9] = fmtDateDdmm(r.date) // Belegdatum (DDMM)
  cells[10] = csvText(sanitizeBelegfeld(r.beleg)) // Belegfeld 1
  cells[13] = csvText(sanitizeBookingText(r.text)) // Buchungstext
  return cells.join(';')
}

/* ------------------------------------------------------------------ */
/* CP1252 encoding                                                    */
/* ------------------------------------------------------------------ */

/**
 * Map of Unicode → CP1252 byte for the few codepoints CP1252 places
 * in the 0x80..0x9F range (which differ from Latin-1). Anything not
 * here is either Latin-1 (charCode < 256) or unrepresentable; the
 * latter we substitute with `?` to stay schema-valid.
 */
const CP1252_HIGH_MAP: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
}

/**
 * Convert a JS string to a "Latin-1 string" whose `charCodeAt(i)` is
 * the CP1252 byte. The caller passes this through
 * `Buffer.from(str, 'latin1').toString('base64')` to ship over the
 * wire without any further encoding fiddling.
 */
const toCp1252LatinString = (input: string): string => {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const cp = input.charCodeAt(i)
    if (cp < 0x80) {
      out += input.charAt(i)
    } else if (cp < 0x100) {
      // Latin-1 supplement maps 1:1 to CP1252 in this range.
      out += input.charAt(i)
    } else if (CP1252_HIGH_MAP[cp] !== undefined) {
      out += String.fromCharCode(CP1252_HIGH_MAP[cp])
    } else {
      out += '?'
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Public renderer                                                    */
/* ------------------------------------------------------------------ */

export type DatevExportParams = {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  consultantNo?: string
  clientNo?: string
}

/**
 * Invoice statuses that represent real, booked revenue. Drafts
 * (`created`) and voided drafts (`cancelled`) never reach the
 * Steuerberater — exporting them would book revenue that does not
 * exist.
 */
const EXPORTED_INVOICE_STATUSES = ['sent', 'paid', 'storno'] as const

/**
 * Render the DATEV Buchungsstapel CSV for the given date range.
 *
 * Pulls
 *   - every invoice with `issueDate` in `[from, to]` and status
 *     `sent` / `paid` / `storno`, posted as `Erlöse → Debitor`
 *   - every ledger entry with `entryDate` in `[from, to]`, posted with
 *     the category-derived account pair
 *
 * The result is a "Latin-1 string": each `charCodeAt` is the exact
 * CP1252 byte that DATEV expects. The remote layer wraps it in
 * `Buffer.from(s, 'latin1')` and base64-encodes.
 */
export const exportDatevCsv = async (
  params: DatevExportParams
): Promise<string> => {
  const { from, to, consultantNo = '1000', clientNo = '10000' } = params

  // Pull source data in parallel.
  const [invoiceRows, ledgerRows, categories] = await Promise.all([
    db
      .select({
        documentNumber: documents.documentNumber,
        issueDate: documents.issueDate,
        grossTotal: documents.grossTotal,
        status: documents.status
      })
      .from(documents)
      .where(
        and(
          eq(documents.type, 'invoice'),
          inArray(documents.status, [...EXPORTED_INVOICE_STATUSES]),
          gte(documents.issueDate, from),
          lte(documents.issueDate, to)
        )
      )
      .orderBy(asc(documents.issueDate)),
    db
      .select()
      .from(ledgerEntries)
      .where(
        and(
          gte(ledgerEntries.entryDate, from),
          lte(ledgerEntries.entryDate, to)
        )
      )
      .orderBy(asc(ledgerEntries.entryDate)),
    db.select().from(ledgerCategories)
  ])

  const catName = new Map<string, string>()
  for (const c of categories) catName.set(c.id, c.name)

  const rows: Row[] = []

  for (const inv of invoiceRows) {
    const accounts = accountsForCategory('income', 'Erlöse')
    const isStorno = inv.status === 'storno'
    // Storno (reversal): the revenue is booked back by flipping ONLY
    // the Soll/Haben-Kennzeichen from 'H' to 'S' while Konto and
    // Gegenkonto stay exactly as on the original invoice. Flipping S/H
    // AND swapping the accounts would negate twice and post the same
    // revenue again instead of reversing it. Amounts are always
    // positive (the storno `grossTotal` is negative in the data model,
    // so we take the absolute value). The Buchungstext makes the
    // storno explicit so the Steuerberater sees it is a correction.
    rows.push({
      amount: Math.abs(Number(inv.grossTotal ?? 0)),
      soHa: isStorno ? 'S' : 'H',
      konto: accounts.konto,
      gegenkonto: accounts.gegenkonto,
      date: inv.issueDate,
      beleg: inv.documentNumber,
      text: isStorno
        ? `Storno Rechnung ${inv.documentNumber}`
        : `Rechnung ${inv.documentNumber}`
    })
  }

  for (const e of ledgerRows) {
    const accounts = accountsForCategory(
      e.direction as 'income' | 'expense',
      e.categoryId ? (catName.get(e.categoryId) ?? null) : null
    )
    rows.push({
      amount: Number(e.amountGross ?? 0),
      soHa: e.direction === 'income' ? 'H' : 'S',
      konto: accounts.konto,
      gegenkonto: accounts.gegenkonto,
      date: e.entryDate,
      beleg: e.entryNumber ?? '',
      text: e.description
    })
  }

  // Sort by date for human readability.
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const lines: string[] = []
  lines.push(
    buildExtfHeader({ from, to, now: new Date(), consultantNo, clientNo })
  )
  lines.push(buildColumnHeader())
  for (const r of rows) lines.push(renderRow(r))

  // DATEV expects \r\n line endings.
  const text = lines.join('\r\n') + '\r\n'
  return toCp1252LatinString(text)
}
