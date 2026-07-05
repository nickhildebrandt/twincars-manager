import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests for the KFZ-Kaufmann → Postgres import.
 *
 * 1. The pure transform helpers (`__transforms`) — the legacy-data
 *    normalisation rules where a silent bug would corrupt records.
 * 2. A full pipeline run driven through a mocked `mdb-export` boundary,
 *    asserting the mapping, the read-before-wipe ordering, the skip
 *    report ("no silent failures", §15) and that a dry run writes
 *    nothing. This exercises the orchestration end-to-end without a
 *    real `.mdb` file or `mdbtools`.
 *
 * @group integration
 * @module import-service
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// PDF pre-rendering is irrelevant to the mapping assertions and would
// pull pdf-lib into the test — stub the dynamically-imported renderers.
vi.mock('./pdf-service', () => ({
  renderAndPersistDocumentPdf: vi.fn().mockResolvedValue(undefined),
  renderAndPersistReminderPdf: vi.fn().mockResolvedValue(undefined)
}))

// Canned `mdb-export` output per table, set per-test. `exec` is mocked
// to return the matching CSV (or empty for tables not in the fixture).
let csvByTable: Record<string, string> = {}

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const exec = (
    cmd: string,
    _opts: unknown,
    cb: (err: Error | null, res: { stdout: string; stderr: string }) => void
  ) => {
    const callback = typeof _opts === 'function' ? (_opts as typeof cb) : cb
    const table = Object.keys(csvByTable).find((t) => cmd.includes(`'${t}'`))
    callback(null, { stdout: table ? csvByTable[table] : '', stderr: '' })
  }
  return { ...actual, exec, default: { ...actual, exec } }
})

import { db } from '$lib/server/db/client'
import {
  customers,
  documentItems,
  documents,
  items,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'
import { __transforms, importMdb } from './import-service'

const {
  trim,
  clip,
  toInt,
  toFloat,
  toBool,
  isValidYmd,
  isoDate,
  isoTimestamp,
  parseLooseDate,
  splitMakeModel,
  mapArtToKind,
  mapInvoiceStatus,
  mapOfferStatus,
  mapOfferType,
  mapStorageSeason
} = __transforms

describe('import-service · trim / clip', () => {
  it('trims and nulls empty strings', () => {
    expect(trim('  x ')).toBe('x')
    expect(trim('   ')).toBeNull()
    expect(trim('')).toBeNull()
    expect(trim(null)).toBeNull()
    expect(trim(undefined)).toBeNull()
  })

  it('clips to a max length without touching shorter values', () => {
    expect(clip('hello', 10)).toBe('hello')
    expect(clip('hello', 3)).toBe('hel')
    expect(clip(null, 5)).toBeNull()
  })
})

describe('import-service · numeric coercion', () => {
  it('toInt parses integers, nulls garbage', () => {
    expect(toInt('42')).toBe(42)
    expect(toInt(' 7 ')).toBe(7)
    expect(toInt('abc')).toBeNull()
    expect(toInt(null)).toBeNull()
  })

  it('toFloat parses decimals, nulls garbage', () => {
    expect(toFloat('3.5')).toBe(3.5)
    expect(toFloat('x')).toBeNull()
    expect(toFloat(null)).toBeNull()
  })

  it('toBool only treats 1/true as true', () => {
    expect(toBool('1')).toBe(true)
    expect(toBool('true')).toBe(true)
    expect(toBool('TRUE')).toBe(true)
    expect(toBool('0')).toBe(false)
    expect(toBool('')).toBe(false)
    expect(toBool(null)).toBe(false)
  })
})

describe('import-service · date validation + parsing', () => {
  it('isValidYmd rejects implausible legacy dates', () => {
    expect(isValidYmd(2009, 6, 15)).toBe(true)
    expect(isValidYmd(297, 20, 1)).toBe(false)
    expect(isValidYmd(1899, 1, 1)).toBe(false)
    expect(isValidYmd(2009, 13, 1)).toBe(false)
    expect(isValidYmd(2009, 0, 1)).toBe(false)
    expect(isValidYmd(2009, 6, 32)).toBe(false)
  })

  it('isoDate keeps the date part of an mdb-export timestamp', () => {
    expect(isoDate('2009-06-15 13:45:00')).toBe('2009-06-15')
    expect(isoDate('2009-06-15')).toBe('2009-06-15')
  })

  it('isoDate rejects malformed / implausible dates', () => {
    expect(isoDate('0297-20-01')).toBeNull()
    expect(isoDate('not-a-date')).toBeNull()
    expect(isoDate(null)).toBeNull()
  })

  it('isoTimestamp parses to a Date (UTC) or null', () => {
    const d = isoTimestamp('2009-06-15 13:45:00')
    expect(d).toBeInstanceOf(Date)
    expect(d?.toISOString()).toBe('2009-06-15T13:45:00.000Z')
    expect(isoTimestamp('garbage')).toBeNull()
    expect(isoTimestamp(null)).toBeNull()
  })

  it('parseLooseDate handles the messy EZ/HU legacy formats', () => {
    expect(parseLooseDate('2009-06-15')).toBe('2009-06-15')
    expect(parseLooseDate('06.2009')).toBe('2009-06-01')
    expect(parseLooseDate('12.1999')).toBe('1999-12-01')
    expect(parseLooseDate('04/92')).toBe('1992-04-01')
    expect(parseLooseDate('04/08')).toBe('2008-04-01')
    expect(parseLooseDate('30.08.2008')).toBe('2008-08-30')
  })

  it('parseLooseDate rejects nonsense and out-of-range pieces', () => {
    expect(parseLooseDate('0600')).toBeNull()
    expect(parseLooseDate('13.2009')).toBeNull()
    expect(parseLooseDate('')).toBeNull()
    expect(parseLooseDate(null)).toBeNull()
  })
})

describe('import-service · field mapping', () => {
  it('splitMakeModel splits on the first space', () => {
    expect(splitMakeModel('VW Caddy')).toEqual({ make: 'VW', model: 'Caddy' })
    expect(splitMakeModel('VW Golf IV Generation')).toEqual({
      make: 'VW',
      model: 'Golf IV Generation'
    })
    expect(splitMakeModel('Smart')).toEqual({ make: 'Smart', model: null })
    expect(splitMakeModel(null)).toEqual({ make: null, model: null })
  })

  it('mapArtToKind maps the legacy Art field', () => {
    expect(mapArtToKind('Leistung')).toBe('service')
    expect(mapArtToKind('Material')).toBe('material')
    expect(mapArtToKind('Durchlaufposten')).toBe('pass_through')
    expect(mapArtToKind('Artikel')).toBe('article')
    expect(mapArtToKind(null)).toBe('article')
  })

  it('mapInvoiceStatus: storniert → cancelled, everything else → paid', () => {
    expect(mapInvoiceStatus({ status: 'Storniert', bezahldatum: null })).toBe(
      'cancelled'
    )
    expect(mapInvoiceStatus({ status: 'Bar', bezahldatum: null })).toBe('paid')
    expect(
      mapInvoiceStatus({ status: 'offen', bezahldatum: '2020-01-01' })
    ).toBe('paid')
    expect(mapInvoiceStatus({ status: null, bezahldatum: null })).toBe('paid')
  })

  it('mapOfferStatus: storniert → cancelled else sent', () => {
    expect(mapOfferStatus('Storniert')).toBe('cancelled')
    expect(mapOfferStatus('irgendwas')).toBe('sent')
    expect(mapOfferStatus(null)).toBe('sent')
  })

  it('mapOfferType maps Formulartyp to a document type', () => {
    expect(mapOfferType('Kostenvoranschlag')).toBe('cost_estimate')
    expect(mapOfferType('KV')).toBe('cost_estimate')
    expect(mapOfferType('Auftragsbestätigung')).toBe('order_confirmation')
    expect(mapOfferType('Angebot')).toBe('offer')
    expect(mapOfferType(null)).toBe('offer')
  })

  it('mapStorageSeason maps the legacy Art to a tire-storage season', () => {
    expect(mapStorageSeason('Winterreifen')).toBe('winter')
    expect(mapStorageSeason('Sommerreifen')).toBe('summer')
    expect(mapStorageSeason('Ganzjahresreifen')).toBe('allseason')
    expect(mapStorageSeason('Allwetter')).toBe('allseason')
    expect(mapStorageSeason('unbekannt')).toBeNull()
    expect(mapStorageSeason(null)).toBeNull()
  })
})

describe('import-service · full pipeline (mocked mdb-export)', () => {
  beforeEach(async () => {
    csvByTable = {}
    // The real run wipes before inserting; the dry run does not. Clear
    // FK-safe so back-to-back tests start from an empty business set.
    await db.delete(documentItems)
    await db.delete(documents)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(items)
    await db.delete(customers)
  })

  /** Two customers (one valid + one without a number), one vehicle with a
   *  valid holder + one orphaned vehicle, and one service article. */
  const seedFixtures = () => {
    csvByTable = {
      Kunden: [
        'Kunden-Nr;Firma;Vorname;Nachname',
        '1001;Müller GmbH;;',
        '1002;;Erika;Musterfrau',
        ';;Ohne;Nummer'
      ].join('\n'),
      Autos: [
        'Kunden-Nr;ID_Auto;KFZ-Typ;Kennzeichen;EZ',
        '1001;A-1;VW Caddy;B-AA 100;06.2009',
        '9999;A-2;Audi A4;F-OLD 1;'
      ].join('\n'),
      Artikel: [
        'Artikel-Nr;Artikelbeschreibung;Art;Einzelpreis',
        'ART-1;Ölwechsel;Leistung;49.90'
      ].join('\n')
    }
  }

  it('imports customers/vehicles/items and reports skips', async () => {
    seedFixtures()
    const summary = await importMdb(Buffer.from('fake-mdb'))

    expect(summary.customers).toBe(2)
    expect(summary.vehicles).toBe(1)
    expect(summary.items).toBe(1)

    // No silent failures: the customer without a number and the vehicle
    // with an unknown holder are both recorded as skips.
    expect(summary.skippedTotal).toBe(2)
    const reasons = summary.skippedDetail.map((s) => s.reason)
    expect(reasons.some((r) => /ohne Kunden-Nr/i.test(r))).toBe(true)
    expect(reasons.some((r) => /nicht gefunden/i.test(r))).toBe(true)

    // Rows actually landed in the DB with the mapped fields.
    const custRows = await db.select().from(customers)
    expect(custRows).toHaveLength(2)

    const vehRows = await db.select().from(vehicles)
    expect(vehRows).toHaveLength(1)
    expect(vehRows[0].make).toBe('VW')
    expect(vehRows[0].model).toBe('Caddy')
    expect(vehRows[0].firstRegistration).toBe('2009-06-01')

    const plateRows = await db.select().from(vehicleLicensePlateVersions)
    expect(plateRows).toHaveLength(1)
    expect(plateRows[0].licensePlate).toBe('B-AA 100')

    const itemRows = await db.select().from(items)
    expect(itemRows).toHaveLength(1)
    expect(itemRows[0].kind).toBe('service')
  })

  it('backfills zero-header invoice totals from the line items (73% of legacy rows)', async () => {
    csvByTable = {
      Kunden: ['Kunden-Nr;Firma', '1001;Müller GmbH'].join('\n'),
      Rechnungen: [
        'Rechnungsnummer;Kunden-Nr;Rechnungsdatum;MWSteuer;Inkl;RgGesamtbetrag;Status;Bezahldatum',
        // Header total PRESENT → header wins, even with items.
        '20080001;1001;2008-08-29 00:00:00;19;0;100;Bezahlt;2008-08-29 00:00:00',
        // Header total EMPTY → totals must come from the line items.
        '20080002;1001;2008-09-05 00:00:00;19;0;0;Bezahlt;2008-09-05 00:00:00'
      ].join('\n'),
      RechnungDetails: [
        'pos;Rechnungsnummer;Artikel-Nr;Anzahl;Einzelpreis;Mengeneinheit;Artikelbeschreibung;Art;Artikelnummer;Rabatt',
        // Belongs to the header-total invoice — must NOT override it.
        '1;20080001;0;1;42;Stk;Egal;Material;;',
        // Zero-header invoice: 2×10 net + 1×30 with 10% Rabatt = 47 net.
        '1;20080002;0;2;10;Stk;Öl;Material;;',
        '2;20080002;0;1;30;Stk;Filter;Material;;10'
      ].join('\n')
    }
    const summary = await importMdb(Buffer.from('fake-mdb'))
    expect(summary.invoices).toBe(2)
    expect(summary.invoiceItems).toBe(3)

    const docs = await db.select().from(documents)
    const withHeader = docs.find((d) => d.documentNumber === '20080001')!
    const zeroHeader = docs.find((d) => d.documentNumber === '20080002')!

    // Header total wins (net=100, 19% → gross 119) despite the 42€ line.
    expect(Number(withHeader.netTotal)).toBe(100)
    expect(Number(withHeader.grossTotal)).toBe(119)

    // Zero header → derived: net 47, gross 2×10×1.19 + 27×1.19 = 55.93.
    expect(Number(zeroHeader.netTotal)).toBe(47)
    expect(Number(zeroHeader.grossTotal)).toBeCloseTo(55.93, 2)
    expect(Number(zeroHeader.taxTotal)).toBeCloseTo(8.93, 2)
  })

  it('backfills zero-header offer totals from the line items', async () => {
    csvByTable = {
      Kunden: ['Kunden-Nr;Firma', '1001;Müller GmbH'].join('\n'),
      Angebote: [
        'Angebotsnummer;Kunden-Nr;Angebotsdatum;MWSteuer;Inkl;AgGesamtbetrag;Status;Formulartyp',
        '5001;1001;2009-01-10 00:00:00;19;0;0;;Angebot'
      ].join('\n'),
      AngebotDetails: [
        'pos;Angebotsnummer;Artikel-Nr;Anzahl;Einzelpreis;Mengeneinheit;Artikelbeschreibung;Art;Artikelnummer;Rabatt',
        '1;5001;0;4;25;Stk;Reifen;Material;;'
      ].join('\n')
    }
    const summary = await importMdb(Buffer.from('fake-mdb'))
    expect(summary.offers).toBe(1)

    const [offer] = await db.select().from(documents)
    expect(offer.type).toBe('offer')
    expect(Number(offer.netTotal)).toBe(100)
    expect(Number(offer.grossTotal)).toBe(119)
  })

  it('dry run computes the same counts but writes nothing', async () => {
    seedFixtures()
    const summary = await importMdb(Buffer.from('fake-mdb'), { dryRun: true })

    expect(summary.dryRun).toBe(true)
    expect(summary.customers).toBe(2)
    expect(summary.vehicles).toBe(1)
    expect(summary.items).toBe(1)

    // The destructive run never happened — tables stay empty.
    expect(await db.select().from(customers)).toHaveLength(0)
    expect(await db.select().from(vehicles)).toHaveLength(0)
    expect(await db.select().from(items)).toHaveLength(0)
  })
})
