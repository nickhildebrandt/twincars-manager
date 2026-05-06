import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import { number, object, optional, picklist } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { documents, customers, documentPayments } from '$lib/server/db/schema'
import { and, asc, eq, ne, sum } from 'drizzle-orm'
import {
  createReminderForInvoice,
  getReminderById,
  listOpenReminders,
  listRemindersForInvoice
} from '$lib/server/services/reminder-service'

/**
 * Open invoices (everything not paid/cancelled).
 *
 * @group integration
 * @module reminders
 */
export const listOpenInvoicesRemote = query(async () => {
  // Aggregierte Teilzahlungen pro Beleg als eigene Drizzle-Subquery —
  // ohne handgeschriebene Korrelations-Subquery.
  const pt = db
    .select({
      documentId: documentPayments.documentId,
      total: sum(documentPayments.amount).as('total_paid')
    })
    .from(documentPayments)
    .groupBy(documentPayments.documentId)
    .as('payments_total')

  const rows = await db
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      issueDate: documents.issueDate,
      dueDate: documents.dueDate,
      grossTotal: documents.grossTotal,
      status: documents.status,
      reminderLevel: documents.reminderLevel,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      totalPaid: pt.total
    })
    .from(documents)
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .leftJoin(pt, eq(pt.documentId, documents.id))
    .where(
      and(
        eq(documents.type, 'invoice'),
        ne(documents.status, 'paid'),
        ne(documents.status, 'cancelled')
      )
    )
    // Postgres' `ORDER BY ... ASC` legt NULL-Werte standardmäßig ans
    // Ende — exakt was wir wollen, ohne extra NULLS-LAST-Modifier.
    .orderBy(asc(documents.dueDate), asc(documents.issueDate))

  const today = new Date().toISOString().slice(0, 10)
  return rows.map((r) => {
    const overdueDays =
      r.dueDate && r.dueDate < today
        ? Math.floor(
            (new Date(today).getTime() - new Date(r.dueDate).getTime()) /
              86400000
          )
        : 0
    const open = Number(r.grossTotal) - Number(r.totalPaid ?? 0)
    return {
      id: r.id,
      documentNumber: r.documentNumber,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      customerName: r.customerCompany ?? r.customerLastName ?? null,
      grossTotal: Number(r.grossTotal),
      totalPaid: Number(r.totalPaid ?? 0),
      openAmount: open,
      status: r.status,
      overdueDays,
      // The persistent level on the invoice. Drives the "next allowed
      // reminder" button in the UI.
      reminderLevel: r.reminderLevel
    }
  })
})

/**
 * List all currently open reminders across the company.
 *
 * @group integration
 * @module reminders
 */
export const listRemindersRemote = query(async () => {
  const rows = await listOpenReminders()
  return rows.map((r) => ({
    ...r,
    fee: Number(r.fee),
    interest: Number(r.interest),
    grossTotal: Number(r.grossTotal)
  }))
})

/**
 * Create the next reminder for an invoice. Refuses to skip levels or to
 * duplicate an existing level — the service layer enforces that.
 *
 * @group integration
 * @module reminders
 */
/**
 * Single reminder detail (joined with invoice + customer).
 *
 * @group integration
 * @module reminders
 */
export const getReminderRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await getReminderById(id)
    if (!row) error(404, 'Mahnung nicht gefunden')
    return {
      id: row.reminder.id,
      documentNumber: row.reminder.documentNumber,
      invoiceId: row.reminder.invoiceId,
      invoiceNumber: row.invoiceNumber,
      invoiceGross: Number(row.invoiceGross),
      invoiceDueDate: row.invoiceDueDate,
      level: row.reminder.level,
      issueDate: row.reminder.issueDate,
      dueDate: row.reminder.dueDate,
      fee: Number(row.reminder.fee),
      interest: Number(row.reminder.interest),
      status: row.reminder.status,
      notes: row.reminder.notes,
      customerName: row.customerName,
      customerCity: row.customerCity
    }
  }
)

/**
 * All reminders attached to a given invoice (oldest level first).
 *
 * @group integration
 * @module reminders
 */
export const listRemindersForInvoiceRemote = query(
  object({ invoiceId: idSchema }),
  async ({ invoiceId }) => {
    const rows = await listRemindersForInvoice(invoiceId)
    return rows.map((r) => ({
      id: r.id,
      documentNumber: r.documentNumber,
      level: r.level,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      fee: Number(r.fee),
      interest: Number(r.interest),
      status: r.status
    }))
  }
)

export const createReminderRemote = command(
  object({
    invoiceId: idSchema,
    level: optional(picklist([1, 2, 3, 4])),
    fee: optional(number())
  }),
  async (input) => {
    try {
      const created = await createReminderForInvoice({
        invoiceId: input.invoiceId,
        level: input.level,
        fee: input.fee
      })
      await Promise.all([
        requested(listOpenInvoicesRemote, 4).refreshAll(),
        requested(listRemindersRemote, 4).refreshAll()
      ])
      return created
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)
