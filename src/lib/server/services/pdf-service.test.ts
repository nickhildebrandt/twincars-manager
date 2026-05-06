import { describe, expect, it } from 'vitest'
import {
  computeDocumentInputHash,
  type DocumentRenderInput
} from './pdf-service'
import type {
  CompanySettings,
  Customer,
  Document,
  DocumentItem
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
  reminderDays2: 10,
  reminderDays3: 20,
  reminderDays4: 30,
  reminderFee1: '0',
  reminderFee2: '5.00',
  reminderFee3: '10.00',
  reminderFee4: '15.00',
  reminderInterestRate: '9.62',
  payrollGenerationDay: 25,
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
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z')
}

const baseItem: DocumentItem = {
  id: 'i-1',
  documentId: 'd-1',
  positionNumber: 1,
  kind: 'service',
  itemId: null,
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
