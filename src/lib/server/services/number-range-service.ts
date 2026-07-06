/**
 * Central number-range allocation. Every document / customer / tire /
 * storage number in the app is drawn from the shared `number_ranges`
 * table through {@link allocateNumber} — one row per `kind`, one
 * monotonically increasing counter per row.
 *
 * GoBD relevance: the old copy-pasted SELECT-then-UPDATE pattern could
 * hand the same sequence value to two concurrent requests (duplicate
 * invoice numbers). The allocation here is a single atomic statement:
 *
 *   UPDATE number_ranges
 *      SET next_value = next_value + 1
 *    WHERE kind = $1
 *    RETURNING next_value - 1 AS seq, format_template
 *
 * Postgres row-locks the row for the duration of the statement, so two
 * concurrent callers always receive distinct sequence values.
 *
 * @group integration
 * @module number-range-service
 */
import { db } from '$lib/server/db/client'
import { numberRanges } from '$lib/server/db/schema'
import { eq, sql } from 'drizzle-orm'
import { renderNumber } from '$lib/utils/numbering'

/**
 * Default format template per range kind, mirroring the rows
 * `seedDefaults()` creates (`seed-defaults.ts`) plus the `'tire'`
 * range seeded by migration 0022. Only used when the row is missing —
 * e.g. a fresh database before the first request ran the seed step.
 */
const DEFAULT_TEMPLATES: Record<string, string> = {
  invoice: '{N}',
  offer: '{N}',
  cost_estimate: '{N}',
  order_confirmation: '{N}',
  reminder: 'ZE-{YYYY}-{NNNN}',
  customer: '{N}',
  tire: '{N}',
  tire_storage: 'L-{YYYY}-{NNNN}',
  storno: 'S-{N}',
  work_order: 'AU-{YYYY}-{NNNN}'
}

/** Plain-counter house style for kinds without a seeded default. */
const FALLBACK_TEMPLATE = '{N}'

/**
 * Atomically bump the counter for `kind` and return the sequence value
 * that was current before the bump, plus the row's template. Returns
 * `null` when no row exists for `kind`.
 */
async function bumpCounter(
  kind: string
): Promise<{ seq: number; formatTemplate: string } | null> {
  const [row] = await db
    .update(numberRanges)
    .set({ nextValue: sql`${numberRanges.nextValue} + 1` })
    .where(eq(numberRanges.kind, kind))
    .returning({
      seq: sql<number>`${numberRanges.nextValue} - 1`,
      formatTemplate: numberRanges.formatTemplate
    })
  if (!row) return null
  return { seq: Number(row.seq), formatTemplate: row.formatTemplate }
}

/**
 * Allocate the next number from the range keyed by `kind` and render
 * it through the row's format template ({@link renderNumber}).
 *
 * If no range row exists yet, the seed row `seedDefaults()` would have
 * created is inserted (counter at 1, default template per kind) and
 * the allocation retried — so the very first allocation both persists
 * the row and hands out sequence 1. The insert uses
 * `onConflictDoNothing`, which keeps even the seeding path safe under
 * concurrency: the loser of the insert race simply draws the next
 * value from the winner's row.
 */
export async function allocateNumber(kind: string): Promise<string> {
  const allocated = await bumpCounter(kind)
  if (allocated) return renderNumber(allocated.formatTemplate, allocated.seq)

  await db
    .insert(numberRanges)
    .values({
      kind,
      formatTemplate: DEFAULT_TEMPLATES[kind] ?? FALLBACK_TEMPLATE,
      nextValue: 1
    })
    .onConflictDoNothing({ target: numberRanges.kind })

  const retried = await bumpCounter(kind)
  if (!retried) {
    // Row vanished between insert and update — cannot happen outside a
    // concurrent TRUNCATE; surface as a hard server error.
    throw new Error(`number range allocation failed for kind "${kind}"`)
  }
  return renderNumber(retried.formatTemplate, retried.seq)
}
