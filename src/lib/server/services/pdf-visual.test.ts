// @vitest-environment node
/**
 * PDF visual regression harness.
 *
 * Every fixture below is rendered to PDF, rasterized page by page via
 * poppler's `pdftoppm` (72 dpi) and compared pixel-wise against the
 * committed snapshot PNGs in `__pdf_snapshots__/`. The comparison is a
 * dependency-free pure-node differ:
 *
 * - the *actual* pages are parsed from pdftoppm's PPM output (P6 —
 *   trivial header + raw RGB),
 * - the *expected* pages are decoded from the committed PNGs with a
 *   minimal decoder (8-bit gray / RGB / palette / RGBA, non-interlaced —
 *   exactly what pdftoppm emits),
 * - a pixel counts as different when any RGB channel deviates by more
 *   than {@link CHANNEL_TOLERANCE}; a page fails when more than
 *   {@link MAX_DIFF_RATIO} of its pixels differ. The tolerance absorbs
 *   anti-aliasing drift across poppler versions while still catching
 *   layout shifts, overlaps and missing text.
 *
 * On failure the actual page, the expected snapshot and a magenta
 * diff-marker PNG are written to `tmp/pdf-visual/failures/` for human
 * inspection.
 *
 * Updating snapshots: `PDF_SNAPSHOTS=update pnpm exec vitest run pdf-visual`
 *
 * Determinism: rendering is byte-deterministic (fixed fixture dates;
 * the renderers derive the PDF /CreationDate + /ModDate from the
 * entity's `updatedAt` instead of wall-clock time) — asserted by the
 * double-render hash tests at the bottom.
 */
import { describe, expect, it } from 'vitest'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import {
  renderDocumentPdf,
  renderReminderPdf,
  renderTireStorageLabelPdf,
  renderVehicleSaleSignPdf,
  type DocumentRenderInput,
  type ReminderRenderInput
} from './pdf-service'
import type {
  CompanySettings,
  Customer,
  Document,
  DocumentItem,
  Reminder,
  TireStorage,
  Vehicle
} from '$lib/server/db/schema'

const execFileAsync = promisify(execFile)

const SNAPSHOT_DIR = join(
  process.cwd(),
  'src',
  'lib',
  'server',
  'services',
  '__pdf_snapshots__'
)
const WORK_DIR = join(process.cwd(), 'tmp', 'pdf-visual')
const FAILURE_DIR = join(WORK_DIR, 'failures')
const UPDATE_MODE = process.env.PDF_SNAPSHOTS === 'update'

/** Per-channel delta above which a pixel counts as different. */
const CHANNEL_TOLERANCE = 32
/** Fraction of differing pixels above which a page fails. */
const MAX_DIFF_RATIO = 0.005

const HAS_PDFTOPPM = (() => {
  try {
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

/* ------------------------------------------------------------------ */
/* Pure-node image plumbing (no image libraries)                      */
/* ------------------------------------------------------------------ */

type RgbImage = { width: number; height: number; data: Buffer }

/** Parse a binary PPM (P6) file — pdftoppm's native output format. */
const parsePpm = (buf: Buffer): RgbImage => {
  let pos = 0
  const isSpace = (b: number) =>
    b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d
  const readToken = (): string => {
    while (pos < buf.length && isSpace(buf[pos])) pos += 1
    if (buf[pos] === 0x23) {
      while (pos < buf.length && buf[pos] !== 0x0a) pos += 1
      return readToken()
    }
    const start = pos
    while (pos < buf.length && !isSpace(buf[pos])) pos += 1
    return buf.subarray(start, pos).toString('ascii')
  }
  const magic = readToken()
  if (magic !== 'P6') throw new Error(`Unsupported PPM magic: ${magic}`)
  const width = Number(readToken())
  const height = Number(readToken())
  const maxVal = Number(readToken())
  if (maxVal !== 255) throw new Error(`Unsupported PPM maxval: ${maxVal}`)
  pos += 1 // exactly one whitespace byte after maxval
  const data = Buffer.from(buf.subarray(pos, pos + width * height * 3))
  if (data.length !== width * height * 3) {
    throw new Error('Truncated PPM payload')
  }
  return { width, height, data }
}

/**
 * Minimal PNG decoder for pdftoppm-style files: 8-bit depth, color
 * types 0 (gray), 2 (RGB), 3 (palette) or 6 (RGBA), non-interlaced.
 * Output is always flattened to RGB.
 */
const decodePng = (buf: Buffer): RgbImage => {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG file')
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let palette: Buffer | null = null
  const idat: Buffer[] = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii')
    const chunk = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0)
      height = chunk.readUInt32BE(4)
      bitDepth = chunk[8]
      colorType = chunk[9]
      interlace = chunk[12]
    } else if (type === 'PLTE') {
      palette = Buffer.from(chunk)
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(chunk))
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(
      `Unsupported PNG (bitDepth=${bitDepth}, interlace=${interlace})`
    )
  }
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 6: 4 }
  const channels = channelsByType[colorType]
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 3)
  const prior = Buffer.alloc(stride)
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
  }
  for (let yRow = 0; yRow < height; yRow++) {
    const rowStart = yRow * (stride + 1)
    const filter = raw[rowStart]
    const row = raw.subarray(rowStart + 1, rowStart + 1 + stride)
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      const up = prior[i]
      const upLeft = i >= channels ? prior[i - channels] : 0
      let v = row[i]
      if (filter === 1) v = (v + left) & 0xff
      else if (filter === 2) v = (v + up) & 0xff
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 0xff
      else if (filter === 4) v = (v + paeth(left, up, upLeft)) & 0xff
      else if (filter !== 0) throw new Error(`Bad PNG filter ${filter}`)
      row[i] = v
    }
    row.copy(prior)
    for (let x = 0; x < width; x++) {
      const o = (yRow * width + x) * 3
      if (colorType === 0) {
        out[o] = out[o + 1] = out[o + 2] = row[x]
      } else if (colorType === 2) {
        out[o] = row[x * 3]
        out[o + 1] = row[x * 3 + 1]
        out[o + 2] = row[x * 3 + 2]
      } else if (colorType === 3) {
        const p = row[x] * 3
        out[o] = palette?.[p] ?? 0
        out[o + 1] = palette?.[p + 1] ?? 0
        out[o + 2] = palette?.[p + 2] ?? 0
      } else {
        out[o] = row[x * 4]
        out[o + 1] = row[x * 4 + 1]
        out[o + 2] = row[x * 4 + 2]
      }
    }
  }
  return { width, height, data: out }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/** Minimal PNG encoder (8-bit RGB, filter 0) — for diff artifacts. */
const encodePngRgb = (img: RgbImage): Buffer => {
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length, 0)
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typed), 0)
    return Buffer.concat([head, typed, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.width, 0)
  ihdr.writeUInt32BE(img.height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  const stride = img.width * 3
  const raw = Buffer.alloc((stride + 1) * img.height)
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    img.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/**
 * Compare two RGB images. Returns the differing-pixel ratio and a
 * diff-marker image: differing pixels magenta on a dimmed actual.
 */
const diffImages = (
  actual: RgbImage,
  expected: RgbImage
): { ratio: number; marker: RgbImage } => {
  const { width, height } = actual
  const marker = Buffer.alloc(width * height * 3)
  let diff = 0
  for (let i = 0; i < width * height; i++) {
    const o = i * 3
    const d = Math.max(
      Math.abs(actual.data[o] - expected.data[o]),
      Math.abs(actual.data[o + 1] - expected.data[o + 1]),
      Math.abs(actual.data[o + 2] - expected.data[o + 2])
    )
    if (d > CHANNEL_TOLERANCE) {
      diff += 1
      marker[o] = 255
      marker[o + 1] = 0
      marker[o + 2] = 255
    } else {
      marker[o] = 128 + (actual.data[o] >> 1)
      marker[o + 1] = 128 + (actual.data[o + 1] >> 1)
      marker[o + 2] = 128 + (actual.data[o + 2] >> 1)
    }
  }
  return {
    ratio: diff / (width * height),
    marker: { width, height, data: marker }
  }
}

/* ------------------------------------------------------------------ */
/* Rasterization + snapshot plumbing                                  */
/* ------------------------------------------------------------------ */

type PageRaster = { pageNo: number; pngPath: string; rgb: RgbImage }

/** Render PDF bytes to per-page PNG + parsed RGB via pdftoppm. */
const rasterize = async (
  pdfBytes: Uint8Array,
  name: string
): Promise<PageRaster[]> => {
  const dir = join(WORK_DIR, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const pdfPath = join(dir, 'doc.pdf')
  writeFileSync(pdfPath, pdfBytes)
  const prefix = join(dir, 'page')
  await execFileAsync('pdftoppm', ['-r', '72', '-png', pdfPath, prefix])
  await execFileAsync('pdftoppm', ['-r', '72', pdfPath, prefix])
  const pages = readdirSync(dir)
    .filter((f) => f.startsWith('page-') && f.endsWith('.ppm'))
    .map((f) => ({
      file: f,
      pageNo: Number(/page-0*(\d+)\.ppm$/.exec(f)?.[1] ?? 0)
    }))
    .sort((a, b) => a.pageNo - b.pageNo)
  return pages.map(({ file, pageNo }, idx) => ({
    pageNo: idx + 1,
    pngPath: join(dir, file.replace(/\.ppm$/, '.png')),
    rgb: parsePpm(readFileSync(join(dir, file)))
  }))
}

const snapshotPath = (name: string, pageNo: number): string =>
  join(SNAPSHOT_DIR, `${name}-${pageNo}.png`)

/**
 * Core assertion: rasterize, verify page count, then compare each page
 * against its committed snapshot (or write the snapshots in update
 * mode). Failure artifacts land in `tmp/pdf-visual/failures/`.
 */
const expectMatchesSnapshots = async (
  name: string,
  pdfBytes: Uint8Array,
  expectedPages: number
): Promise<void> => {
  const loaded = await PDFDocument.load(pdfBytes)
  expect(loaded.getPageCount(), `${name}: unexpected PDF page count`).toBe(
    expectedPages
  )
  const rasters = await rasterize(pdfBytes, name)
  expect(rasters.length, `${name}: pdftoppm page count`).toBe(expectedPages)

  if (UPDATE_MODE) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true })
    for (const page of rasters) {
      copyFileSync(page.pngPath, snapshotPath(name, page.pageNo))
    }
    // Drop stale snapshots from a previous, longer version.
    for (let extra = rasters.length + 1; extra < rasters.length + 20; extra++) {
      const stale = snapshotPath(name, extra)
      if (existsSync(stale)) unlinkSync(stale)
      else break
    }
    return
  }

  for (const page of rasters) {
    const snapFile = snapshotPath(name, page.pageNo)
    if (!existsSync(snapFile)) {
      expect.fail(
        `Missing snapshot ${snapFile} — run PDF_SNAPSHOTS=update pnpm exec vitest run pdf-visual`
      )
    }
    const expected = decodePng(readFileSync(snapFile))
    if (
      expected.width !== page.rgb.width ||
      expected.height !== page.rgb.height
    ) {
      expect.fail(
        `${name} page ${page.pageNo}: size ${page.rgb.width}x${page.rgb.height} != snapshot ${expected.width}x${expected.height}`
      )
    }
    const { ratio, marker } = diffImages(page.rgb, expected)
    if (ratio > MAX_DIFF_RATIO) {
      mkdirSync(FAILURE_DIR, { recursive: true })
      const base = join(FAILURE_DIR, `${name}-${page.pageNo}`)
      copyFileSync(page.pngPath, `${base}-actual.png`)
      copyFileSync(snapFile, `${base}-expected.png`)
      writeFileSync(`${base}-diff.png`, encodePngRgb(marker))
      expect.fail(
        `${name} page ${page.pageNo}: ${(ratio * 100).toFixed(2)}% pixels differ ` +
          `(> ${(MAX_DIFF_RATIO * 100).toFixed(1)}%) — see ${base}-{actual,expected,diff}.png`
      )
    }
  }
  // A shrunk document must not silently leave old pages green.
  expect(
    existsSync(snapshotPath(name, rasters.length + 1)),
    `${name}: stale snapshot page ${rasters.length + 1} exists — page count changed?`
  ).toBe(false)
}

/* ------------------------------------------------------------------ */
/* Fixtures — all dates fixed for deterministic output                */
/* ------------------------------------------------------------------ */

const FIXED_TS = new Date('2026-05-01T08:00:00Z')

const baseSettings: CompanySettings = {
  id: 'co-1',
  setupCompleted: true,
  companyName: 'Twin Cars GmbH',
  owner: 'Kai Beispiel',
  street: 'Musterstraße 12',
  zip: '10115',
  city: 'Berlin',
  state: 'Berlin',
  phone: '030 1234567',
  mobile: null,
  fax: null,
  email: 'info@twincars.example',
  website: 'https://twincars.example',
  vatId: 'DE812345678',
  taxNumber: '30/123/45678',
  bankName: 'Musterbank Berlin',
  iban: 'DE02 1203 0000 0000 2020 51',
  bic: 'BYLADEM1001',
  defaultPaymentTermDays: 14,
  defaultCurrency: 'EUR',
  defaultVatRate: '19.00',
  salutationStyle: 'Sie',
  logoMime: null,
  logoData: null,
  pdfFooter: '',
  smallBusinessExempt: false,
  reminderAutoEnabled: true,
  reminderDays1: 3,
  reminderRecurEveryDays: 14,
  geoLat: null,
  geoLon: null,
  laborItemId: null,
  createdAt: FIXED_TS,
  updatedAt: FIXED_TS
} as unknown as CompanySettings

const baseCustomer: Customer = {
  id: 'c-1',
  customerNumber: 'KU-00042',
  legacyCustomerNumber: null,
  company: null,
  salutation: 'Herr',
  firstName: 'Max',
  lastName: 'Mustermann',
  street: 'Hauptstraße 5',
  zip: '10115',
  city: 'Berlin',
  country: 'Deutschland',
  phone: null,
  mobile: null,
  fax: null,
  email: null,
  website: null,
  notes: null,
  paymentTermDays: null,
  vatId: null,
  bankIban: null,
  bankBic: null,
  bankName: null,
  archived: false,
  createdAt: FIXED_TS,
  updatedAt: FIXED_TS
} as unknown as Customer

const baseVehicle: Vehicle & { licensePlate: string | null } = {
  id: 'v-1',
  customerId: 'c-1',
  legacyVehicleId: null,
  make: 'Volkswagen',
  model: 'Golf VII 1.4 TSI',
  vin: 'WVWZZZ1KZAW123456',
  firstRegistration: '2018-04-01',
  mileageKm: 84500,
  nextHu: '2027-06-01',
  nextAu: '2027-06-01',
  hsn: '0603',
  tsn: 'BJF',
  displacementCcm: 1395,
  powerKw: 92,
  colorCode: 'Reflex Silver',
  engineNumber: null,
  fuelType: 'Benzin',
  gearbox: '6-Gang manuell',
  bodyType: 'Limousine',
  notes: null,
  archived: false,
  createdAt: FIXED_TS,
  updatedAt: FIXED_TS,
  licensePlate: 'B-TC 1234'
} as unknown as Vehicle & { licensePlate: string | null }

type ItemSpec = {
  kind?: string
  articleNumber?: string | null
  description: string
  quantity?: number
  unit?: string
  unitPriceNet?: number
  discountPercent?: number
  taxRate?: number
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100

/** Build consistent document items + totals (mirrors document-service). */
const buildItems = (
  specs: ItemSpec[]
): {
  items: DocumentItem[]
  totals: {
    net: number
    tax: number
    gross: number
    discount: number
    taxRate: number
  }
} => {
  let net = 0
  let tax = 0
  let gross = 0
  let discount = 0
  const items = specs.map((spec, idx) => {
    const qty = spec.quantity ?? 1
    const unitPrice = spec.unitPriceNet ?? 100
    const disc = spec.discountPercent ?? 0
    const rate = spec.taxRate ?? 19
    const lineNetBefore = round2(qty * unitPrice)
    const lineDiscount = round2((lineNetBefore * disc) / 100)
    const lineNet = round2(lineNetBefore - lineDiscount)
    const lineTax = round2((lineNet * rate) / 100)
    const lineGross = round2(lineNet + lineTax)
    net = round2(net + lineNet)
    tax = round2(tax + lineTax)
    gross = round2(gross + lineGross)
    discount = round2(discount + lineDiscount)
    return {
      id: `i-${idx + 1}`,
      documentId: 'd-1',
      positionNumber: idx + 1,
      kind: spec.kind ?? 'service',
      itemId: null,
      tireId: null,
      articleNumber: spec.articleNumber ?? null,
      description: spec.description,
      quantity: String(qty),
      unit: spec.unit ?? 'Stk',
      unitPriceNet: unitPrice.toFixed(2),
      discountPercent: disc.toFixed(2),
      taxRate: rate.toFixed(2),
      lineTotalNet: lineNet.toFixed(2),
      lineTotalGross: lineGross.toFixed(2)
    } as unknown as DocumentItem
  })
  return {
    items,
    totals: { net, tax, gross, discount, taxRate: specs[0]?.taxRate ?? 19 }
  }
}

const buildInput = (opts: {
  specs: ItemSpec[]
  doc?: Partial<Document>
  customer?: Customer | null
  vehicle?: (Vehicle & { licensePlate: string | null }) | null
  settings?: Partial<CompanySettings>
}): DocumentRenderInput => {
  const { items, totals } = buildItems(opts.specs)
  const doc: Document = {
    id: 'd-1',
    documentNumber: 'RE-2026-0102',
    legacyDocumentNumber: null,
    type: 'invoice',
    status: 'created',
    customerId: opts.customer === null ? null : 'c-1',
    vehicleId: opts.vehicle ? 'v-1' : null,
    issueDate: '2026-05-01',
    serviceDate: '2026-04-28',
    dueDate: '2026-05-15',
    paymentMethod: 'Überweisung',
    taxRate: totals.taxRate.toFixed(2),
    netTotal: totals.net.toFixed(2),
    taxTotal: totals.tax.toFixed(2),
    grossTotal: totals.gross.toFixed(2),
    discountTotal: totals.discount.toFixed(2),
    header: null,
    footer: null,
    notes: null,
    convertedToInvoiceId: null,
    reminderLevel: 0,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByDocumentId: null,
    cancelsDocumentId: null,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...opts.doc
  } as unknown as Document
  return {
    doc,
    items,
    customer: opts.customer === undefined ? { ...baseCustomer } : opts.customer,
    vehicle: opts.vehicle ?? null,
    settings: { ...baseSettings, ...opts.settings } as CompanySettings
  }
}

/* — Individual fixture builders — */

const fixtureMinimalInvoice = () =>
  renderDocumentPdf(
    buildInput({
      specs: [{ description: 'Ölwechsel inkl. Filter', unitPriceNet: 89.9 }]
    })
  )

const fixtureMaxHeader = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description: 'Inspektion nach Herstellervorgabe',
          unitPriceNet: 249.0
        },
        {
          kind: 'material',
          articleNumber: 'LL-5W30-5L',
          description: 'Longlife Motoröl 5W-30',
          quantity: 5,
          unit: 'Ltr',
          unitPriceNet: 18.5
        }
      ],
      doc: { paymentMethod: 'Zahlung per Überweisung innerhalb von 14 Tagen' },
      customer: {
        ...baseCustomer,
        company:
          'Erste Allgemeine Gebäudereinigungs- und Fuhrparkverwaltungsgesellschaft Berlin-Brandenburg mbH & Co. KG',
        salutation: null,
        street:
          'Gewerbegebiet Nord, Halle 7, Aufgang B, Verwaltungstrakt Zimmer 12',
        city: 'Frankfurt an der Oder / Ortsteil Kliestow-Süd'
      } as unknown as Customer,
      vehicle: { ...baseVehicle },
      settings: {
        companyName:
          'Twin Cars Autohandels- und Werkstattbetriebs GmbH & Co. KG',
        owner: 'Dipl.-Ing. Karl-Heinz von und zu Beispielhausen',
        street: 'Industriestraße 144-146, Gebäude C, Eingang II',
        mobile: '0171 5556677',
        fax: '030 1234568',
        bankName: 'Sparkasse Berlin-Mitte, Filiale Chausseestraße'
      }
    })
  )

const LONG_DESC =
  'Fehlerspeicher ausgelesen, Diagnose Steuergerät Motorelektronik, ' +
  'Sichtprüfung sämtlicher Zündspulen und Einspritzventile, ' +
  'Kompressionsdruckprüfung aller vier Zylinder durchgeführt, ' +
  'anschließend Probefahrt über 25 km inklusive Autobahnanteil zur ' +
  'Verifikation der Reparatur unter Volllast und Schubabschaltung'

const fixtureLongDescriptions = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        { description: LONG_DESC, unitPriceNet: 320 },
        {
          kind: 'material',
          articleNumber: '06H-905-115-B',
          description:
            'Zündspule mit Leistungsendstufe Originalteil ' +
            'Teilenummer-Referenz OEM-Vergleichsnummer ' +
            'ZS06H905115B-ERSATZTEILNUMMER-0123456789-XXL-SONDERBESTELLUNG',
          quantity: 4,
          unitPriceNet: 42.35
        },
        {
          description:
            'Kleinteile & Verbrauchsmaterial:\nBremsenreiniger\nKabelbinder-Sortiment\nSchutzhandschuhe',
          unitPriceNet: 12
        }
      ]
    })
  )

const fixture45Positions = () =>
  renderDocumentPdf(
    buildInput({
      specs: Array.from({ length: 45 }, (_, i) => ({
        kind: ['service', 'material', 'article'][i % 3],
        articleNumber: i % 3 === 1 ? `ART-${1000 + i}` : null,
        description:
          i % 7 === 3
            ? `Position ${i + 1}: Achsvermessung inkl. Einstellung Vorder- und Hinterachse nach Herstellervorgabe`
            : `Position ${i + 1}: Arbeitsschritt laut Auftragsbeschreibung`,
        quantity: (i % 4) + 1,
        unitPriceNet: 15 + (i % 9) * 7.5
      })),
      vehicle: { ...baseVehicle }
    })
  )

const fixtureLargeAmounts = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description: 'Komplettrestaurierung Oldtimer-Sammlung',
          quantity: 1,
          unitPriceNet: 84033613.44
        },
        {
          kind: 'material',
          description: 'Ersatzteilpaket Vollausstattung',
          quantity: 1234.5,
          unit: 'Stk',
          unitPriceNet: 999.99
        }
      ]
    })
  )

const fixtureDiscountMixedTax = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description: 'Hauptuntersuchung Durchführung (Partnerpreis)',
          unitPriceNet: 120,
          discountPercent: 10,
          taxRate: 19
        },
        {
          kind: 'material',
          articleNumber: 'B-KLOTZ-VA',
          description: 'Bremsklötze Vorderachse Satz',
          quantity: 1,
          unitPriceNet: 89.5,
          discountPercent: 5,
          taxRate: 19
        },
        {
          kind: 'article',
          description: 'Fachbuch "Oldtimer-Wartung" (ermäßigter Steuersatz)',
          unitPriceNet: 29.9,
          taxRate: 7
        },
        {
          kind: 'pass_through',
          description: 'TÜV-Gebühr (durchlaufender Posten)',
          unitPriceNet: 56.6,
          taxRate: 0
        }
      ]
    })
  )

const fixtureEmptyOptionals = () =>
  renderDocumentPdf(
    buildInput({
      specs: [{ description: 'Pauschale', unitPriceNet: 50 }],
      doc: {
        serviceDate: null,
        dueDate: null,
        paymentMethod: null,
        header: null,
        footer: null
      },
      customer: null,
      vehicle: null,
      settings: {
        owner: null,
        phone: '',
        mobile: null,
        fax: null,
        email: '',
        website: null,
        vatId: null,
        taxNumber: null,
        bankName: null,
        iban: null,
        bic: null,
        pdfFooter: ''
      }
    })
  )

const fixtureSpecialChars = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description:
            'Umlaute & Sonderzeichen: ÄÖÜ äöü ß € § ° µ „deutsche Anführung" – Gedankenstrich … Ellipse',
          unitPriceNet: 99
        },
        {
          description:
            'Nicht-WinAnsi-Zeichen (ersetzt): Šžłđ Ω→? 你好 crème brûlée',
          unitPriceNet: 1
        }
      ],
      customer: {
        ...baseCustomer,
        firstName: 'Łukasz',
        lastName: 'Šimčić-Đorđević',
        street: 'Åkerbergstraße 3½'
      } as unknown as Customer,
      doc: { footer: 'Vielen Dank für Ihren Besuch — à bientôt & 谢谢!' }
    })
  )

const fixtureStorno = () => {
  const input = buildInput({
    specs: [{ description: 'Ölwechsel inkl. Filter', unitPriceNet: 89.9 }],
    vehicle: { ...baseVehicle }
  })
  input.doc = {
    ...input.doc,
    documentNumber: 'RE-2026-0103',
    status: 'storno',
    notes: 'Stornorechnung zu RE-2026-0102. Grund: Falscher Kunde',
    netTotal: `-${input.doc.netTotal}`,
    taxTotal: `-${input.doc.taxTotal}`,
    grossTotal: `-${input.doc.grossTotal}`
  } as Document
  input.items = input.items.map((it) => ({
    ...it,
    lineTotalNet: `-${it.lineTotalNet}`,
    lineTotalGross: `-${it.lineTotalGross}`
  }))
  return renderDocumentPdf(input)
}

const fixtureOffer = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description: 'Klimaanlagen-Service inkl. Kältemittel',
          unitPriceNet: 149
        },
        {
          kind: 'material',
          description: 'Innenraumfilter Aktivkohle',
          unitPriceNet: 24.9
        }
      ],
      doc: {
        type: 'offer',
        documentNumber: 'AN-2026-0031',
        dueDate: null,
        header:
          'Wie am 28.04. telefonisch besprochen bieten wir Ihnen den Klimaservice für Ihren Golf an. Das Angebot ist 30 Tage gültig.'
      },
      vehicle: { ...baseVehicle }
    })
  )

const fixtureOrderConfirmation = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          description: 'Zahnriemenwechsel inkl. Wasserpumpe',
          unitPriceNet: 590
        }
      ],
      doc: {
        type: 'order_confirmation',
        documentNumber: 'AB-2026-0007',
        dueDate: null
      },
      vehicle: { ...baseVehicle }
    })
  )

const fixtureInvoiceFromOrder = () =>
  renderDocumentPdf(
    buildInput({
      specs: [
        {
          kind: 'service',
          description:
            'Arbeitszeit: Bremsanlage instand gesetzt (Monteur: Max Mustermann)',
          quantity: 2.5,
          unit: 'Std',
          unitPriceNet: 89
        },
        {
          kind: 'service',
          description:
            'Arbeitszeit: Probefahrt und Endkontrolle (Monteur: Erika Beispiel)',
          quantity: 0.5,
          unit: 'Std',
          unitPriceNet: 89
        },
        {
          kind: 'material',
          articleNumber: 'BS-VA-GOLF7',
          description: 'Bremsscheiben Vorderachse (Satz)',
          quantity: 1,
          unitPriceNet: 148.9
        }
      ],
      vehicle: { ...baseVehicle }
    })
  )

const fixtureReminder = () => {
  const invoiceInput = buildInput({
    specs: [{ description: 'Ölwechsel inkl. Filter', unitPriceNet: 89.9 }]
  })
  const reminder: Reminder = {
    id: 'r-1',
    invoiceId: 'd-1',
    documentNumber: 'ZE-2026-0005',
    level: 1,
    issueDate: '2026-05-20',
    dueDate: '2026-06-03',
    status: 'created',
    notes: null,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS
  } as unknown as Reminder
  const input: ReminderRenderInput = {
    reminder,
    invoice: invoiceInput.doc,
    customer: invoiceInput.customer,
    vehicle: { ...baseVehicle },
    settings: invoiceInput.settings
  }
  return renderReminderPdf(input)
}

const fixtureSaleSign = () =>
  renderVehicleSaleSignPdf({
    vehicle: baseVehicle as unknown as Vehicle,
    coverPhoto: null,
    salesPriceGross: 14990,
    differentialTax: false,
    salesNotes:
      'Scheckheftgepflegt\nNichtraucherfahrzeug\n2. Hand\nNeue Allwetterreifen',
    qrPayload: 'https://twincars.example/inventory/v-1',
    settings: {
      companyName: 'Twin Cars GmbH',
      phone: '030 1234567',
      zip: '10115',
      city: 'Berlin'
    }
  })

const fixtureTireLabel = () =>
  renderTireStorageLabelPdf(
    {
      id: 'ts-1',
      storageNumber: 'L-2026-0042',
      customerId: 'c-1',
      vehicleId: null,
      brand: 'Continental',
      model: 'WinterContact TS 870',
      size: '205/55 R16 91H',
      profileMm: '7.5',
      dotYear: 2024,
      season: 'winter',
      quantity: 4,
      photos: [],
      notes: null,
      storedAt: '2026-04-12',
      retrievedAt: null,
      createdAt: FIXED_TS,
      updatedAt: FIXED_TS,
      customerName: 'Max Mustermann'
    } as unknown as TireStorage & { customerName: string },
    'https://twincars.example/tire-storage/scan/L-2026-0042'
  )

/* ------------------------------------------------------------------ */
/* Visual snapshot matrix                                             */
/* ------------------------------------------------------------------ */

const visualFixtures: Array<{
  name: string
  pages: number
  render: () => Promise<Uint8Array>
}> = [
  { name: 'invoice-minimal', pages: 1, render: fixtureMinimalInvoice },
  { name: 'invoice-max-header', pages: 1, render: fixtureMaxHeader },
  { name: 'invoice-long-desc', pages: 1, render: fixtureLongDescriptions },
  { name: 'invoice-45-positions', pages: 3, render: fixture45Positions },
  { name: 'invoice-large-amounts', pages: 1, render: fixtureLargeAmounts },
  {
    name: 'invoice-discount-mixed-tax',
    pages: 1,
    render: fixtureDiscountMixedTax
  },
  { name: 'invoice-empty-optionals', pages: 1, render: fixtureEmptyOptionals },
  { name: 'invoice-special-chars', pages: 1, render: fixtureSpecialChars },
  { name: 'invoice-storno', pages: 1, render: fixtureStorno },
  { name: 'offer-with-header', pages: 1, render: fixtureOffer },
  { name: 'order-confirmation', pages: 1, render: fixtureOrderConfirmation },
  { name: 'invoice-from-order', pages: 1, render: fixtureInvoiceFromOrder },
  { name: 'reminder', pages: 1, render: fixtureReminder },
  {
    name: 'sale-sign',
    pages: 1,
    render: async () => new Uint8Array(await fixtureSaleSign())
  },
  {
    name: 'tire-label',
    pages: 1,
    render: async () => new Uint8Array(await fixtureTireLabel())
  }
]

describe.skipIf(!HAS_PDFTOPPM)('PDF visual regression', () => {
  for (const fixture of visualFixtures) {
    it(
      `${fixture.name} matches its committed snapshots`,
      { timeout: 30000 },
      async () => {
        const bytes = await fixture.render()
        await expectMatchesSnapshots(fixture.name, bytes, fixture.pages)
      }
    )
  }
})

/* ------------------------------------------------------------------ */
/* Structural pagination behavior (no pdftoppm required)              */
/* ------------------------------------------------------------------ */

describe('renderDocumentPdf — pagination structure', () => {
  it('keeps a short invoice on a single page', async () => {
    const bytes = await fixtureMinimalInvoice()
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('paginates 45 positions onto three pages', async () => {
    const bytes = await fixture45Positions()
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(3)
  })

  it('pushes the totals block to a fresh page when it no longer fits', async () => {
    // 40 single-line positions leave the first page too full for the
    // totals block — the block must move in one piece, never split.
    const bytes = await renderDocumentPdf(
      buildInput({
        specs: Array.from({ length: 40 }, (_, i) => ({
          description: `Position ${i + 1}`,
          unitPriceNet: 10
        }))
      })
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })

  it('splits a single row taller than a page body without looping', async () => {
    const monster = Array.from(
      { length: 400 },
      (_, i) => `Detailschritt${i + 1}`
    ).join(' ')
    const bytes = await renderDocumentPdf(
      buildInput({ specs: [{ description: monster, unitPriceNet: 500 }] })
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(doc.getPageCount()).toBeLessThanOrEqual(4)
  })

  it('renders a document without any items', async () => {
    const bytes = await renderDocumentPdf(buildInput({ specs: [] }))
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('survives a header/footer/description stress mix without throwing', async () => {
    const bytes = await renderDocumentPdf(
      buildInput({
        specs: [
          { description: LONG_DESC, unitPriceNet: 1 },
          { description: 'X'.repeat(600), unitPriceNet: 2 }
        ],
        doc: {
          header: 'Kopftext '.repeat(40),
          footer: 'Fußzeilentext mit sehr vielen Wiederholungen. '.repeat(20)
        }
      })
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})

/* ------------------------------------------------------------------ */
/* Determinism — double-render hash equality                          */
/* ------------------------------------------------------------------ */

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

describe('deterministic rendering', () => {
  it('document PDF: two renders of the same input are byte-identical', async () => {
    const a = await fixtureDiscountMixedTax()
    const b = await fixtureDiscountMixedTax()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('reminder PDF is byte-deterministic', async () => {
    const a = await fixtureReminder()
    const b = await fixtureReminder()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('sale sign PDF is byte-deterministic', async () => {
    const a = await fixtureSaleSign()
    const b = await fixtureSaleSign()
    expect(sha256(new Uint8Array(a))).toBe(sha256(new Uint8Array(b)))
  })

  it('tire label PDF is byte-deterministic', async () => {
    const a = await fixtureTireLabel()
    const b = await fixtureTireLabel()
    expect(sha256(new Uint8Array(a))).toBe(sha256(new Uint8Array(b)))
  })
})
