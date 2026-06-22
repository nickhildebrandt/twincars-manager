/**
 * DATEV CSV (Buchungsstapel) export.
 *
 * The DATEV "Format CSV" is the file the Steuerberater imports into
 * DATEV Rechnungswesen / Kanzlei-Rechnungswesen. Spec:
 * https://developer.datev.de/de/datev-apis/datev-rechnungswesen/dateischnittstelle-online-datev-format-csv/
 *
 * Structure (Version 7.0, still the supported interchange shape):
 *
 *   Line 1: "EXTF";<format-version>;<header-id>;"Buchungsstapel";<schema-version>;
 *           <created-at>;...;<consultant-no>;<client-no>;...;<from>;<to>;...
 *   Line 2: Column-name header — semicolon-separated, in fixed order.
 *   Line 3..N: Buchungssätze — one row per posting. The columns we
 *              actually populate are:
 *                 Umsatz (Soll/Haben-Betrag), Soll-/Haben-Kennzeichen
 *                 (S/H), WKZ Umsatz (EUR), Konto, Gegenkonto, BU-Schlüssel
 *                 (leer), Belegdatum (DDMM), Belegfeld 1 (Beleg-Nr.),
 *                 Buchungstext.
 *              Alle übrigen Spalten bleiben leer aber sind als
 *              Semikolon-Platzhalter da, damit der Header zur Zeile passt.
 *
 * Encoding: DATEV verlangt CP1252 (Windows-1252). Wir bauen die Datei
 * im Speicher als JS-String und konvertieren am Ende auf einen
 * `Buffer` mit CP1252-Bytes; der Aufrufer kodiert für die Wire ggf.
 * base64 darüber. Der Rückgabewert ist ein *Latin-1-String*: jeder
 * `charCodeAt(i)` ist exakt das CP1252-Byte.
 *
 * Konten-Mapping (SKR03-orientiert, minimaler Default):
 *   - Verkaufs-Rechnungen          → Konto 8400 (Erlöse 19% USt), Gegen
 *                                    1400 (Debitor Sammel)
 *   - Ledger-Einnahmen ohne Kat.   → wie Rechnungen
 *   - Ledger-Ausgaben (Material)   → Konto 3400, Gegen 1600 (Kassen-/
 *                                    Bank-Sammel)
 *   - Ledger-Ausgaben (sonstige)   → Konto 4980, Gegen 1600
 * Der Steuerberater korrigiert die Konten ohnehin nach SKR; die hier
 * gewählten Defaults sind nur sinnvolle Anhaltswerte.
 */

import { and, asc, gte, lte } from 'drizzle-orm'
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

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

/**
 * DATEV Buchungsstapel-Spalten (Format 7.0). Wir geben nur eine kuratierte
 * Teilmenge effektiv aus; alle übrigen Spalten bleiben leer, sind aber
 * im Header aufgeführt, damit Spaltenzahl exakt mit dem Stapel
 * übereinstimmt.
 *
 * Reihenfolge entspricht der offiziellen DATEV-Spec (Auszug der ersten
 * 27 Spalten, die für eine einfache Buchung relevant sind). Wir
 * verzichten auf die 100+ optionalen Anlage-Spalten, weil sie für die
 * grundlegende Buchhaltungs-Übergabe nicht erforderlich sind.
 */
const COLUMN_HEADER = [
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
  'Beleginfo - Art 1',
  'Beleginfo - Inhalt 1',
  'KOST1 - Kostenstelle',
  'KOST2 - Kostenstelle',
  'KOST-Menge',
  'EU-Land u. UStID (Bestimmung)',
  'EU-Steuersatz (Bestimmung)'
]

/**
 * EXTF/DTVF header line. Format 7.0, schema "Buchungsstapel"
 * (Format-Kategorie 21). Many of the slots are metadata — DATEV reads
 * the consultant/client number from columns 11/12 of the first line.
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
  // Columns per DATEV spec, semicolon-separated:
  //  1 "EXTF"
  //  2 Version (e.g. 700)
  //  3 Datenkategorie (21 = Buchungsstapel)
  //  4 "Buchungsstapel"
  //  5 Format-Version (7)
  //  6 Erzeugt am (YYYYMMDDHHMMSSmmm)
  //  7 importiert (leer)
  //  8 Herkunft ("RE" generisch)
  //  9 Exportiert von (max 25)
  // 10 Importiert von (leer)
  // 11 Beraternummer
  // 12 Mandantennummer
  // 13 WJ-Beginn
  // 14 Sachkontenlänge (4)
  // 15 Datum von (YYYYMMDD)
  // 16 Datum bis (YYYYMMDD)
  // 17 Bezeichnung
  // 18 Diktatkürzel ("")
  // 19 Buchungstyp (1 = Finanzbuchführung)
  // 20 Rechnungslegungszweck (0)
  // 21 Festschreibung (1)
  // 22 WKZ (EUR)
  const cols: string[] = [
    csvText('EXTF'),
    '700',
    '21',
    csvText('Buchungsstapel'),
    '7',
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
    csvText(`TwinCars ${params.from}–${params.to}`),
    '',
    '1',
    '0',
    '1',
    csvText('EUR')
  ]
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
  cells[10] = csvText(r.beleg) // Belegfeld 1
  cells[13] = csvText(r.text) // Buchungstext
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
 * Render the DATEV Buchungsstapel CSV for the given date range.
 *
 * Pulls
 *   - every invoice with `issueDate` in `[from, to]`, posted as
 *     `Erlöse → Debitor`
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
        type: documents.type,
        status: documents.status
      })
      .from(documents)
      .where(and(gte(documents.issueDate, from), lte(documents.issueDate, to)))
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
    if (inv.type !== 'invoice') continue
    const accounts = accountsForCategory('income', 'Erlöse')
    const isStorno = inv.status === 'storno'
    // GoBD/UStG-Storno: eine Stornorechnung verbucht den Erlös vom
    // Debitor zurück. DATEV-Konvention für eine Gegenbuchung: Soll und
    // Haben werden vertauscht, Beträge bleiben positiv. Wir nehmen
    // hier den Absolutbetrag (Storno-`grossTotal` ist im Datenmodell
    // negativ) und setzen `soHa = 'S'` plus Konto↔Gegenkonto
    // gespiegelt. Quelle: DATEV-Format CSV 7.0, Abschnitt
    // "Erlösminderung / Storno-Beleg".
    // Beleg-Text macht den Storno-Bezug explizit, damit der
    // Steuerberater im Import sofort sieht, dass es sich nicht um
    // einen neuen Umsatz handelt.
    rows.push({
      amount: Math.abs(Number(inv.grossTotal ?? 0)),
      soHa: isStorno ? 'S' : 'H',
      konto: isStorno ? accounts.gegenkonto : accounts.konto,
      gegenkonto: isStorno ? accounts.konto : accounts.gegenkonto,
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
