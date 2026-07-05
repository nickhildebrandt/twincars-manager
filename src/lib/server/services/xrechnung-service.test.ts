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

  it('pins the XRechnung 3.x CustomizationID (xeinkauf.de namespace)', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain(
      '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>'
    )
    // The pre-3.0 xoev-de namespace must be gone.
    expect(xml).not.toContain('urn:xoev-de')
  })

  it('orders PaymentMeans before PaymentTerms (UBL 2.1 XSD sequence)', () => {
    const xml = renderXRechnungXml(baseInput())
    const means = xml.indexOf('<cac:PaymentMeans>')
    const terms = xml.indexOf('<cac:PaymentTerms>')
    expect(means).toBeGreaterThan(-1)
    expect(terms).toBeGreaterThan(-1)
    expect(means).toBeLessThan(terms)
  })

  it('emits BuyerReference (BT-10) with the customer number directly after DocumentCurrencyCode', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain('<cbc:BuyerReference>KU-00001</cbc:BuyerReference>')
    const currency = xml.indexOf('<cbc:DocumentCurrencyCode>')
    const buyerRef = xml.indexOf('<cbc:BuyerReference>')
    const supplier = xml.indexOf('<cac:AccountingSupplierParty>')
    expect(currency).toBeLessThan(buyerRef)
    expect(buyerRef).toBeLessThan(supplier)
  })

  it('emits EndpointID (BT-34/BT-49) with scheme EM for both parties', () => {
    const xml = renderXRechnungXml(baseInput())
    expect(xml).toContain(
      '<cbc:EndpointID schemeID="EM">info@mueller.example</cbc:EndpointID>'
    )
    expect(xml).toContain(
      '<cbc:EndpointID schemeID="EM">max@mustermann.example</cbc:EndpointID>'
    )
    // EndpointID must precede PartyName inside each Party (XSD order).
    const supplierParty = xml.slice(
      xml.indexOf('<cac:AccountingSupplierParty>'),
      xml.indexOf('</cac:AccountingSupplierParty>')
    )
    expect(supplierParty.indexOf('<cbc:EndpointID')).toBeLessThan(
      supplierParty.indexOf('<cac:PartyName>')
    )
    const customerParty = xml.slice(
      xml.indexOf('<cac:AccountingCustomerParty>'),
      xml.indexOf('</cac:AccountingCustomerParty>')
    )
    expect(customerParty.indexOf('<cbc:EndpointID')).toBeLessThan(
      customerParty.indexOf('<cac:PartyName>')
    )
  })

  it('always emits the seller Contact (BG-6) with name, phone and mail', () => {
    const xml = renderXRechnungXml(baseInput())
    const supplierParty = xml.slice(
      xml.indexOf('<cac:AccountingSupplierParty>'),
      xml.indexOf('</cac:AccountingSupplierParty>')
    )
    // owner is null in the fixture → falls back to the company name.
    expect(supplierParty).toContain(
      '<cbc:Name>Werkstatt Müller GmbH</cbc:Name>'
    )
    expect(supplierParty).toContain('<cbc:Telephone>030/123</cbc:Telephone>')
    expect(supplierParty).toContain(
      '<cbc:ElectronicMail>info@mueller.example</cbc:ElectronicMail>'
    )
  })

  it('prefers the owner name for the seller contact when set', () => {
    const input = baseInput()
    input.settings = {
      ...input.settings,
      owner: 'Hans Müller'
    } as unknown as CompanySettings
    const xml = renderXRechnungXml(input)
    expect(xml).toContain('<cbc:Name>Hans Müller</cbc:Name>')
  })

  it('falls back to the mobile number for the seller contact phone', () => {
    const input = baseInput()
    input.settings = {
      ...input.settings,
      phone: null,
      mobile: '0171/9999'
    } as unknown as CompanySettings
    const xml = renderXRechnungXml(input)
    expect(xml).toContain('<cbc:Telephone>0171/9999</cbc:Telephone>')
  })

  it('maps the Steuernummer to a PartyTaxScheme with TaxScheme FC (BT-32)', () => {
    const xml = renderXRechnungXml(baseInput())
    const supplierParty = xml.slice(
      xml.indexOf('<cac:AccountingSupplierParty>'),
      xml.indexOf('</cac:AccountingSupplierParty>')
    )
    expect(supplierParty).toContain('<cbc:ID>FC</cbc:ID>')
    expect(supplierParty).toContain(
      '<cbc:CompanyID>99/123/45678</cbc:CompanyID>'
    )
    // The tax number must no longer live in PartyLegalEntity/CompanyID
    // (that slot is BT-30, the trade register number).
    const legalEntity = supplierParty.slice(
      supplierParty.indexOf('<cac:PartyLegalEntity>'),
      supplierParty.indexOf('</cac:PartyLegalEntity>')
    )
    expect(legalEntity).not.toContain('99/123/45678')
    // The VAT PartyTaxScheme is kept alongside the FC one.
    expect(supplierParty).toContain(
      '<cbc:CompanyID>DE123456789</cbc:CompanyID>'
    )
    expect(supplierParty).toContain('<cbc:ID>VAT</cbc:ID>')
  })
})

describe('renderXRechnungXml — mandatory master data', () => {
  const expectError400 = (input: XRechnungInput, messagePart: string) => {
    try {
      renderXRechnungXml(input)
      expect.unreachable('expected error(400) to be thrown')
    } catch (e) {
      const err = e as { status?: number; body?: { message?: string } }
      expect(err.status).toBe(400)
      expect(err.body?.message).toContain(messagePart)
    }
  }

  it('rejects with 400 when the seller e-mail is missing', () => {
    const input = baseInput()
    input.settings = {
      ...input.settings,
      email: null
    } as unknown as CompanySettings
    expectError400(input, 'E-Mail-Adresse')
  })

  it('rejects with 400 when both seller phone and mobile are missing', () => {
    const input = baseInput()
    input.settings = {
      ...input.settings,
      phone: null,
      mobile: null
    } as unknown as CompanySettings
    expectError400(input, 'Telefonnummer')
  })

  it('rejects with 400 when the seller IBAN is missing', () => {
    const input = baseInput()
    input.settings = {
      ...input.settings,
      iban: null
    } as unknown as CompanySettings
    expectError400(input, 'IBAN')
  })

  it('rejects with 400 when the customer is missing entirely', () => {
    const input = baseInput()
    input.customer = null
    expectError400(input, 'Kunde')
  })

  it('rejects with 400 when the customer e-mail is missing', () => {
    const input = baseInput()
    input.customer = { ...baseCustomer, email: null } as unknown as Customer
    expectError400(input, 'E-Mail-Adresse')
  })
})
