import { query } from '$app/server'
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
import { db } from '$lib/server/db/client'
import { sentMessages } from '$lib/server/db/schema'
import { count, desc, ilike, or, and, eq } from 'drizzle-orm'

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  type: optional(pipe(string(), trim(), maxLength(30)))
})

/**
 * Paginated list of all messages sent through the app.
 *
 * @group integration
 * @module sent
 */
export const listSentRemote = query(listSchema, async (params) => {
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
