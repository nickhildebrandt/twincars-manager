/**
 * Number-range template renderer — pure and shared between server and
 * client (e.g. settings previews). Allocation of sequence values lives
 * server-side in `$lib/server/services/number-range-service.ts`.
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
