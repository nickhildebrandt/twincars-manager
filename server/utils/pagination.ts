/**
 * Turns a validated list query into `ORDER BY`, `LIMIT` and `OFFSET`.
 *
 * Every list in the application paginates on the server, 25 rows per page,
 * with no size selector (../../docs/rewrite/04-ux.md §3.4). The predecessor
 * carried a `clampPagination` helper that allowed 10, 50 and 100 and was dead
 * code besides (B-026); there is no such thing here.
 *
 * Sorting goes through a **whitelist**. A sort column arrives as a string from
 * the query, and a string from the query must never reach SQL unchecked.
 */
import { asc, desc } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { PAGE_SIZE, offsetFor } from '#shared/schemas/pagination'
import type { ListQuery } from '#shared/schemas/pagination'

export type SortMap = Record<string, PgColumn>

export type Slice = {
  limit: number
  offset: number
  orderBy: ReturnType<typeof asc>[]
}

/**
 * Builds the slice for one page.
 *
 * `columns` maps the names a client may sort by onto real columns. An unknown
 * name falls back to `fallback` rather than failing: a stale bookmark should
 * show the list, not an error.
 *
 * The fallback column is always appended as a tie-breaker. Without it, rows
 * with equal sort values can appear on two pages or on none — the classic
 * unstable-pagination bug.
 */
export function sliceFor(query: ListQuery, columns: SortMap, fallback: PgColumn): Slice {
  const chosen = query.sort ? columns[query.sort] : undefined
  const direction = query.dir === 'asc' ? asc : desc
  const orderBy = chosen && chosen !== fallback
    ? [direction(chosen), desc(fallback)]
    : [direction(fallback)]

  return { limit: PAGE_SIZE, offset: offsetFor(query.page), orderBy }
}

/** The names a client may sort this list by, for the API documentation. */
export const sortableNames = (columns: SortMap): string[] => Object.keys(columns).sort()

export { PAGE_SIZE, offsetFor }
