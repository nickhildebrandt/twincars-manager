/**
 * Admin endpoints for the public-contact inquiry inbox.
 *
 * - `listInquiriesRemote` — paginated list with notification status,
 *   used by `/settings/inquiries`.
 * - `retryInquiryNotificationRemote` — re-runs
 *   `sendContactNotification` for the given inquiry, even when it
 *   already succeeded once. We picked "re-sends" over "no-op on
 *   sent" deliberately: if the operator clicks Retry on a `sent`
 *   row they want the workshop's inbox to get another copy, e.g.
 *   because the original was deleted. The new attempt overwrites
 *   `notification_sent_at` / `_error` on success or failure.
 *
 * @group integration
 * @module settings
 */
import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import { number, object, optional, picklist } from 'valibot'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { customerInquiries } from '$lib/server/db/schema'
import {
  recordInquiryNotificationResult,
  sendContactNotification
} from '$lib/server/services/mail-service'
import { requirePermission } from '$lib/server/auth-guards'
import { idSchema } from '$lib/server/db/validation'

const statusPicklist = picklist(['pending', 'sent', 'failed'])

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  status: optional(statusPicklist)
})

/**
 * Paginated list of public-contact inquiries with their notification
 * delivery status. Ordered newest-first; the operator usually wants
 * to spot freshly failed sends.
 */
export const listInquiriesRemote = query(listSchema, async (params) => {
  requirePermission('mailings')
  const offset = (params.page - 1) * params.size
  const filters = []
  if (params.status) {
    filters.push(eq(customerInquiries.notificationStatus, params.status))
  }
  const where = filters.length ? and(...filters) : undefined
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(customerInquiries)
      .where(where)
      .orderBy(desc(customerInquiries.createdAt))
      .limit(params.size)
      .offset(offset),
    db.select({ value: count() }).from(customerInquiries).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items,
    total,
    page: params.page,
    size: params.size,
    pageCount: Math.max(1, Math.ceil(total / params.size))
  }
})

/**
 * Re-run the notification mail for a single inquiry. Always attempts
 * a fresh send — `sent` rows get re-sent, `failed` rows get retried,
 * `pending` rows finish what the original submission started.
 * The audit trail in `sent_messages` records each attempt
 * independently.
 */
export const retryInquiryNotificationRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('mailings')
    const [row] = await db
      .select()
      .from(customerInquiries)
      .where(eq(customerInquiries.id, id))
      .limit(1)
    if (!row) error(404, 'Anfrage nicht gefunden.')

    const refType = row.referenceType as
      | 'used-car'
      | 'article'
      | 'tire'
      | 'general'
      | null

    const result = await sendContactNotification({
      inquiryId: row.id,
      customerEmail: row.customerEmail,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      subject: row.subject,
      message: row.message,
      referenceType: refType,
      referenceId: row.referenceId
    })
    await recordInquiryNotificationResult(row.id, result)
    await requested(listInquiriesRemote, 4).refreshAll()
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, error: result.error }
  }
)
