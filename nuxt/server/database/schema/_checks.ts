/**
 * `CHECK` constraints built from the value lists in `shared/domain.ts`.
 *
 * The predecessor declared every discriminator as a plain `varchar` with no
 * constraint at all, so any service could write any string and the label maps
 * silently fell back to the English value (B-335, B-411). Here the database
 * refuses a value the application does not know, and the list it refuses
 * against is the same one the Valibot schema and the German labels come from.
 */
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Renders the value list.
 *
 * `sql.raw` is used deliberately: a `CHECK` constraint is data definition, and
 * DDL takes no parameters. The values come from a constant in this repository,
 * never from a request, and the quote doubling keeps the statement well formed
 * regardless.
 */
const list = (values: readonly string[]) =>
  sql.raw(values.map(value => `'${value.replace(/'/g, '\'\'')}'`).join(', '))

/** `column IN (…)` — for a column that must always hold one of the values. */
export const oneOf = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} IN (${list(values)})`

/** `column IS NULL OR column IN (…)` — for an optional discriminator. */
export const oneOfOrNull = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} IS NULL OR ${column} IN (${list(values)})`

/** `column >= 0` — for counters that have no meaning below zero. */
export const notNegative = (column: AnyPgColumn) => sql`${column} >= 0`
