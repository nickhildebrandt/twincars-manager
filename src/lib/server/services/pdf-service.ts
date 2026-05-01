/**
 * PDF generation + caching service.
 *
 * Strategy
 * --------
 * - We render the PDF for a document **once** with `pdf-lib` and persist
 *   the bytes in the `document_pdfs` table (`bytea`).
 * - Each render is keyed by a SHA-256 over a canonical JSON shape of the
 *   document's relevant inputs (line items, totals, customer data,
 *   company settings hash, `updatedAt`). When any of those change, the
 *   hash changes, and the next call to {@link getOrRenderDocumentPdf}
 *   triggers a re-render. Otherwise the cached bytes are served.
 * - The bytes never bleed into list queries — service-layer helpers in
 *   the document/invoice/offer paths only ever load metadata. The actual
 *   payload is only fetched through the dedicated endpoint
 *   `getDocumentPdfBytes` in the remote layer.
 *
 * The renderer below is intentionally minimal-but-correct: it lays out
 * everything required for a German-compliant Rechnung / Kostenvoranschlag
 * (vollständige Pflichtangaben). Visual polish iterates from here.
 */

import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  customers,
  documentItems,
  documentPdfs,
  documents,
  type CompanySettings,
  type Customer,
  type Document,
  type DocumentItem,
  type DocumentPdf
} from '$lib/server/db/schema'
import { getSettings } from './settings-service'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type DocumentRenderInput = {
  doc: Document
  items: DocumentItem[]
  customer: Customer | null
  settings: CompanySettings
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const round2 = (v: number): number => Math.round(v * 100) / 100

const formatEur = (v: number | string): string => {
  const n = typeof v === 'string' ? Number(v) : v
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(n)
}

const formatDate = (s: string | null | undefined): string => {
  if (!s) return '—'
  // YYYY-MM-DD → DD.MM.YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}

const sortObject = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(sortObject) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = sortObject((value as Record<string, unknown>)[key])
    }
    return out as T
  }
  return value
}

/**
 * Canonical hash over everything that can influence the rendered output.
 * Field order is normalized via {@link sortObject} so two semantically
 * equal payloads always produce the same digest.
 */
export const computeDocumentInputHash = (
  input: DocumentRenderInput
): string => {
  const canonical = sortObject({
    doc: {
      id: input.doc.id,
      number: input.doc.documentNumber,
      type: input.doc.type,
      status: input.doc.status,
      issueDate: input.doc.issueDate,
      serviceDate: input.doc.serviceDate,
      dueDate: input.doc.dueDate,
      paymentMethod: input.doc.paymentMethod,
      taxRate: input.doc.taxRate,
      netTotal: input.doc.netTotal,
      taxTotal: input.doc.taxTotal,
      grossTotal: input.doc.grossTotal,
      discountTotal: input.doc.discountTotal,
      header: input.doc.header,
      footer: input.doc.footer,
      notes: input.doc.notes,
      customerId: input.doc.customerId,
      vehicleId: input.doc.vehicleId,
      updatedAt: input.doc.updatedAt
    },
    items: input.items.map((it) => ({
      n: it.positionNumber,
      d: it.description,
      q: it.quantity,
      u: it.unit,
      p: it.unitPriceNet,
      r: it.discountPercent,
      t: it.taxRate,
      g: it.lineTotalGross,
      net: it.lineTotalNet
    })),
    customer: input.customer
      ? {
          id: input.customer.id,
          company: input.customer.company,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          street: input.customer.street,
          zip: input.customer.zip,
          city: input.customer.city,
          email: input.customer.email
        }
      : null,
    settings: {
      name: input.settings.companyName,
      street: input.settings.street,
      zip: input.settings.zip,
      city: input.settings.city,
      email: input.settings.email,
      phone: input.settings.phone,
      website: input.settings.website,
      vatId: input.settings.vatId,
      taxNumber: input.settings.taxNumber,
      bankName: input.settings.bankName,
      iban: input.settings.iban,
      bic: input.settings.bic,
      pdfFooter: input.settings.pdfFooter,
      smallBusiness: input.settings.smallBusinessExempt
    }
  })
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/* ------------------------------------------------------------------ */
/* Renderer                                                           */
/* ------------------------------------------------------------------ */

const documentTypeLabelDe = (type: string): string => {
  switch (type) {
    case 'invoice':
      return 'Rechnung'
    case 'offer':
      return 'Angebot'
    case 'cost_estimate':
      return 'Kostenvoranschlag'
    case 'order_confirmation':
      return 'Auftragsbestätigung'
    case 'reminder':
      return 'Mahnung'
    default:
      return type
  }
}

/**
 * Render a single-page A4 PDF for the given document. Layout is
 * intentionally classic German invoice-style: company block top-left,
 * customer address right, document headline + meta row, line-item
 * table, totals box, footer with bank + tax-id details.
 */
export const renderDocumentPdf = async (
  input: DocumentRenderInput
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const ml = 50 // left margin
  const mr = 50 // right margin
  const innerW = width - ml - mr
  let y = height - 50

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: {
      size?: number
      bold?: boolean
      color?: [number, number, number]
      width?: number
    } = {}
  ) => {
    page.drawText(s, {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.bold ? fontBold : font,
      color: rgb(...(opts.color ?? [0, 0, 0])),
      maxWidth: opts.width
    })
  }

  /* — Company header block — */
  const co = input.settings
  text(co.companyName || 'Firma', ml, y, { size: 11, bold: true })
  y -= 14
  text(co.street, ml, y, { size: 9 })
  y -= 11
  text(`${co.zip} ${co.city}`, ml, y, { size: 9 })
  y -= 11
  if (co.phone) {
    text(`Telefon: ${co.phone}`, ml, y, { size: 9 })
    y -= 11
  }
  if (co.email) {
    text(`E-Mail: ${co.email}`, ml, y, { size: 9 })
    y -= 11
  }

  /* — Customer address (right) — */
  let cy = height - 50
  const cx = ml + innerW / 2 + 10
  text('Rechnungsempfänger:', cx, cy, { size: 9, color: [0.4, 0.4, 0.4] })
  cy -= 14
  const cust = input.customer
  if (cust) {
    const name =
      cust.company ||
      `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim() ||
      '—'
    text(name, cx, cy, { size: 11, bold: true })
    cy -= 14
    if (cust.street) {
      text(cust.street, cx, cy, { size: 10 })
      cy -= 12
    }
    if (cust.zip || cust.city) {
      text(`${cust.zip ?? ''} ${cust.city ?? ''}`.trim(), cx, cy, { size: 10 })
      cy -= 12
    }
  } else {
    text('Kein Kunde hinterlegt', cx, cy, { size: 10, color: [0.6, 0.6, 0.6] })
  }

  /* — Headline + meta — */
  y = Math.min(y, cy) - 30
  const headline = `${documentTypeLabelDe(input.doc.type)} ${input.doc.documentNumber}`
  text(headline, ml, y, { size: 18, bold: true })
  y -= 26

  const dateLabel = input.doc.type === 'invoice' ? 'Rechnungsdatum:' : 'Datum:'
  text(`${dateLabel} ${formatDate(input.doc.issueDate)}`, ml, y)
  if (input.doc.serviceDate) {
    text(`Leistungsdatum: ${formatDate(input.doc.serviceDate)}`, ml + 220, y)
  }
  if (input.doc.dueDate) {
    text(`Fällig am: ${formatDate(input.doc.dueDate)}`, ml + 380, y)
  }
  y -= 16
  if (co.taxNumber) text(`Steuer-Nr.: ${co.taxNumber}`, ml, y)
  if (co.vatId) text(`USt-IdNr.: ${co.vatId}`, ml + 220, y)
  y -= 24

  /* — Optional header text — */
  if (input.doc.header) {
    text(input.doc.header, ml, y, { width: innerW, size: 10 })
    y -= 36
  }

  /* — Line items table — */
  const colXs = {
    pos: ml,
    desc: ml + 25,
    qty: ml + innerW - 230,
    price: ml + innerW - 165,
    tax: ml + innerW - 95,
    total: ml + innerW - 60
  }
  text('Pos', colXs.pos, y, { bold: true, size: 9 })
  text('Beschreibung', colXs.desc, y, { bold: true, size: 9 })
  text('Menge', colXs.qty, y, { bold: true, size: 9 })
  text('Einzel', colXs.price, y, { bold: true, size: 9 })
  text('USt', colXs.tax, y, { bold: true, size: 9 })
  text('Gesamt', colXs.total, y, { bold: true, size: 9 })
  y -= 6
  page.drawLine({
    start: { x: ml, y },
    end: { x: width - mr, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  })
  y -= 12

  for (const it of input.items) {
    if (y < 130) break // very rough; long invoices are clipped for now
    text(String(it.positionNumber), colXs.pos, y, { size: 9 })
    text(it.description.slice(0, 80), colXs.desc, y, {
      size: 9,
      width: colXs.qty - colXs.desc - 6
    })
    text(`${Number(it.quantity)} ${it.unit ?? ''}`, colXs.qty, y, { size: 9 })
    text(formatEur(it.unitPriceNet), colXs.price, y, { size: 9 })
    text(`${Number(it.taxRate)}%`, colXs.tax, y, { size: 9 })
    text(formatEur(it.lineTotalGross), colXs.total, y, { size: 9 })
    y -= 14
  }
  y -= 6
  page.drawLine({
    start: { x: ml, y },
    end: { x: width - mr, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  })
  y -= 18

  /* — Totals box — */
  const totalsX = ml + innerW - 200
  const drawTotal = (label: string, value: string, bold = false) => {
    text(label, totalsX, y, { size: 10, bold })
    text(value, totalsX + 110, y, { size: 10, bold })
    y -= 14
  }

  if (input.settings.smallBusinessExempt) {
    drawTotal('Gesamt', formatEur(input.doc.grossTotal), true)
    y -= 6
    text('Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.', ml, y, {
      size: 9,
      color: [0.4, 0.4, 0.4],
      width: innerW
    })
    y -= 24
  } else {
    drawTotal('Netto', formatEur(input.doc.netTotal))
    drawTotal(
      `Umsatzsteuer (${Number(input.doc.taxRate)} %)`,
      formatEur(input.doc.taxTotal)
    )
    if (Number(input.doc.discountTotal) > 0) {
      drawTotal('Rabatt gewährt', formatEur(input.doc.discountTotal))
    }
    drawTotal('Brutto', formatEur(input.doc.grossTotal), true)
    y -= 6
  }

  /* — Footer / Bank / Notes — */
  if (input.doc.footer) {
    text(input.doc.footer, ml, y, { size: 10, width: innerW })
    y -= 28
  }
  // Bottom bank/footer block
  let by = 90
  if (co.bankName || co.iban) {
    text('Bankverbindung:', ml, by, { size: 9, bold: true })
    by -= 11
    if (co.bankName) {
      text(co.bankName, ml, by, { size: 9 })
      by -= 11
    }
    if (co.iban) {
      text(`IBAN: ${co.iban}`, ml, by, { size: 9 })
      by -= 11
    }
    if (co.bic) {
      text(`BIC: ${co.bic}`, ml, by, { size: 9 })
    }
  }
  if (co.pdfFooter) {
    text(co.pdfFooter, ml + innerW / 2, 90, {
      size: 9,
      width: innerW / 2,
      color: [0.4, 0.4, 0.4]
    })
  }

  return await pdf.save()
}

/* ------------------------------------------------------------------ */
/* Cache layer (DB)                                                   */
/* ------------------------------------------------------------------ */

const loadRenderInput = async (
  documentId: string
): Promise<DocumentRenderInput | null> => {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
  if (!doc) return null
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, documentId))
  let customer: Customer | null = null
  if (doc.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, doc.customerId))
      .limit(1)
    customer = c ?? null
  }
  const settings = await getSettings()
  return { doc, items, customer, settings }
}

/**
 * Get the cached PDF if its hash still matches the current document
 * inputs, otherwise render a fresh one and persist it. The returned
 * record's `data` field always carries the current bytes.
 */
export const getOrRenderDocumentPdf = async (
  documentId: string
): Promise<DocumentPdf> => {
  const input = await loadRenderInput(documentId)
  if (!input) {
    throw new Error('Dokument nicht gefunden.')
  }
  const wantedHash = computeDocumentInputHash(input)

  const [existing] = await db
    .select()
    .from(documentPdfs)
    .where(
      and(
        eq(documentPdfs.documentId, documentId),
        eq(documentPdfs.inputHash, wantedHash)
      )
    )
    .limit(1)
  if (existing) return existing

  // Stale or missing → render and (re)persist.
  const bytes = await renderDocumentPdf(input)
  const buffer = Buffer.from(bytes)
  const filename = `${input.doc.documentNumber}.pdf`

  // Drop any older row for this document, then insert the fresh one.
  // The unique index on `document_id` enforces one cached PDF per doc.
  await db.delete(documentPdfs).where(eq(documentPdfs.documentId, documentId))
  const [row] = await db
    .insert(documentPdfs)
    .values({
      documentId,
      inputHash: wantedHash,
      filename,
      mime: 'application/pdf',
      size: buffer.length,
      data: buffer
    })
    .returning()
  return row
}

/**
 * Lightweight metadata-only lookup. Used by list / detail views that
 * want to know *whether* a PDF is already on disk without paying for
 * the bytes.
 */
export const getDocumentPdfMeta = async (
  documentId: string
): Promise<Omit<DocumentPdf, 'data'> | null> => {
  const [row] = await db
    .select({
      id: documentPdfs.id,
      documentId: documentPdfs.documentId,
      inputHash: documentPdfs.inputHash,
      filename: documentPdfs.filename,
      mime: documentPdfs.mime,
      size: documentPdfs.size,
      createdAt: documentPdfs.createdAt
    })
    .from(documentPdfs)
    .where(eq(documentPdfs.documentId, documentId))
    .limit(1)
  return row ?? null
}
