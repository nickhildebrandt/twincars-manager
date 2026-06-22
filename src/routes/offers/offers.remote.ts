import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import {
  idSchema,
  longTextSchema,
  moneySchema,
  notesSchema,
  paymentMethodSchema
} from '$lib/server/db/validation'
import {
  createDocument,
  convertOfferToInvoice,
  deleteDocument,
  getDocument,
  listDocuments,
  setDocumentStatus
} from '$lib/server/services/document-service'
import {
  and,
  count as drizzleCount,
  desc,
  eq,
  ilike,
  inArray
} from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { customers, documents, vehicles } from '$lib/server/db/schema'
import {
  sendDocumentEmail,
  type DocumentMailKind
} from '$lib/server/services/mail-service'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'
import { requirePermission } from '$lib/server/auth-guards'

const itemSchema = object({
  description: pipe(string(), trim(), maxLength(500)),
  quantity: number(),
  unit: optional(pipe(string(), trim(), maxLength(20))),
  unitPriceNet: moneySchema,
  discountPercent: optional(number()),
  taxRate: number(),
  kind: optional(pipe(string(), maxLength(20))),
  articleNumber: optional(pipe(string(), trim(), maxLength(50)))
})

const inputSchema = object({
  type: picklist(['offer', 'cost_estimate', 'order_confirmation']),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  issueDate: pipe(string(), trim(), maxLength(10)),
  dueDate: optional(pipe(string(), trim(), maxLength(10))),
  header: optional(longTextSchema),
  footer: optional(longTextSchema),
  notes: optional(notesSchema),
  items: pipe(array(itemSchema), maxLength(500))
})

/**
 * Schema for the offer→invoice conversion payload. Same shape as a
 * regular invoice creation but never carries `type` — that's always
 * `invoice` on the way in.
 */
const convertSchema = object({
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  issueDate: pipe(string(), trim(), maxLength(10)),
  serviceDate: optional(pipe(string(), trim(), maxLength(10))),
  dueDate: optional(pipe(string(), trim(), maxLength(10))),
  paymentMethod: paymentMethodSchema,
  header: optional(longTextSchema),
  footer: optional(longTextSchema),
  notes: optional(notesSchema),
  items: pipe(array(itemSchema), maxLength(500))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  subtype: optional(
    picklist(['offer', 'cost_estimate', 'order_confirmation', 'all'])
  )
})

/**
 * Paginated offer / cost-estimate / order-confirmation list.
 *
 * @group integration
 * @module offers
 */
export const listOffersRemote = query(listSchema, async (params) => {
  requirePermission('offers')
  const subtype = params.subtype ?? 'all'
  if (subtype !== 'all') {
    return listDocuments({ ...params, type: subtype })
  }
  // custom multi-type listing
  const offset = (params.page - 1) * params.size
  const ids = ['offer', 'cost_estimate', 'order_confirmation'] as const
  const filters = [inArray(documents.type, ids as unknown as string[])]
  if (params.q) {
    filters.push(ilike(documents.documentNumber, `%${params.q}%`))
  }
  const where = and(...filters)
  const items = await db
    .select()
    .from(documents)
    .where(where)
    .orderBy(desc(documents.issueDate), desc(documents.createdAt))
    .limit(params.size)
    .offset(offset)
  const [{ value }] = await db
    .select({ value: drizzleCount() })
    .from(documents)
    .where(where)
  const total = Number(value)
  return {
    items,
    total,
    page: params.page,
    size: params.size,
    pageCount: Math.max(1, Math.ceil(total / params.size))
  }
})

/**
 * Load a single offer/KV/AB.
 */
export const getOfferRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('offers')
    const result = await getDocument(id)
    if (
      !result ||
      !['offer', 'cost_estimate', 'order_confirmation'].includes(
        result.doc.type
      )
    )
      error(404, 'Dokument nicht gefunden.')
    return result
  }
)

/**
 * Create a new offer / Kostenvoranschlag / Auftragsbestätigung.
 *
 * @remarks
 * Single-flight mutation. Pass `listOffersRemote` to `.updates(...)` on the
 * client to refresh the caller's current filter/page combo in the same flight.
 *
 * @group integration
 * @module offers
 */
export const createOfferRemote = command(inputSchema, async (values) => {
  requirePermission('offers')
  if (values.items.length === 0)
    error(400, 'Bitte mindestens eine Position eingeben.')
  const created = await createDocument(values)
  await requested(listOffersRemote, 4).refreshAll()
  return created
})

/**
 * Delete an offer / Kostenvoranschlag / Auftragsbestätigung.
 *
 * @group integration
 * @module offers
 */
export const deleteOfferRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('offers')
    await deleteDocument(id)
    await requested(listOffersRemote, 4).refreshAll()
  }
)

/**
 * Convert an offer / Kostenvoranschlag into a fresh invoice. The user has
 * already (optionally) edited positions, quantities, discounts and
 * dates on the convert page; we forward the curated payload to the
 * service-layer transaction.
 *
 * On success: a new invoice exists, the source offer's status flips to
 * `converted`, and `documents.convertedToInvoiceId` links the two so
 * the offer remains in history.
 *
 * @group integration
 * @module offers
 */
export const convertOfferToInvoiceRemote = command(
  object({ offerId: idSchema, values: convertSchema }),
  async ({ offerId, values }) => {
    requirePermission('invoices')
    if (values.items.length === 0)
      error(400, 'Bitte mindestens eine Position eingeben.')
    try {
      const created = await convertOfferToInvoice(offerId, values)
      await requested(listOffersRemote, 4).refreshAll()
      return created
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)

/**
 * Cancel a Kostenvoranschlag / Angebot. Allowed only when the offer
 * is `sent` and not yet converted; otherwise the call is rejected.
 * The offer stays in history with status `cancelled` so the user can
 * see at a glance which estimates went stale.
 *
 * @group integration
 * @module offers
 */
export const cancelOfferRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('offers')
    const existing = await getDocument(id)
    if (
      !existing ||
      !['offer', 'cost_estimate', 'order_confirmation'].includes(
        existing.doc.type
      )
    ) {
      error(404, 'Dokument nicht gefunden.')
    }
    if (
      existing.doc.status === 'converted' ||
      existing.doc.convertedToInvoiceId
    ) {
      error(
        400,
        'Bereits in eine Rechnung überführte Kostenvoranschläge können nicht storniert werden.'
      )
    }
    if (existing.doc.status === 'cancelled') {
      return existing.doc
    }
    await setDocumentStatus(id, 'cancelled')
    await Promise.all([
      getOfferRemote({ id }).refresh(),
      requested(listOffersRemote, 4).refreshAll()
    ])
  }
)

/**
 * Mark a KV/Angebot/AB as sent (status flip only). Used as a
 * fallback when SMTP is not configured. The real-world send goes
 * through `sendOfferRemote`.
 *
 * @group integration
 * @module offers
 */
export const markOfferSentRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('offers')
    await setDocumentStatus(id, 'sent')
    await Promise.all([
      getOfferRemote({ id }).refresh(),
      requested(listOffersRemote, 4).refreshAll()
    ])
  }
)

/**
 * Actually send a Kostenvoranschlag / Angebot / Auftragsbestätigung
 * by e-mail. Mirrors `sendInvoiceRemote`: pulls customer, picks the
 * matching template (`offer` / `cost_estimate` / `order_confirmation`),
 * sends, records, and flips status to `sent`.
 *
 * @group integration
 * @module offers
 */
export const sendOfferRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('offers')
    const result = await getDocument(id)
    if (
      !result ||
      !['offer', 'cost_estimate', 'order_confirmation'].includes(
        result.doc.type
      )
    )
      error(404, 'Dokument nicht gefunden.')

    const doc = result.doc
    if (!doc.customerId)
      error(400, 'Dieses Dokument ist keinem Kunden zugeordnet.')
    const [cust] = await db
      .select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        company: customers.company,
        salutation: customers.salutation,
        email: customers.email
      })
      .from(customers)
      .where(eq(customers.id, doc.customerId))
      .limit(1)
    if (!cust || !cust.email)
      error(400, 'Der Kunde hat keine hinterlegte E-Mail-Adresse.')

    const [veh] = doc.vehicleId
      ? await (() => {
          const lp = latestPlateSubquery()
          return db
            .select({
              licensePlate: lp.licensePlate,
              make: vehicles.make,
              model: vehicles.model
            })
            .from(vehicles)
            .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
            .where(eq(vehicles.id, doc.vehicleId!))
            .limit(1)
        })()
      : [undefined]

    const send = await sendDocumentEmail({
      documentId: doc.id,
      documentType: doc.type as DocumentMailKind,
      to: {
        email: cust.email,
        name:
          cust.company ||
          `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim()
      },
      context: { document: doc, customer: cust, vehicle: veh }
    })
    if (!send.ok)
      error(400, `E-Mail konnte nicht versendet werden: ${send.error}`)

    await setDocumentStatus(id, 'sent')
    await Promise.all([
      getOfferRemote({ id }).refresh(),
      requested(listOffersRemote, 4).refreshAll()
    ])
    return { messageId: send.messageId }
  }
)
