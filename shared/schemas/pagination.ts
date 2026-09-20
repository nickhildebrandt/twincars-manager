/**
 * List queries. Pagination is server-side and the page size is fixed at 25
 * across the whole application — there is no size selector anywhere
 * (../../docs/rewrite/04-ux.md §3.4).
 *
 * The predecessor let the caller pick 10, 25, 50 or 100 (B-149) and did not
 * bound the page number at all, so `page=0` produced a negative OFFSET and an
 * unhandled server error.
 */
import * as v from 'valibot'
import { searchSchema } from './primitives'

/** The one and only page size. */
export const PAGE_SIZE = 25

export const pageSchema = v.pipe(
  v.number('Bitte eine Seitenzahl angeben.'),
  v.integer('Die Seitenzahl muss eine ganze Zahl sein.'),
  v.minValue(1, 'Die Seitenzahl beginnt bei 1.'),
  v.maxValue(100_000, 'Die Seitenzahl ist unrealistisch groß.'),
)

export const sortDirectionSchema = v.picklist(
  ['asc', 'desc'],
  'Sortierrichtung muss "asc" oder "desc" sein.',
)

/**
 * Base for every list endpoint. Modules extend it with their own filters:
 *
 *   v.object({ ...listQuerySchema.entries, kind: v.optional(kindSchema) })
 */
export const listQuerySchema = v.object({
  page: v.optional(pageSchema, 1),
  q: v.optional(searchSchema),
  sort: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(40))),
  dir: v.optional(sortDirectionSchema, 'desc'),
})

export type ListQuery = v.InferOutput<typeof listQuerySchema>

/** Shape every list endpoint returns. */
export type ListResult<T> = {
  items: T[]
  total: number
  page: number
  size: number
  pageCount: number
}

/** Builds the result envelope, so the shape cannot drift between modules. */
export function listResult<T>(items: T[], total: number, page: number): ListResult<T> {
  return {
    items,
    total,
    page,
    size: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

/** LIMIT/OFFSET for a page number. */
export const offsetFor = (page: number) => (page - 1) * PAGE_SIZE
