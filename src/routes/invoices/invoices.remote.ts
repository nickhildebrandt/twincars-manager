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
  notesSchema
} from '$lib/server/db/validation'
import {
  cancelInvoice,
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  setDocumentStatus
} from '$lib/server/services/document-service'
import { sendDocumentEmail } from '$lib/server/services/mail-service'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'
import { db } from '$lib/server/db/client'
import { customers, documents, vehicles } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
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
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  issueDate: pipe(string(), trim(), maxLength(10)),
  serviceDate: optional(pipe(string(), trim(), maxLength(10))),
  dueDate: optional(pipe(string(), trim(), maxLength(10))),
  paymentMethod: optional(pipe(string(), trim(), maxLength(30))),
  header: optional(longTextSchema),
  footer: optional(longTextSchema),
  notes: optional(notesSchema),
  items: pipe(array(itemSchema), maxLength(500))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  status: optional(pipe(string(), trim(), maxLength(20)))
})

/**
 * Paginated invoice list.
 *
 * @group integration
 * @module invoices
 */
export const listInvoicesRemote = query(listSchema, async (params) => {
  requirePermission('invoices')
  return listDocuments({ ...params, type: 'invoice' })
})

/**
 * Load a single invoice with line items.
 *
 * @group integration
 * @module invoices
 */
export const getInvoiceRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('invoices')
    const result = await getDocument(id)
    if (!result || result.doc.type !== 'invoice')
      error(404, 'Rechnung nicht gefunden.')

    // Verknüpfte Stammdaten in einem Aufruf — Kunde + Fahrzeug, falls
    // gesetzt. Beide Lookups sind klein und parallelisierbar; das
    // Detail-Page rendert sie als eigene Karten.
    const [cust] = result.doc.customerId
      ? await db
          .select({
            id: customers.id,
            customerNumber: customers.customerNumber,
            firstName: customers.firstName,
            lastName: customers.lastName,
            company: customers.company,
            phone: customers.phone,
            email: customers.email
          })
          .from(customers)
          .where(eq(customers.id, result.doc.customerId))
          .limit(1)
      : [null]
    const [veh] = result.doc.vehicleId
      ? await (() => {
          const lp = latestPlateSubquery()
          return db
            .select({
              id: vehicles.id,
              licensePlate: lp.licensePlate,
              vin: vehicles.vin,
              make: vehicles.make,
              model: vehicles.model,
              firstRegistration: vehicles.firstRegistration,
              mileageKm: vehicles.mileageKm
            })
            .from(vehicles)
            .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
            .where(eq(vehicles.id, result.doc.vehicleId!))
            .limit(1)
        })()
      : [null]

    // Storno-Verkettung auflösen: Banner auf der Original-Rechnung
    // braucht die Storno-Belegnummer, Banner auf dem Storno die
    // Original-Belegnummer. Ein einziger Lookup pro Richtung.
    const [stornoDoc] = result.doc.cancelledByDocumentId
      ? await db
          .select({
            id: documents.id,
            documentNumber: documents.documentNumber
          })
          .from(documents)
          .where(eq(documents.id, result.doc.cancelledByDocumentId))
          .limit(1)
      : [null]
    const [originalDoc] = result.doc.cancelsDocumentId
      ? await db
          .select({
            id: documents.id,
            documentNumber: documents.documentNumber
          })
          .from(documents)
          .where(eq(documents.id, result.doc.cancelsDocumentId))
          .limit(1)
      : [null]

    return {
      ...result,
      customer: cust ?? null,
      vehicle: veh ?? null,
      stornoDoc: stornoDoc ?? null,
      originalDoc: originalDoc ?? null
    }
  }
)

/**
 * Create a new invoice with positions.
 *
 * @remarks
 * Single-flight mutation. Pass `listInvoicesRemote` to `.updates(...)` on the
 * client to refresh the current view in the same flight.
 *
 * @group integration
 * @module invoices
 */
export const createInvoiceRemote = command(inputSchema, async (values) => {
  requirePermission('invoices')
  if (values.items.length === 0)
    error(400, 'Bitte mindestens eine Position eingeben.')
  const created = await createDocument({ type: 'invoice', ...values })
  await requested(listInvoicesRemote, 4).refreshAll()
  return created
})

/**
 * Update the lifecycle status of an invoice.
 *
 * Valid transitions:
 *   created → sent → paid
 *                 ↘ cancelled (on stornieren — rare; usually a
 *                              Zahlungserinnerung path is preferred)
 *
 * Zahlungserinnerungen werden separat über `documents.reminderLevel`
 * und das Zahlungserinnerungs-Modul nachverfolgt — sie ändern den
 * Status hier nicht.
 *
 * @group integration
 * @module invoices
 */
export const setInvoiceStatusRemote = command(
  object({
    id: idSchema,
    status: picklist(['created', 'sent', 'paid', 'cancelled'])
  }),
  async ({ id, status }) => {
    requirePermission('invoices')
    await setDocumentStatus(id, status)
    if (status === 'paid') {
      await transferStockVehicleOnPayment(id)
    }
    await Promise.all([
      getInvoiceRemote({ id }).refresh(),
      requested(listInvoicesRemote, 4).refreshAll()
    ])
  }
)

/**
 * Final-Übergang Lager → Kunde, ausgelöst beim Bezahlen einer
 * Verkaufs-Rechnung.
 *
 * Wenn die Rechnung
 *   - ein verknüpftes Fahrzeug (`vehicleId`) und
 *   - einen verknüpften Kunden (`customerId`) trägt **und**
 *   - das Fahrzeug aktuell `customer_id IS NULL` (=Lager) ist,
 * dann wird das Fahrzeug auf den Rechnungs-Kunden umgeschrieben.
 * Damit wandert es aus „Zu verkaufende Fahrzeuge" in „Fahrzeuge"
 * — aber **erst nach Zahlungseingang**, nicht schon beim Anlegen
 * der Rechnung.
 *
 * Idempotent: ein zweiter Aufruf macht nichts mehr, weil
 * `customer_id` dann nicht mehr NULL ist.
 */
async function transferStockVehicleOnPayment(invoiceId: string): Promise<void> {
  const result = await getDocument(invoiceId)
  if (!result || result.doc.type !== 'invoice') return
  const { vehicleId, customerId } = result.doc
  if (!vehicleId || !customerId) return

  const [veh] = await db
    .select({ id: vehicles.id, customerId: vehicles.customerId })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1)
  if (!veh || veh.customerId !== null) return

  await db
    .update(vehicles)
    .set({ customerId, updatedAt: new Date() })
    .where(eq(vehicles.id, vehicleId))
}

/**
 * Mark an invoice as sent. Same plumbing as setInvoiceStatusRemote
 * but a dedicated transition for the lifecycle CTA. Used as a
 * fallback when SMTP is not configured (or by tests). Real-world
 * users go through `sendInvoiceRemote`.
 *
 * @group integration
 * @module invoices
 */
export const markInvoiceSentRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('invoices')
    await setDocumentStatus(id, 'sent')
    await Promise.all([
      getInvoiceRemote({ id }).refresh(),
      requested(listInvoicesRemote, 4).refreshAll()
    ])
  }
)

/**
 * Actually send the invoice by e-mail through SMTP. Pulls the
 * customer's address book entry, renders the `invoice` template, and
 * hands the rendered subject/body to nodemailer. On success the
 * status flips to `sent` and a row lands in `sent_messages`. On
 * failure the user gets a curated German error and the row is
 * recorded with status `failed` so the issue stays visible.
 *
 * @group integration
 * @module invoices
 */
export const sendInvoiceRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('invoices')
    const result = await getDocument(id)
    if (!result || result.doc.type !== 'invoice')
      error(404, 'Rechnung nicht gefunden.')

    const doc = result.doc
    if (!doc.customerId)
      error(400, 'Diese Rechnung ist keinem Kunden zugeordnet.')
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
      documentType: 'invoice',
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
      getInvoiceRemote({ id }).refresh(),
      requested(listInvoicesRemote, 4).refreshAll()
    ])
    return { messageId: send.messageId }
  }
)

/**
 * Delete an invoice.
 *
 * GoBD: ausgestellte Rechnungen können nicht gelöscht werden — der
 * Service wirft in dem Fall 409 mit der kuratierten Meldung, die der
 * Aufrufer per `handleClientError` als Toast anzeigt.
 *
 * @group integration
 * @module invoices
 */
export const deleteInvoiceRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('invoices')
    await deleteDocument(id)
    await requested(listInvoicesRemote, 4).refreshAll()
  }
)

/**
 * Storno-Rechnung anlegen (GoBD § 14 UStG, §§ 145 ff. AO).
 *
 * Erzeugt einen neuen `documents`-Row mit `status='storno'`, negiert
 * alle Beträge des Originals und verkettet beide Belege über
 * `cancelsDocumentId` ↔ `cancelledByDocumentId`. Das Original behält
 * seine Nummer, wird auf `status='cancelled'` gesetzt und trägt
 * `cancelledAt`/`cancellationReason`.
 *
 * @group integration
 * @module invoices
 */
export const cancelInvoiceRemote = command(
  object({
    id: idSchema,
    reason: pipe(
      string('Bitte einen Stornogrund angeben.'),
      trim(),
      maxLength(500, 'Der Stornogrund darf maximal 500 Zeichen lang sein.')
    )
  }),
  async ({ id, reason }) => {
    requirePermission('invoices')
    if (reason.length === 0) error(400, 'Bitte einen Stornogrund angeben.')
    const result = await cancelInvoice(id, reason)
    await Promise.all([
      getInvoiceRemote({ id }).refresh(),
      requested(listInvoicesRemote, 4).refreshAll()
    ])
    return result
  }
)
