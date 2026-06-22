import { query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  object,
  optional,
  picklist,
  pipe,
  string,
  trim,
  maxLength,
  number
} from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { sentMessages } from '$lib/server/db/schema'
import { count, desc, gte, ilike, lte, or, and, eq } from 'drizzle-orm'
import { requireAnyPermission } from '$lib/server/auth-guards'

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  type: optional(pipe(string(), trim(), maxLength(30))),
  from: optional(pipe(string(), trim(), maxLength(10))),
  to: optional(pipe(string(), trim(), maxLength(10)))
})

/**
 * Paginated list of all messages sent through the app.
 *
 * @group integration
 * @module sent
 */
export const listSentRemote = query(listSchema, async (params) => {
  requireAnyPermission('invoices', 'offers', 'reminders')
  const offset = (params.page - 1) * params.size
  const filters = []
  if (params.q) {
    const term = `%${params.q}%`
    filters.push(
      or(
        ilike(sentMessages.recipientEmail, term),
        ilike(sentMessages.subject, term),
        ilike(sentMessages.recipientName, term)
      )
    )
  }
  if (params.type && params.type !== 'all') {
    filters.push(eq(sentMessages.documentType, params.type))
  }
  if (params.from) {
    filters.push(gte(sentMessages.sentAt, new Date(`${params.from}T00:00:00Z`)))
  }
  if (params.to) {
    filters.push(lte(sentMessages.sentAt, new Date(`${params.to}T23:59:59Z`)))
  }
  const where = filters.length ? and(...filters) : undefined
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(sentMessages)
      .where(where)
      .orderBy(desc(sentMessages.sentAt))
      .limit(params.size)
      .offset(offset),
    db.select({ value: count() }).from(sentMessages).where(where)
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
 * Einzelne gesendete Nachricht — Body und Metadaten. Das angehängte
 * PDF lädt der `PdfViewer` selbst über `getDocumentPdfBytesRemote` /
 * `getReminderPdfBytesRemote`; hier wird nur der zu nutzende Cache
 * (`document` / `reminder`) signalisiert.
 *
 * @group integration
 * @module sent
 */
export const getSentMessageRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requireAnyPermission('invoices', 'offers', 'reminders')
    const [row] = await db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.id, id))
      .limit(1)
    if (!row) error(404, 'Gesendete Nachricht nicht gefunden.')

    const pdfKind: 'document' | 'reminder' | null =
      row.documentId == null
        ? null
        : row.documentType.startsWith('reminder')
          ? 'reminder'
          : 'document'
    return { ...row, pdfKind }
  }
)
