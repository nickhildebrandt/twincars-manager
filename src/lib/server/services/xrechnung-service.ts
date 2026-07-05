/**
 * XRechnung 3.0 / UBL 2.1 XML generator.
 *
 * Background
 * ----------
 * Ab 2026 müssen B2B-Rechnungen in Deutschland in einem strukturierten,
 * elektronischen Format vorliegen (EN 16931). Wir erzeugen hier den
 * "XRechnung-CIUS" als reine XML-Datei (UBL 2.1 Invoice) — der einfachste
 * Weg zur Konformität ohne PDF/A-3-Einbettung (ZUGFeRD). Das XML wird als
 * Sidecar-Download neben dem klassischen PDF angeboten.
 *
 * Mapping
 * -------
 * Wir teilen die `DocumentRenderInput`-Struktur mit dem PDF-Renderer, damit
 * dieselben Stammdaten in beiden Repräsentationen landen. Felder ohne
 * direktes XRechnung-Pendant (Fahrzeug, interner Beleg-Footer etc.)
 * werden bewusst weggelassen.
 *
 * Kleinunternehmer-Sonderfall
 * ---------------------------
 * Setzt das Unternehmen `smallBusinessExempt` (§19 UStG), entfällt der
 * komplette `TaxTotal`/`TaxSubtotal`-Block; stattdessen taggt die einzige
 * Line die Position mit `TaxCategory/ID = E` ("exempt from tax") und
 * legt unter `TaxExemptionReason` den Hinweistext ab.
 *
 * Referenz: https://xeinkauf.de/xrechnung/versionen-und-bundles/
 */

import { error } from '@sveltejs/kit'
import type { DocumentRenderInput } from './pdf-service'

export type XRechnungInput = DocumentRenderInput

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const round2 = (v: number): number => Math.round(v * 100) / 100

/** UBL/XRechnung wants amounts as plain dotted decimal with 2 places. */
const fmtMoney = (v: number | string | null | undefined): string => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** UBL Quantity allows up to 4 decimals — drop trailing zeros for clarity. */
const fmtQty = (v: number | string | null | undefined): string => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  // 4 decimals is the max XRechnung permits — keep it consistent rather
  // than trimming zeros (some validators get confused otherwise).
  return (Math.round(n * 10000) / 10000).toFixed(4)
}

/** UBL date strings are ISO `YYYY-MM-DD`. */
const fmtDate = (s: string | null | undefined): string => {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s
}

/**
 * Escape the five characters XML requires: `& < > " '`. Keep this
 * exported so the tests can poke at it directly.
 */
export const escapeXml = (s: string | null | undefined): string => {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ------------------------------------------------------------------ */
/* Name / address helpers                                             */
/* ------------------------------------------------------------------ */

const customerDisplayName = (cust: XRechnungInput['customer']): string => {
  if (!cust) return 'Unbekannter Kunde'
  if (cust.company) return cust.company
  const name = `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim()
  return name || 'Unbekannter Kunde'
}

/**
 * ISO-3166-1 alpha-2 country code for the customer/supplier postal
 * address. Defaults to `DE` because the whole app is targeted at a
 * German Kfz-Betrieb. We only recognize a handful of names; everything
 * else falls back to `DE` to stay schema-valid.
 */
const countryCode = (name: string | null | undefined): string => {
  if (!name) return 'DE'
  const norm = name.trim().toLowerCase()
  if (!norm) return 'DE'
  if (/^de/.test(norm) || norm.includes('deutsch')) return 'DE'
  if (norm.includes('öster') || norm.includes('austria')) return 'AT'
  if (norm.includes('schweiz') || norm.includes('switzer')) return 'CH'
  if (norm.includes('frankreich') || norm.includes('france')) return 'FR'
  if (norm.includes('nieder') || norm.includes('netherl')) return 'NL'
  if (norm.includes('polen') || norm.includes('poland')) return 'PL'
  // 2-letter shortcut already? Accept that too.
  if (/^[a-z]{2}$/.test(norm)) return norm.toUpperCase()
  return 'DE'
}

/* ------------------------------------------------------------------ */
/* XML block builders                                                 */
/* ------------------------------------------------------------------ */

const postalAddress = (parts: {
  street: string | null | undefined
  zip: string | null | undefined
  city: string | null | undefined
  country: string | null | undefined
}): string => {
  const lines: string[] = []
  lines.push('      <cac:PostalAddress>')
  if (parts.street)
    lines.push(
      `        <cbc:StreetName>${escapeXml(parts.street)}</cbc:StreetName>`
    )
  if (parts.city)
    lines.push(`        <cbc:CityName>${escapeXml(parts.city)}</cbc:CityName>`)
  if (parts.zip)
    lines.push(
      `        <cbc:PostalZone>${escapeXml(parts.zip)}</cbc:PostalZone>`
    )
  lines.push('        <cac:Country>')
  lines.push(
    `          <cbc:IdentificationCode>${countryCode(parts.country)}</cbc:IdentificationCode>`
  )
  lines.push('        </cac:Country>')
  lines.push('      </cac:PostalAddress>')
  return lines.join('\n')
}

const supplierBlock = (input: XRechnungInput): string => {
  const co = input.settings
  const name = co.companyName || 'Lieferant'
  const lines: string[] = []
  lines.push('  <cac:AccountingSupplierParty>')
  lines.push('    <cac:Party>')
  // BT-34 Seller electronic address — mandatory since XRechnung 3.0.1.
  // Scheme `EM` = electronic mail (EAS code list). Note: the UBL 2.1 XSD
  // places EndpointID before PartyName/PostalAddress, so it must stay the
  // first child here. (WebsiteURI is deliberately not emitted — it is not
  // part of the EN 16931 data model and triggers UBL-CR warnings.)
  lines.push(
    `      <cbc:EndpointID schemeID="EM">${escapeXml(co.email)}</cbc:EndpointID>`
  )
  lines.push('      <cac:PartyName>')
  lines.push(`        <cbc:Name>${escapeXml(name)}</cbc:Name>`)
  lines.push('      </cac:PartyName>')
  lines.push(
    postalAddress({
      street: co.street,
      zip: co.zip,
      city: co.city,
      country: 'DE'
    })
  )
  if (co.vatId) {
    // BT-31 Seller VAT identifier
    lines.push('      <cac:PartyTaxScheme>')
    lines.push(`        <cbc:CompanyID>${escapeXml(co.vatId)}</cbc:CompanyID>`)
    lines.push('        <cac:TaxScheme>')
    lines.push('          <cbc:ID>VAT</cbc:ID>')
    lines.push('        </cac:TaxScheme>')
    lines.push('      </cac:PartyTaxScheme>')
  }
  if (co.taxNumber) {
    // BT-32 Seller tax registration identifier (deutsche Steuernummer).
    // EN 16931 maps this to a second PartyTaxScheme with TaxScheme ID
    // `FC` — it must NOT live in PartyLegalEntity/CompanyID (that is
    // BT-30, the trade register number).
    lines.push('      <cac:PartyTaxScheme>')
    lines.push(
      `        <cbc:CompanyID>${escapeXml(co.taxNumber)}</cbc:CompanyID>`
    )
    lines.push('        <cac:TaxScheme>')
    lines.push('          <cbc:ID>FC</cbc:ID>')
    lines.push('        </cac:TaxScheme>')
    lines.push('      </cac:PartyTaxScheme>')
  }
  lines.push('      <cac:PartyLegalEntity>')
  lines.push(
    `        <cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName>`
  )
  lines.push('      </cac:PartyLegalEntity>')
  // BG-6 SELLER CONTACT — mandatory per BR-DE-2, with Name (BR-DE-5),
  // Telephone (BR-DE-6) and ElectronicMail (BR-DE-7) all required.
  lines.push('      <cac:Contact>')
  lines.push(`        <cbc:Name>${escapeXml(co.owner || name)}</cbc:Name>`)
  lines.push(
    `        <cbc:Telephone>${escapeXml(co.phone || co.mobile)}</cbc:Telephone>`
  )
  lines.push(
    `        <cbc:ElectronicMail>${escapeXml(co.email)}</cbc:ElectronicMail>`
  )
  lines.push('      </cac:Contact>')
  lines.push('    </cac:Party>')
  lines.push('  </cac:AccountingSupplierParty>')
  return lines.join('\n')
}

const customerBlock = (input: XRechnungInput): string => {
  const cust = input.customer
  const name = customerDisplayName(cust)
  const lines: string[] = []
  lines.push('  <cac:AccountingCustomerParty>')
  lines.push('    <cac:Party>')
  // BT-49 Buyer electronic address — mandatory since XRechnung 3.0.1.
  lines.push(
    `      <cbc:EndpointID schemeID="EM">${escapeXml(cust?.email)}</cbc:EndpointID>`
  )
  lines.push('      <cac:PartyName>')
  lines.push(`        <cbc:Name>${escapeXml(name)}</cbc:Name>`)
  lines.push('      </cac:PartyName>')
  lines.push(
    postalAddress({
      street: cust?.street,
      zip: cust?.zip,
      city: cust?.city,
      country: cust?.country ?? 'DE'
    })
  )
  if (cust?.vatId) {
    lines.push('      <cac:PartyTaxScheme>')
    lines.push(
      `        <cbc:CompanyID>${escapeXml(cust.vatId)}</cbc:CompanyID>`
    )
    lines.push('        <cac:TaxScheme>')
    lines.push('          <cbc:ID>VAT</cbc:ID>')
    lines.push('        </cac:TaxScheme>')
    lines.push('      </cac:PartyTaxScheme>')
  }
  lines.push('      <cac:PartyLegalEntity>')
  lines.push(
    `        <cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName>`
  )
  lines.push('      </cac:PartyLegalEntity>')
  if (cust?.email) {
    lines.push('      <cac:Contact>')
    lines.push(
      `        <cbc:ElectronicMail>${escapeXml(cust.email)}</cbc:ElectronicMail>`
    )
    lines.push('      </cac:Contact>')
  }
  lines.push('    </cac:Party>')
  lines.push('  </cac:AccountingCustomerParty>')
  return lines.join('\n')
}

const paymentMeansBlock = (input: XRechnungInput): string => {
  const co = input.settings
  // 58 = SEPA credit transfer (UBL Payment Means Code list)
  const lines: string[] = []
  lines.push('  <cac:PaymentMeans>')
  lines.push('    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>')
  if (input.doc.documentNumber)
    lines.push(
      `    <cbc:PaymentID>${escapeXml(input.doc.documentNumber)}</cbc:PaymentID>`
    )
  if (co.iban) {
    lines.push('    <cac:PayeeFinancialAccount>')
    lines.push(
      `      <cbc:ID>${escapeXml(co.iban.replace(/\s+/g, ''))}</cbc:ID>`
    )
    if (co.bankName)
      lines.push(`      <cbc:Name>${escapeXml(co.bankName)}</cbc:Name>`)
    if (co.bic) {
      lines.push('      <cac:FinancialInstitutionBranch>')
      lines.push(`        <cbc:ID>${escapeXml(co.bic)}</cbc:ID>`)
      lines.push('      </cac:FinancialInstitutionBranch>')
    }
    lines.push('    </cac:PayeeFinancialAccount>')
  }
  lines.push('  </cac:PaymentMeans>')
  return lines.join('\n')
}

/**
 * Tax totals & subtotals. Grouped by tax rate so multi-rate invoices
 * (z.B. 19 % Material + 7 % Bücher) bekommen je einen `TaxSubtotal`.
 *
 * Im Kleinunternehmer-Fall (§19 UStG) wird ein einziger Subtotal mit
 * Kategorie `E` (steuerbefreit) und Steuerrate 0 erzeugt, plus der
 * Pflicht-Hinweistext im `TaxExemptionReason`.
 */
const taxTotalBlock = (input: XRechnungInput): string => {
  const isExempt = input.settings.smallBusinessExempt === true
  const lines: string[] = []
  if (isExempt) {
    const netSum = input.items.reduce(
      (s, it) => round2(s + Number(it.lineTotalNet ?? 0)),
      0
    )
    lines.push('  <cac:TaxTotal>')
    lines.push(
      `    <cbc:TaxAmount currencyID="EUR">${fmtMoney(0)}</cbc:TaxAmount>`
    )
    lines.push('    <cac:TaxSubtotal>')
    lines.push(
      `      <cbc:TaxableAmount currencyID="EUR">${fmtMoney(netSum)}</cbc:TaxableAmount>`
    )
    lines.push(
      `      <cbc:TaxAmount currencyID="EUR">${fmtMoney(0)}</cbc:TaxAmount>`
    )
    lines.push('      <cac:TaxCategory>')
    lines.push('        <cbc:ID>E</cbc:ID>')
    lines.push('        <cbc:Percent>0.00</cbc:Percent>')
    lines.push(
      '        <cbc:TaxExemptionReason>Steuerbefreit nach §19 UStG (Kleinunternehmer).</cbc:TaxExemptionReason>'
    )
    lines.push('        <cac:TaxScheme>')
    lines.push('          <cbc:ID>VAT</cbc:ID>')
    lines.push('        </cac:TaxScheme>')
    lines.push('      </cac:TaxCategory>')
    lines.push('    </cac:TaxSubtotal>')
    lines.push('  </cac:TaxTotal>')
    return lines.join('\n')
  }

  // Group lines by their tax rate.
  const groups = new Map<number, { taxable: number; tax: number }>()
  for (const it of input.items) {
    const rate = Number(it.taxRate ?? 0)
    const net = Number(it.lineTotalNet ?? 0)
    const tax = round2(net * (rate / 100))
    const g = groups.get(rate) ?? { taxable: 0, tax: 0 }
    g.taxable = round2(g.taxable + net)
    g.tax = round2(g.tax + tax)
    groups.set(rate, g)
  }
  const totalTax = Array.from(groups.values()).reduce(
    (s, g) => round2(s + g.tax),
    0
  )
  lines.push('  <cac:TaxTotal>')
  lines.push(
    `    <cbc:TaxAmount currencyID="EUR">${fmtMoney(totalTax)}</cbc:TaxAmount>`
  )
  for (const [rate, g] of Array.from(groups.entries()).sort(
    (a, b) => a[0] - b[0]
  )) {
    lines.push('    <cac:TaxSubtotal>')
    lines.push(
      `      <cbc:TaxableAmount currencyID="EUR">${fmtMoney(g.taxable)}</cbc:TaxableAmount>`
    )
    lines.push(
      `      <cbc:TaxAmount currencyID="EUR">${fmtMoney(g.tax)}</cbc:TaxAmount>`
    )
    lines.push('      <cac:TaxCategory>')
    // `S` = Standard rated. Could be `AA` (lower rate) for 7 %, but
    // UBL/XRechnung accepts `S` across positive rates and validators do
    // not reject it for the reduced rate either.
    lines.push('        <cbc:ID>S</cbc:ID>')
    lines.push(`        <cbc:Percent>${fmtMoney(rate)}</cbc:Percent>`)
    lines.push('        <cac:TaxScheme>')
    lines.push('          <cbc:ID>VAT</cbc:ID>')
    lines.push('        </cac:TaxScheme>')
    lines.push('      </cac:TaxCategory>')
    lines.push('    </cac:TaxSubtotal>')
  }
  lines.push('  </cac:TaxTotal>')
  return lines.join('\n')
}

const monetaryTotalBlock = (input: XRechnungInput): string => {
  const isExempt = input.settings.smallBusinessExempt === true
  const net = Number(input.doc.netTotal ?? 0)
  const gross = isExempt ? net : Number(input.doc.grossTotal ?? 0)
  const lines: string[] = []
  lines.push('  <cac:LegalMonetaryTotal>')
  lines.push(
    `    <cbc:LineExtensionAmount currencyID="EUR">${fmtMoney(net)}</cbc:LineExtensionAmount>`
  )
  lines.push(
    `    <cbc:TaxExclusiveAmount currencyID="EUR">${fmtMoney(net)}</cbc:TaxExclusiveAmount>`
  )
  lines.push(
    `    <cbc:TaxInclusiveAmount currencyID="EUR">${fmtMoney(gross)}</cbc:TaxInclusiveAmount>`
  )
  lines.push(
    `    <cbc:PayableAmount currencyID="EUR">${fmtMoney(gross)}</cbc:PayableAmount>`
  )
  lines.push('  </cac:LegalMonetaryTotal>')
  return lines.join('\n')
}

const invoiceLineBlock = (
  it: XRechnungInput['items'][number],
  isExempt: boolean
): string => {
  const lines: string[] = []
  const qty = Number(it.quantity ?? 0)
  const unitPriceNet = Number(it.unitPriceNet ?? 0)
  const lineNet = Number(it.lineTotalNet ?? 0)
  const taxRate = isExempt ? 0 : Number(it.taxRate ?? 0)
  lines.push('  <cac:InvoiceLine>')
  lines.push(`    <cbc:ID>${it.positionNumber}</cbc:ID>`)
  // UBL Quantity unitCode — `H87` is the UN/CEFACT code for "piece".
  // We don't currently round-trip the unit-of-measure list so we use
  // H87 across the board which validators accept as the catch-all.
  lines.push(
    `    <cbc:InvoicedQuantity unitCode="H87">${fmtQty(qty)}</cbc:InvoicedQuantity>`
  )
  lines.push(
    `    <cbc:LineExtensionAmount currencyID="EUR">${fmtMoney(lineNet)}</cbc:LineExtensionAmount>`
  )
  lines.push('    <cac:Item>')
  lines.push(`      <cbc:Name>${escapeXml(it.description ?? '')}</cbc:Name>`)
  if (it.articleNumber) {
    lines.push('      <cac:SellersItemIdentification>')
    lines.push(`        <cbc:ID>${escapeXml(it.articleNumber)}</cbc:ID>`)
    lines.push('      </cac:SellersItemIdentification>')
  }
  lines.push('      <cac:ClassifiedTaxCategory>')
  lines.push(`        <cbc:ID>${isExempt ? 'E' : 'S'}</cbc:ID>`)
  lines.push(`        <cbc:Percent>${fmtMoney(taxRate)}</cbc:Percent>`)
  lines.push('        <cac:TaxScheme>')
  lines.push('          <cbc:ID>VAT</cbc:ID>')
  lines.push('        </cac:TaxScheme>')
  lines.push('      </cac:ClassifiedTaxCategory>')
  lines.push('    </cac:Item>')
  lines.push('    <cac:Price>')
  lines.push(
    `      <cbc:PriceAmount currencyID="EUR">${fmtMoney(unitPriceNet)}</cbc:PriceAmount>`
  )
  lines.push('    </cac:Price>')
  lines.push('  </cac:InvoiceLine>')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Public renderer                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fail fast (HTTP 400, curated German message) when master data that
 * XRechnung/EN 16931 makes mandatory is missing. Doing this before any
 * XML is built means the operator gets an actionable hint instead of a
 * KoSIT validator rejection after download.
 */
const assertMandatoryMasterData = (input: XRechnungInput): void => {
  const co = input.settings
  if (!co.email) {
    error(
      400,
      'XRechnung kann nicht erstellt werden: In den Firmeneinstellungen fehlt die E-Mail-Adresse.'
    )
  }
  if (!co.phone && !co.mobile) {
    error(
      400,
      'XRechnung kann nicht erstellt werden: In den Firmeneinstellungen fehlt eine Telefonnummer (Telefon oder Mobil).'
    )
  }
  if (!co.iban) {
    // BR-DE-1 requires PAYMENT INSTRUCTIONS, and BR-61 requires the
    // payment account identifier for credit-transfer payment means.
    error(
      400,
      'XRechnung kann nicht erstellt werden: In den Firmeneinstellungen fehlt die IBAN.'
    )
  }
  if (!input.customer?.customerNumber) {
    error(
      400,
      'XRechnung kann nicht erstellt werden: Der Rechnung ist kein Kunde mit Kundennummer zugeordnet.'
    )
  }
  if (!input.customer.email) {
    error(
      400,
      'XRechnung kann nicht erstellt werden: Beim Kunden fehlt die E-Mail-Adresse.'
    )
  }
}

/**
 * Render the given document as an XRechnung 3.0 UBL Invoice XML string.
 * The output is a complete XML document including the UTF-8 declaration
 * and the XRechnung `CustomizationID`.
 *
 * Throws `error(400, …)` with a German operator hint when mandatory
 * master data (seller e-mail/phone/IBAN, buyer e-mail, customer number)
 * is missing — see `assertMandatoryMasterData`.
 *
 * @param input Reuses the `DocumentRenderInput` shape that the PDF
 *              renderer takes — same loader, two output formats.
 * @returns     XML string. The caller is responsible for base64-encoding
 *              for the remote-function wire format.
 */
export const renderXRechnungXml = (input: XRechnungInput): string => {
  assertMandatoryMasterData(input)
  const isExempt = input.settings.smallBusinessExempt === true
  // XRechnung 3.x specification identifier — since 3.0 the CIUS lives in
  // the `xeinkauf.de` namespace (the old `urn:xoev-de:kosit:standard:…`
  // value is rejected by the KoSIT validator).
  const customizationId =
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
  const profileId = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'

  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8"?>')
  out.push(
    '<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'
  )
  out.push(
    '             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"'
  )
  out.push(
    '             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">'
  )
  out.push(`  <cbc:CustomizationID>${customizationId}</cbc:CustomizationID>`)
  out.push(`  <cbc:ProfileID>${profileId}</cbc:ProfileID>`)
  out.push(`  <cbc:ID>${escapeXml(input.doc.documentNumber)}</cbc:ID>`)
  out.push(`  <cbc:IssueDate>${fmtDate(input.doc.issueDate)}</cbc:IssueDate>`)
  if (input.doc.dueDate)
    out.push(`  <cbc:DueDate>${fmtDate(input.doc.dueDate)}</cbc:DueDate>`)
  // `380` = commercial invoice (UN/EDIFACT code list 1001)
  out.push('  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>')
  if (isExempt) {
    out.push(
      '  <cbc:Note>Rechnung ohne Umsatzsteuer gemäß §19 UStG (Kleinunternehmer).</cbc:Note>'
    )
  }
  if (input.doc.notes)
    out.push(`  <cbc:Note>${escapeXml(input.doc.notes)}</cbc:Note>`)
  out.push('  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>')
  // BT-10 Buyer reference — mandatory per BR-DE-15. Public-sector buyers
  // expect their Leitweg-ID here; we do not have a dedicated field for
  // that yet (documented future schema addition), so the customer number
  // serves as the reference for the B2B case.
  out.push(
    `  <cbc:BuyerReference>${escapeXml(input.customer?.customerNumber)}</cbc:BuyerReference>`
  )

  out.push(supplierBlock(input))
  out.push(customerBlock(input))

  // UBL 2.1 XSD sequence: PaymentMeans MUST precede PaymentTerms.
  out.push(paymentMeansBlock(input))

  // Payment terms / due date hint
  if (input.doc.dueDate) {
    out.push('  <cac:PaymentTerms>')
    out.push(
      `    <cbc:Note>Zahlbar bis ${escapeXml(fmtDate(input.doc.dueDate))}</cbc:Note>`
    )
    out.push('  </cac:PaymentTerms>')
  }

  out.push(taxTotalBlock(input))
  out.push(monetaryTotalBlock(input))

  // Lines
  for (const it of input.items) {
    out.push(invoiceLineBlock(it, isExempt))
  }

  out.push('</ubl:Invoice>')
  return out.join('\n')
}
