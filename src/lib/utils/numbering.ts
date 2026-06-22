/**
 * Number-range helpers — render document/customer numbers from a template.
 *
 * Supported placeholders:
 *   {YYYY}    full year
 *   {YY}      two-digit year
 *   {MM}      two-digit month
 *   {NNNN}    sequence padded to N digits (zero-padded length matches N count)
 */
export const renderNumber = (
  template: string,
  sequence: number,
  now: Date = new Date()
): string => {
  const yyyy = String(now.getFullYear())
  const yy = yyyy.slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')

  return template
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{N+\}/g, (m) => String(sequence).padStart(m.length - 2, '0'))
}

/**
 * Server-side: atomically allocate the next number from a configured
 * `number_ranges` row. Reads the template + current `next_value`, bumps
 * the counter by one, and renders the resulting string.
 *
 * `kind` matches the `number_ranges.kind` column (e.g. `'tire_storage'`).
 * If no row exists for `kind`, falls back to `fallbackTemplate` and
 * starts at sequence `1` (without persisting a new range — the caller
 * should make sure the seed step creates the row up front).
 */
export const nextNumber = async (
  kind: string,
  fallbackTemplate = '{NNNN}',
  now: Date = new Date()
): Promise<string> => {
  const { db } = await import('$lib/server/db/client')
  const { numberRanges } = await import('$lib/server/db/schema')
  const { eq } = await import('drizzle-orm')
  const [row] = await db
    .select()
    .from(numberRanges)
    .where(eq(numberRanges.kind, kind))
    .limit(1)
  const template = row?.formatTemplate ?? fallbackTemplate
  const sequence = row?.nextValue ?? 1
  if (row) {
    await db
      .update(numberRanges)
      .set({ nextValue: sequence + 1 })
      .where(eq(numberRanges.kind, kind))
  }
  return renderNumber(template, sequence, now)
}
