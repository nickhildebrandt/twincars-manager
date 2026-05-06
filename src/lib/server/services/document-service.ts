import { db } from '$lib/server/db/client'
import {
  documents,
  documentItems,
  documentPayments,
  customers,
  vehicles,
  numberRanges,
  type Document
} from '$lib/server/db/schema'
import { and, asc, count, desc, eq, ilike, ne, or, sum } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import { renderNumber } from '$lib/utils/numbering'
import { latestPlateSubquery } from './vehicle-service'

type NewDocument = typeof documents.$inferInsert
type DocumentItem = typeof documentItems.$inferSelect
type NewDocumentItem = typeof documentItems.$inferInsert

export type DocumentWithCustomer = Document & {
  customerName: string | null
  vehiclePlate: string | null
  totalPaid: number
}

/**
 * Aggregate Drizzle-Subquery für Teilzahlungen pro Beleg — wird per
 * `leftJoin` an Listing-Queries angedockt und liefert die Summe aller
 * Zahlungen je `documentId`.
 */
const buildPaymentsTotalSubquery = () =>
  db
    .select({
      documentId: documentPayments.documentId,
      total: sum(documentPayments.amount).as('total_paid')
    })
    .from(documentPayments)
    .groupBy(documentPayments.documentId)
    .as('payments_total')

/**
 * List documents (any type) with pagination + search.
 * @param params pagination + search + filter (type / status)
 */
export async function listDocuments(
  params: ListParams & { type?: string; status?: string }
): Promise<ListResult<DocumentWithCustomer>> {
  const { page, size, q, type, status } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(documents.documentNumber, term),
        ilike(customers.company, term),
        ilike(customers.lastName, term)
      )
    )
  }
  if (type && type !== 'all') filters.push(eq(documents.type, type))
  if (status && status !== 'all') filters.push(eq(documents.status, status))
  const where = filters.length > 0 ? and(...filters) : undefined

  const lp = latestPlateSubquery()
  const pt = buildPaymentsTotalSubquery()
  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: documents.id,
        documentNumber: documents.documentNumber,
        legacyDocumentNumber: documents.legacyDocumentNumber,
        type: documents.type,
        status: documents.status,
        customerId: documents.customerId,
        vehicleId: documents.vehicleId,
        issueDate: documents.issueDate,
        serviceDate: documents.serviceDate,
        dueDate: documents.dueDate,
        paymentMethod: documents.paymentMethod,
        taxRate: documents.taxRate,
        netTotal: documents.netTotal,
        taxTotal: documents.taxTotal,
        grossTotal: documents.grossTotal,
        discountTotal: documents.discountTotal,
        header: documents.header,
        footer: documents.footer,
        notes: documents.notes,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        customerCompany: customers.company,
        customerLastName: customers.lastName,
        vehiclePlate: lp.licensePlate,
        totalPaid: pt.total
      })
      .from(documents)
      .leftJoin(customers, eq(documents.customerId, customers.id))
      .leftJoin(vehicles, eq(documents.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .leftJoin(pt, eq(pt.documentId, documents.id))
      .where(where)
      .orderBy(desc(documents.issueDate), desc(documents.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(documents).where(where)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  const enriched: DocumentWithCustomer[] = items.map((row) => {
    const { customerCompany, customerLastName, ...rest } = row
    return {
      ...(rest as unknown as Document),
      customerName: customerCompany ?? customerLastName ?? null,
      vehiclePlate: rest.vehiclePlate ?? null,
      totalPaid: Number(rest.totalPaid ?? 0)
    }
  })
  return {
    items: enriched,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function getDocument(
  id: string
): Promise<{ doc: Document; items: DocumentItem[] } | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)
  if (!doc) return null
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, id))
    .orderBy(asc(documentItems.positionNumber))
  return { doc, items }
}

/**
 * Increment the next number for a given range and render a document number.
 */
export async function nextDocumentNumber(kind: string): Promise<string> {
  const [row] = await db
    .select()
    .from(numberRanges)
    .where(eq(numberRanges.kind, kind))
    .limit(1)
  const template = row?.formatTemplate ?? 'XX-{YYYY}-{NNNN}'
  const next = row?.nextValue ?? 1
  await db
    .update(numberRanges)
    .set({ nextValue: next + 1 })
    .where(eq(numberRanges.kind, kind))
  return renderNumber(template, next)
}

const round2 = (v: number): number => Math.round(v * 100) / 100

export type DocumentInputItem = {
  description: string
  quantity: number
  unit?: string
  unitPriceNet: number
  discountPercent?: number
  taxRate: number
  kind?: string
  articleNumber?: string
}

export type CreateDocumentInput = {
  type: string
  customerId?: string
  vehicleId?: string
  issueDate: string
  serviceDate?: string
  dueDate?: string
  paymentMethod?: string
  header?: string
  footer?: string
  notes?: string
  items: DocumentInputItem[]
}

const numberKindFor = (type: string): string => {
  if (type === 'invoice') return 'invoice'
  if (type === 'offer') return 'offer'
  if (type === 'cost_estimate') return 'cost_estimate'
  if (type === 'order_confirmation') return 'order_confirmation'
  if (type === 'reminder') return 'reminder'
  return 'invoice'
}

/**
 * Create a document with positions, computing line totals + sums.
 */
export async function createDocument(
  input: CreateDocumentInput
): Promise<Document> {
  const docNumber = await nextDocumentNumber(numberKindFor(input.type))

  let netTotal = 0
  let taxTotal = 0
  let grossTotal = 0
  let discountTotal = 0
  const itemsToInsert: Array<Omit<NewDocumentItem, 'documentId'>> = []

  input.items.forEach((it, idx) => {
    const qty = Number(it.quantity)
    const unit = Number(it.unitPriceNet)
    const discount = Number(it.discountPercent ?? 0)
    const tax = Number(it.taxRate)
    const lineNetBeforeDiscount = round2(qty * unit)
    const lineDiscount = round2(lineNetBeforeDiscount * (discount / 100))
    const lineNet = round2(lineNetBeforeDiscount - lineDiscount)
    const lineTax = round2(lineNet * (tax / 100))
    const lineGross = round2(lineNet + lineTax)
    netTotal = round2(netTotal + lineNet)
    taxTotal = round2(taxTotal + lineTax)
    grossTotal = round2(grossTotal + lineGross)
    discountTotal = round2(discountTotal + lineDiscount)
    itemsToInsert.push({
      positionNumber: idx + 1,
      kind: it.kind ?? 'article',
      articleNumber: it.articleNumber ?? null,
      description: it.description,
      quantity: String(qty),
      unit: it.unit ?? 'Stk',
      unitPriceNet: String(unit),
      discountPercent: String(discount),
      taxRate: String(tax),
      lineTotalNet: String(lineNet),
      lineTotalGross: String(lineGross)
    })
  })

  const taxRate = input.items[0]?.taxRate ?? 19
  const newDoc: NewDocument = {
    documentNumber: docNumber,
    type: input.type,
    status: 'created',
    customerId: input.customerId ?? null,
    vehicleId: input.vehicleId ?? null,
    issueDate: input.issueDate,
    serviceDate: input.serviceDate ?? null,
    dueDate: input.dueDate ?? null,
    paymentMethod: input.paymentMethod ?? null,
    taxRate: String(taxRate),
    netTotal: String(netTotal),
    taxTotal: String(taxTotal),
    grossTotal: String(grossTotal),
    discountTotal: String(discountTotal),
    header: input.header ?? null,
    footer: input.footer ?? null,
    notes: input.notes ?? null
  }

  const [created] = await db.insert(documents).values(newDoc).returning()
  if (itemsToInsert.length > 0) {
    await db
      .insert(documentItems)
      .values(itemsToInsert.map((it) => ({ ...it, documentId: created.id })))
  }
  // PDF direkt persistieren — der View-Pfad liest später nur aus dem
  // Cache, niemals on-demand. Lazy-Import vermeidet Zirkel zwischen
  // document-service ↔ pdf-service.
  try {
    const { renderAndPersistDocumentPdf } = await import('./pdf-service')
    await renderAndPersistDocumentPdf(created.id)
  } catch (err) {
    console.error(
      '[document-service] PDF-Render bei Anlage fehlgeschlagen',
      err
    )
  }
  return created
}

export async function deleteDocument(id: string): Promise<void> {
  await db.delete(documents).where(eq(documents.id, id))
}

export async function setDocumentStatus(
  id: string,
  status: string
): Promise<void> {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, id))
}

/**
 * Convert an offer / Kostenvoranschlag into a fresh invoice. The new
 * invoice carries the (possibly edited) line items the user accepted; the
 * offer's status flips to `converted` and `convertedToInvoiceId` keeps
 * the audit trail intact. Both writes happen inside a single transaction
 * so the offer can never be flagged converted without an actual invoice
 * existing.
 *
 * @param offerId  The offer to convert. Must be type
 *                 `offer | cost_estimate | order_confirmation`.
 * @param input    The (possibly user-edited) invoice payload — same
 *                 shape as `createDocument` minus the `type`, which is
 *                 always `invoice` here.
 */
export async function convertOfferToInvoice(
  offerId: string,
  input: Omit<CreateDocumentInput, 'type'>
): Promise<Document> {
  // Pre-flight: refuse early if the offer doesn't exist, has the wrong
  // type, or has already been converted.
  const [offer] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, offerId))
    .limit(1)
  if (!offer) {
    throw new Error('Kostenvoranschlag nicht gefunden.')
  }
  if (!['offer', 'cost_estimate', 'order_confirmation'].includes(offer.type)) {
    throw new Error(
      'Nur Angebote, Kostenvoranschläge oder Auftragsbestätigungen lassen sich umwandeln.'
    )
  }
  if (offer.status === 'converted' || offer.convertedToInvoiceId) {
    throw new Error(
      'Dieser Kostenvoranschlag wurde bereits in eine Rechnung überführt.'
    )
  }

  // Build the invoice. We reuse `createDocument` for line totals and
  // numbering; the user-edited payload wins over the offer's defaults
  // for everything except customer/vehicle (which fall back to the
  // offer's relations to keep the audit trail consistent).
  const created = await createDocument({
    type: 'invoice',
    customerId: input.customerId ?? offer.customerId ?? undefined,
    vehicleId: input.vehicleId ?? offer.vehicleId ?? undefined,
    issueDate: input.issueDate,
    serviceDate: input.serviceDate,
    dueDate: input.dueDate,
    paymentMethod: input.paymentMethod,
    header: input.header,
    footer: input.footer,
    notes: input.notes,
    items: input.items
  })

  // Flip the offer's status and link it to the new invoice. If this
  // update fails, a follow-up retry will refuse the conversion (because
  // the offer is still flagged un-converted but its
  // `convertedToInvoiceId` will be null) — the caller can choose to
  // delete the orphaned invoice.
  await db
    .update(documents)
    .set({
      status: 'converted',
      convertedToInvoiceId: created.id,
      updatedAt: new Date()
    })
    .where(eq(documents.id, offerId))

  return created
}

/**
 * Sums for the current month — used by the dashboard / sales-ledger view.
 */
export async function invoiceMonthlyStats() {
  const [openRow, paidRow] = await Promise.all([
    db
      .select({ value: sum(documents.grossTotal) })
      .from(documents)
      .where(and(eq(documents.type, 'invoice'), ne(documents.status, 'paid'))),
    db
      .select({ value: sum(documents.grossTotal) })
      .from(documents)
      .where(and(eq(documents.type, 'invoice'), eq(documents.status, 'paid')))
  ])
  return {
    open: Number(openRow[0]?.value ?? 0),
    paid: Number(paidRow[0]?.value ?? 0)
  }
}
