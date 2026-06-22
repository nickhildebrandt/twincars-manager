import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { documents, customers, documentPayments } from '$lib/server/db/schema'
import { and, asc, eq, max, ne, sum } from 'drizzle-orm'
import { reminders as remindersTable } from '$lib/server/db/schema'
import {
  autoSendDuePaymentReminders,
  getReminderById,
  listOpenReminders,
  listRemindersForInvoice,
  sendPaymentReminder
} from '$lib/server/services/reminder-service'
import { requirePermission } from '$lib/server/auth-guards'

/**
 * Open invoices (everything not paid/cancelled), enriched with the
 * count of reminders already sent and the date of the most recent one
 * so the operator can decide at a glance whether another reminder is
 * due.
 *
 * @group integration
 * @module reminders
 */
export const listOpenInvoicesRemote = query(async () => {
  requirePermission('reminders')
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

  // Latest reminder issue-date per invoice, joined onto the row so the
  // list can render "Letzte Erinnerung am …" without an N+1 query.
  const lr = db
    .select({
      invoiceId: remindersTable.invoiceId,
      lastReminderDate: max(remindersTable.issueDate).as('last_reminder_date')
    })
    .from(remindersTable)
    .groupBy(remindersTable.invoiceId)
    .as('last_reminder')

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
      totalPaid: pt.total,
      lastReminderDate: lr.lastReminderDate
    })
    .from(documents)
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .leftJoin(pt, eq(pt.documentId, documents.id))
    .leftJoin(lr, eq(lr.invoiceId, documents.id))
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
      /** Number of reminders already sent for this invoice (0 = none). */
      reminderCount: r.reminderLevel,
      /** Date the most recent reminder was sent, if any. */
      lastReminderDate: r.lastReminderDate as string | null
    }
  })
})

/**
 * List all currently open Zahlungserinnerungen across the company.
 *
 * @group integration
 * @module reminders
 */
export const listRemindersRemote = query(async () => {
  requirePermission('reminders')
  const rows = await listOpenReminders()
  return rows.map((r) => ({ ...r, grossTotal: Number(r.grossTotal) }))
})

/**
 * Single Zahlungserinnerung detail (joined with invoice + customer).
 *
 * @group integration
 * @module reminders
 */
export const getReminderRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('reminders')
    const row = await getReminderById(id)
    if (!row) error(404, 'Zahlungserinnerung nicht gefunden.')
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
      status: row.reminder.status,
      notes: row.reminder.notes,
      customerName: row.customerName,
      customerCity: row.customerCity
    }
  }
)

/**
 * All Zahlungserinnerungen attached to a given invoice (oldest first).
 *
 * @group integration
 * @module reminders
 */
export const listRemindersForInvoiceRemote = query(
  object({ invoiceId: idSchema }),
  async ({ invoiceId }) => {
    requirePermission('reminders')
    const rows = await listRemindersForInvoice(invoiceId)
    return rows.map((r) => ({
      id: r.id,
      documentNumber: r.documentNumber,
      level: r.level,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      status: r.status
    }))
  }
)

/**
 * Send the (next) payment reminder for an invoice. Always inserts a
 * new row — there is no escalation, the same friendly template goes
 * out every time. Counter on `documents.reminderLevel` is incremented
 * by one per call.
 *
 * @group integration
 * @module reminders
 */
export const createPaymentReminderRemote = command(
  object({ invoiceId: idSchema }),
  async ({ invoiceId }) => {
    requirePermission('reminders')
    try {
      const created = await sendPaymentReminder(invoiceId)
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

/**
 * @deprecated Use {@link createPaymentReminderRemote}. Thin alias for
 * older callers that still reference the pre-refactor name.
 */
export const createReminderRemote = createPaymentReminderRemote

/**
 * Trigger the recurring auto-send batch on demand. Returns the number
 * of reminders that were created and the number that failed. Intended
 * for the operator's "Jetzt prüfen" action; a periodic scheduler can
 * be wired up in a follow-up.
 *
 * @group integration
 * @module reminders
 */
export const autoSendDuePaymentRemindersRemote = command(async () => {
  requirePermission('reminders')
  const result = await autoSendDuePaymentReminders()
  await Promise.all([
    requested(listOpenInvoicesRemote, 4).refreshAll(),
    requested(listRemindersRemote, 4).refreshAll()
  ])
  return result
})
