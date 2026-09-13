/**
 * Handing out document, customer and storage numbers.
 *
 * One row per kind in `number_ranges`, one counter per row. The counter is
 * bumped by a **single** statement:
 *
 *   UPDATE number_ranges SET next_value = next_value + 1
 *    WHERE kind = $1 RETURNING next_value, format_template
 *
 * PostgreSQL locks the row for the duration of that statement, so two
 * concurrent callers never receive the same value. The predecessor read the
 * counter and wrote it back in two steps, which could hand the same invoice
 * number to two requests — a matter the tax office takes seriously.
 *
 * The caller passes the executor. Inside a transaction the number is rolled
 * back with everything else when the write fails, so the sequence has no gaps
 * (B-304). Outside one, a failure downstream burns a number.
 */
import { eq, sql } from 'drizzle-orm'
import { renderNumber } from '#shared/numbering'
import { numberRanges } from '../database/schema/index.ts'
import type { Executor } from './db.ts'

/** Kinds the application draws numbers for. Rows are created by the seed. */
export type NumberKind
  = | 'invoice' | 'offer' | 'cost_estimate' | 'order_confirmation'
    | 'storno' | 'reminder' | 'customer' | 'tire' | 'tire_storage' | 'work_order'

/**
 * Takes the next number for `kind` and renders it through the template.
 *
 * Throws when the range is missing. That is deliberate: the ranges are seeded
 * before the server accepts its first request, so a missing row means the
 * installation is broken, and inventing a number would hide it.
 */
export async function allocateNumber(
  executor: Executor,
  kind: NumberKind,
  at: Date = new Date(),
): Promise<string> {
  const [row] = await executor
    .update(numberRanges)
    .set({ nextValue: sql`${numberRanges.nextValue} + 1` })
    .where(eq(numberRanges.kind, kind))
    .returning({
      nextValue: numberRanges.nextValue,
      formatTemplate: numberRanges.formatTemplate,
    })

  if (!row) {
    throw new Error(`Kein Nummernkreis für "${kind}" vorhanden.`)
  }

  // RETURNING reports the value after the increment; the number handed out is
  // the one before it.
  return renderNumber(row.formatTemplate, row.nextValue - 1, at)
}

/**
 * What the next number would look like, without consuming it.
 *
 * The settings page previews the format with this; nothing else may use it to
 * decide a number, because between preview and write somebody else may have
 * taken it.
 */
export async function peekNumber(
  executor: Executor,
  kind: NumberKind,
  at: Date = new Date(),
): Promise<string | null> {
  const [row] = await executor
    .select({
      nextValue: numberRanges.nextValue,
      formatTemplate: numberRanges.formatTemplate,
    })
    .from(numberRanges)
    .where(eq(numberRanges.kind, kind))
    .limit(1)

  return row ? renderNumber(row.formatTemplate, row.nextValue, at) : null
}
