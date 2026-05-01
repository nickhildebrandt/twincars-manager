import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import { number, object, optional, picklist } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { documents, customers, documentPayments } from '$lib/server/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import {
  createReminderForInvoice,
  listOpenReminders
} from '$lib/server/services/reminder-service'

/**
 * Open invoices (everything not paid/cancelled).
 *
 * @group integration
 * @module reminders
 */
export const listOpenInvoicesRemote = query(async () => {
  const rows = await db
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      issueDate: documents.issueDate,
      dueDate: documents.dueDate,
      grossTotal: documents.grossTotal,
      status: documents.status,
      reminderLevel: documents.reminderLevel,
      customerName: sql<
        string | null
      >`COALESCE(${customers.company}, ${customers.lastName})`.as(
        'customer_name'
      ),
      totalPaid: sql<string>`COALESCE((
				SELECT SUM(amount) FROM ${documentPayments}
				WHERE ${documentPayments.documentId} = ${documents.id}
			), 0)`.as('total_paid')
    })
    .from(documents)
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .where(
      and(
        eq(documents.type, 'invoice'),
        ne(documents.status, 'paid'),
        ne(documents.status, 'cancelled')
      )
    )
    .orderBy(
      sql`${documents.dueDate} ASC NULLS LAST, ${documents.issueDate} ASC`
    )

  const today = new Date().toISOString().slice(0, 10)
  return rows.map((r) => {
    const overdueDays =
      r.dueDate && r.dueDate < today
        ? Math.floor(
            (new Date(today).getTime() - new Date(r.dueDate).getTime()) /
              86400000
          )
        : 0
    const open = Number(r.grossTotal) - Number(r.totalPaid)
    return {
      id: r.id,
      documentNumber: r.documentNumber,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      customerName: r.customerName,
      grossTotal: Number(r.grossTotal),
      totalPaid: Number(r.totalPaid),
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
