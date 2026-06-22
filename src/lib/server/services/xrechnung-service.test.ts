// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  escapeXml,
  renderXRechnungXml,
  type XRechnungInput
} from './xrechnung-service'
import type {
  CompanySettings,
  Customer,
  Document,
  DocumentItem
} from '$lib/server/db/schema'

const baseSettings: CompanySettings = {
  id: 'co-1',
  setupCompleted: true,
  companyName: 'Werkstatt Müller GmbH',
  owner: null,
  street: 'Musterstr. 1',
  zip: '10115',
  city: 'Berlin',
  state: 'Berlin',
  phone: '030/123',
  mobile: null,
  fax: null,
  email: 'info@mueller.example',
  website: null,
  vatId: 'DE123456789',
  taxNumber: '99/123/45678',
  bankName: 'Sparkasse',
  iban: 'DE12 5001 0517 0648 4898 90',
  bic: 'INGDDEFFXXX',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
} as unknown as CompanySettings

const baseDoc: Document = {
  id: 'd-1',
  documentNumber: 'RE-2026-0042',
  legacyDocumentNumber: null,
  type: 'invoice',
  status: 'sent',
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
} as unknown as Document

const baseItem: DocumentItem = {
  id: 'i-1',
  documentId: 'd-1',
  positionNumber: 1,
  kind: 'service',
  itemId: null,
  tireId: null,
  articleNumber: 'A-100',
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
  zip: '20095',
  city: 'Hamburg',
  country: 'Deutschland',
  phone: null,
  mobile: null,
  fax: null,
  email: 'max@mustermann.example',
  website: null,
  notes: null,
  paymentTermDays: null,
  vatId: 'DE987654321',
  bankIban: null,
  bankBic: null,
  bankName: null,
  archived: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
} as unknown as Customer

const baseInput = (): XRechnungInput => ({
  doc: { ...baseDoc },
  items: [{ ...baseItem }],
  customer: { ...baseCustomer },
  vehicle: null,
  settings: { ...baseSettings }
})

describe('escapeXml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeXml('a & b < c > d " e \' f')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f'
    )
  })
})

describe('renderXRechnungXml', () => {
  it('starts with the UTF-8 XML declaration', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true)
  })

  it('emits exactly one Invoice ID matching the document number', () => {
    const xml = renderXRechnungXml(baseInput())
    const matches = xml.match(/<cbc:ID>RE-2026-0042<\/cbc:ID>/g) ?? []
    expect(matches.length).toBe(1)
  })

  it("renders the customer's street, zip and city exactly once", () => {
    const xml = renderXRechnungXml(baseInput())
    expect(
      (xml.match(/<cbc:StreetName>Hauptstr\. 5<\/cbc:StreetName>/g) ?? [])
        .length
    ).toBe(1)
    expect(
      (xml.match(/<cbc:PostalZone>20095<\/cbc:PostalZone>/g) ?? []).length
    ).toBe(1)
    expect(
      (xml.match(/<cbc:CityName>Hamburg<\/cbc:CityName>/g) ?? []).length
    ).toBe(1)
  })

  it("renders the supplier's VAT id exactly once", () => {
    const xml = renderXRechnungXml(baseInput())
    const occurrences = xml.match(/DE123456789/g) ?? []
    expect(occurrences.length).toBe(1)
  })

  it('TaxTotal sums match line-tax aggregate rounded to 2 decimals', () => {
    const input = baseInput()
    input.items = [
      { ...baseItem, id: 'i-1', positionNumber: 1, lineTotalNet: '100.33' },
      {
        ...baseItem,
        id: 'i-2',
        positionNumber: 2,
        description: 'Bremsen',
        lineTotalNet: '50.17'
      }
    ]
    const xml = renderXRechnungXml(input)
    // 19 % on 100.33 = 19.06, on 50.17 = 9.53 → total tax 28.59 (rounded
    // per line, then summed — matches the German VAT-by-line rule).
    expect(xml).toContain(
      '<cbc:TaxAmount currencyID="EUR">28.59</cbc:TaxAmount>'
    )
    // Taxable amount (line-extension) total: 150.50
    expect(xml).toContain(
      '<cbc:TaxableAmount currencyID="EUR">150.50</cbc:TaxableAmount>'
    )
  })

  it('escapes special characters in the line description', () => {
    const input = baseInput()
    input.items[0].description = 'Bremsen & <Service> "neu" \'spezial\''
    const xml = renderXRechnungXml(input)
    expect(xml).toContain(
      '<cbc:Name>Bremsen &amp; &lt;Service&gt; &quot;neu&quot; &apos;spezial&apos;</cbc:Name>'
    )
    // Make sure no raw `&` slipped through.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })

  it('renders one InvoiceLine block per item', () => {
    const input = baseInput()
    input.items = [
      { ...baseItem, id: 'i-1', positionNumber: 1, description: 'Pos 1' },
      { ...baseItem, id: 'i-2', positionNumber: 2, description: 'Pos 2' },
      { ...baseItem, id: 'i-3', positionNumber: 3, description: 'Pos 3' }
    ]
    const xml = renderXRechnungXml(input)
    const openings = xml.match(/<cac:InvoiceLine>/g) ?? []
    const closings = xml.match(/<\/cac:InvoiceLine>/g) ?? []
    expect(openings.length).toBe(3)
    expect(closings.length).toBe(3)
    expect(xml).toContain('<cbc:Name>Pos 1</cbc:Name>')
    expect(xml).toContain('<cbc:Name>Pos 2</cbc:Name>')
    expect(xml).toContain('<cbc:Name>Pos 3</cbc:Name>')
  })

  it('Kleinunternehmer (§19): no positive tax, marks category E', () => {
    const input = baseInput()
    input.settings = { ...input.settings, smallBusinessExempt: true }
    // Doc-level totals as the app would persist them for a Kleinunternehmer
    input.doc = {
      ...input.doc,
      taxRate: '0.00',
      taxTotal: '0.00',
      grossTotal: '100.00'
    }
    input.items[0] = {
      ...input.items[0],
      taxRate: '0.00',
      lineTotalGross: '100.00'
    }
    const xml = renderXRechnungXml(input)
    expect(xml).toContain('<cbc:ID>E</cbc:ID>')
    expect(xml).toContain('Steuerbefreit nach §19 UStG')
    expect(xml).toContain(
      'Rechnung ohne Umsatzsteuer gemäß §19 UStG (Kleinunternehmer).'
    )
    // No `S` tax category should appear in the output.
    expect(xml).not.toContain('<cbc:ID>S</cbc:ID>')
    // Totals: payable = net = 100.00
    expect(xml).toContain(
      '<cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>'
    )
  })

  it('preserves zero and negative line totals (e.g. discount lines)', () => {
    const input = baseInput()
    input.items = [
      { ...baseItem, id: 'i-1', positionNumber: 1, lineTotalNet: '100.00' },
      {
        ...baseItem,
        id: 'i-2',
        positionNumber: 2,
        description: 'Rabatt',
        unitPriceNet: '-10.00',
        lineTotalNet: '-10.00'
      },
      {
        ...baseItem,
        id: 'i-3',
        positionNumber: 3,
        description: 'Gratis',
        unitPriceNet: '0.00',
        lineTotalNet: '0.00'
      }
    ]
    const xml = renderXRechnungXml(input)
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="EUR">-10.00</cbc:LineExtensionAmount>'
    )
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="EUR">0.00</cbc:LineExtensionAmount>'
    )
    // Negative price preserved at item level
    expect(xml).toContain(
      '<cbc:PriceAmount currencyID="EUR">-10.00</cbc:PriceAmount>'
    )
  })

  it('declares the document currency as EUR', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain(
      '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>'
    )
    // And every monetary amount carries the EUR currency attribute.
    expect(xml).toMatch(/currencyID="EUR"/)
  })

  it('includes IssueDate and DueDate in ISO format', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain('<cbc:IssueDate>2026-05-01</cbc:IssueDate>')
    expect(xml).toContain('<cbc:DueDate>2026-05-15</cbc:DueDate>')
  })

  it('embeds IBAN and BIC in the PaymentMeans block', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain('DE12500105170648489890') // IBAN whitespace stripped
    expect(xml).toContain('INGDDEFFXXX')
    expect(xml).toContain('<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>')
  })
})
