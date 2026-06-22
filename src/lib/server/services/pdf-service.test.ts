// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  computeDocumentInputHash,
  renderArticleLabelPdf,
  renderDocumentPdf,
  renderTireStorageLabelPdf,
  renderVehicleSaleSignPdf,
  type DocumentRenderInput
} from './pdf-service'
import type {
  CompanySettings,
  Customer,
  Document,
  DocumentItem,
  TireStorage,
  Vehicle
} from '$lib/server/db/schema'

const baseSettings: CompanySettings = {
  id: 'co-1',
  setupCompleted: true,
  companyName: 'Demo GmbH',
  owner: null,
  street: 'Musterstr. 1',
  zip: '10115',
  city: 'Berlin',
  state: 'Berlin',
  phone: '030/123',
  mobile: null,
  fax: null,
  email: 'demo@example.com',
  website: null,
  vatId: 'DE123',
  taxNumber: '99/123/45678',
  bankName: 'Bank',
  iban: 'DE00 0000 0000',
  bic: 'BANKDEFF',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
}

const baseDoc: Document = {
  id: 'd-1',
  documentNumber: 'RE-2026-0001',
  legacyDocumentNumber: null,
  type: 'invoice',
  status: 'draft',
  customerId: 'c-1',
  vehicleId: null,
  issueDate: '2026-05-01',
  serviceDate: '2026-05-01',
  dueDate: '2026-05-15',
  paymentMethod: 'Überweisung',
  taxRate: '19.00',
  netTotal: '100.00',
  taxTotal: '19.00',
  grossTotal: '119.00',
  discountTotal: '0.00',
  header: null,
  footer: null,
  notes: null,
  convertedToInvoiceId: null,
  reminderLevel: 0,
  cancelledAt: null,
  cancellationReason: null,
  cancelledByDocumentId: null,
  cancelsDocumentId: null,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z')
}

const baseItem: DocumentItem = {
  id: 'i-1',
  documentId: 'd-1',
  positionNumber: 1,
  kind: 'service',
  itemId: null,
  tireId: null,
  articleNumber: null,
  description: 'Ölwechsel',
  quantity: '1',
  unit: 'Stk',
  unitPriceNet: '100.00',
  discountPercent: '0.00',
  taxRate: '19.00',
  lineTotalNet: '100.00',
  lineTotalGross: '119.00'
}

const baseCustomer: Customer = {
  id: 'c-1',
  customerNumber: 'KU-00001',
  legacyCustomerNumber: null,
  company: 'Mustermann GmbH',
  salutation: null,
  firstName: 'Max',
  lastName: 'Mustermann',
  street: 'Hauptstr. 5',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
} as unknown as Customer

const baseInput = (): DocumentRenderInput => ({
  doc: { ...baseDoc },
  items: [{ ...baseItem }],
  customer: { ...baseCustomer },
  vehicle: null,
  settings: { ...baseSettings }
})

describe('computeDocumentInputHash', () => {
  it('returns a stable 64-character SHA-256 hex digest', () => {
    const hash = computeDocumentInputHash(baseInput())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for identical input', () => {
    const a = computeDocumentInputHash(baseInput())
    const b = computeDocumentInputHash(baseInput())
    expect(a).toBe(b)
  })

  it('changes when a line item changes', () => {
    const a = computeDocumentInputHash(baseInput())
    const modified = baseInput()
    modified.items[0].quantity = '2'
    const b = computeDocumentInputHash(modified)
    expect(a).not.toBe(b)
  })

  it('changes when the document totals change', () => {
    const a = computeDocumentInputHash(baseInput())
    const modified = baseInput()
    modified.doc.grossTotal = '238.00'
    const b = computeDocumentInputHash(modified)
    expect(a).not.toBe(b)
  })

  it('changes when company settings change', () => {
    const a = computeDocumentInputHash(baseInput())
    const modified = baseInput()
    modified.settings.iban = 'DE99 9999 9999'
    const b = computeDocumentInputHash(modified)
    expect(a).not.toBe(b)
  })

  it('changes when the customer changes', () => {
    const a = computeDocumentInputHash(baseInput())
    const modified = baseInput()
    if (modified.customer) modified.customer.company = 'Neue GmbH'
    const b = computeDocumentInputHash(modified)
    expect(a).not.toBe(b)
  })

  it('is independent of irrelevant key ordering', () => {
    const a = computeDocumentInputHash(baseInput())
    const reordered = baseInput()
    // Build a swapped-key copy of doc — same content, different insertion
    // order. The canonical sort inside the helper has to neutralize this.
    // Object.assign on a fresh object preserves the *new* insertion order.
    reordered.doc = Object.assign(
      {
        updatedAt: baseDoc.updatedAt,
        createdAt: baseDoc.createdAt,
        grossTotal: baseDoc.grossTotal,
        taxTotal: baseDoc.taxTotal,
        netTotal: baseDoc.netTotal,
        discountTotal: baseDoc.discountTotal
      },
      baseDoc
    )
    const b = computeDocumentInputHash(reordered)
    expect(a).toBe(b)
  })
})

/* ──────────────────────────────────────────────────────────────────── */
/* QR label + sale sign renderers                                       */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Helper: returns true if the PDF bytes start with the `%PDF-` magic
 * marker and decode cleanly via pdf-lib. We deliberately don't probe
 * the visible text content — pdf-lib stores glyphs as content-stream
 * commands, not as searchable Unicode — so we assert on metadata
 * (title) and page geometry instead.
 */
const isValidPdf = (bytes: Uint8Array): boolean =>
  bytes.length > 4 && Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-'

describe('renderArticleLabelPdf', () => {
  it('returns valid PDF bytes (A6 landscape, single page) for an article', async () => {
    const bytes = await renderArticleLabelPdf(
      {
        articleNumber: 'ART-00001',
        description: 'Ölwechsel mit Filter — 5W30',
        unitPriceNet: '79.90',
        kind: 'service'
      },
      'https://twincars.local/items/ART-00001'
    )
    expect(isValidPdf(bytes)).toBe(true)

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    // A6 landscape: 419.5 × 297.6 pt (allow ±1 pt rounding tolerance).
    expect(width).toBeGreaterThan(height)
    expect(Math.round(width)).toBeGreaterThanOrEqual(419)
    expect(Math.round(width)).toBeLessThanOrEqual(420)
    expect(Math.round(height)).toBeGreaterThanOrEqual(297)
    expect(Math.round(height)).toBeLessThanOrEqual(298)
  })

  it('still renders when no price is set on the article', async () => {
    const bytes = await renderArticleLabelPdf(
      {
        articleNumber: 'ART-00002',
        description: 'Lichttest',
        unitPriceNet: null,
        kind: 'service'
      },
      'https://twincars.local/items/ART-00002'
    )
    expect(isValidPdf(bytes)).toBe(true)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('rejects an empty QR payload (delegated to qr-service)', async () => {
    await expect(
      renderArticleLabelPdf({ articleNumber: 'X', description: 'x' }, '')
    ).rejects.toThrow(/QR-Inhalt/i)
  })
})

describe('renderTireStorageLabelPdf', () => {
  const baseEntry: TireStorage & { customerLabel: string } = {
    id: 'ts-1',
    storageNumber: 'L-2026-0042',
    customerId: 'c-1',
    vehicleId: null,
    brand: 'Continental',
    model: 'WinterContact TS 870',
    size: '205/55 R16',
    profileMm: '7.5',
    dotYear: 2024,
    season: 'winter',
    quantity: 4,
    photos: [],
    notes: null,
    storedAt: '2026-04-12',
    retrievedAt: null,
    createdAt: new Date('2026-04-12T08:00:00Z'),
    updatedAt: new Date('2026-04-12T08:00:00Z'),
    customerLabel: 'Max Mustermann'
  } as unknown as TireStorage & { customerLabel: string }

  it('returns valid PDF bytes (A6 landscape, single page) for a stored set', async () => {
    const bytes = await renderTireStorageLabelPdf(baseEntry)
    expect(isValidPdf(bytes)).toBe(true)

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeGreaterThan(height) // landscape
    expect(Math.round(width)).toBeGreaterThanOrEqual(419)
    expect(Math.round(height)).toBeLessThanOrEqual(298)
  })

  it('handles entries without optional brand/model/size', async () => {
    const sparse = {
      ...baseEntry,
      brand: null,
      model: null,
      size: null,
      season: null
    } as TireStorage & { customerLabel: string }
    const bytes = await renderTireStorageLabelPdf(sparse)
    expect(isValidPdf(bytes)).toBe(true)
  })
})

describe('renderVehicleSaleSignPdf', () => {
  const baseVehicle: Vehicle & { licensePlate: string | null } = {
    id: 'v-1',
    customerId: null,
    legacyVehicleId: null,
    make: 'Volkswagen',
    model: 'Golf VII',
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    licensePlate: 'B-AB 1234'
  } as unknown as Vehicle & { licensePlate: string | null }

  it('produces a valid A4-landscape single-page PDF', async () => {
    const bytes = await renderVehicleSaleSignPdf({
      vehicle: baseVehicle,
      coverPhoto: null,
      salesPriceGross: 14990,
      differentialTax: false,
      salesNotes:
        'Sehr gepflegt\nScheckheftgepflegt\nNichtraucherfahrzeug\nAllwetterreifen',
      qrPayload: 'https://twincars.local/inventory/v-1',
      settings: {
        companyName: 'Demo GmbH',
        phone: '030/123456'
      } as unknown as CompanySettings
    })
    expect(isValidPdf(bytes)).toBe(true)

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    // A4 landscape: 841.89 × 595.28 pt.
    expect(width).toBeGreaterThan(height)
    expect(Math.round(width)).toBeGreaterThanOrEqual(841)
    expect(Math.round(width)).toBeLessThanOrEqual(843)
    expect(Math.round(height)).toBeGreaterThanOrEqual(595)
    expect(Math.round(height)).toBeLessThanOrEqual(596)
  })

  it('renders without a photo (placeholder fallback)', async () => {
    const bytes = await renderVehicleSaleSignPdf({
      vehicle: baseVehicle,
      coverPhoto: null,
      salesPriceGross: null,
      qrPayload: 'https://twincars.local/inventory/v-1',
      settings: { companyName: 'Demo GmbH' } as unknown as CompanySettings
    })
    expect(isValidPdf(bytes)).toBe(true)
  })
})

/* ──────────────────────────────────────────────────────────────────── */
/* renderDocumentPdf — GoBD-Storno-Pfad                                */
/* ──────────────────────────────────────────────────────────────────── */

describe('renderDocumentPdf — storno', () => {
  it('renders a storno invoice with the STORNORECHNUNG title in metadata', async () => {
    const input = baseInput()
    input.doc.status = 'storno'
    input.doc.documentNumber = 'S-1'
    input.doc.notes = 'Stornorechnung zu RE-2026-0001. Grund: Test'
    input.doc.netTotal = '-100.00'
    input.doc.taxTotal = '-19.00'
    input.doc.grossTotal = '-119.00'

    const bytes = await renderDocumentPdf(input)
    expect(isValidPdf(bytes)).toBe(true)

    const doc = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toContain('STORNORECHNUNG')
    expect(doc.getTitle()).toContain('S-1')
    // Page count is at least 1, structure decoded cleanly.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('renders a regular invoice with the Rechnung title (control case)', async () => {
    const input = baseInput()
    const bytes = await renderDocumentPdf(input)
    expect(isValidPdf(bytes)).toBe(true)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toContain('Rechnung')
    expect(doc.getTitle()).not.toContain('STORNORECHNUNG')
  })
})
