import { query } from '$app/server'
import { db } from '$lib/server/db/client'
import { documents, customers, documentPayments } from '$lib/server/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'

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
      reminderLevel:
        overdueDays > 28 ? 3 : overdueDays > 14 ? 2 : overdueDays > 7 ? 1 : 0
    }
  })
})
