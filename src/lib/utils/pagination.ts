/**
 * Clamp pagination input from untrusted clients.
 * @returns sane page/size values within the allowed range
 */
export const clampPagination = (
  page: number | undefined,
  size: number | undefined
): { page: number; size: number } => {
  const allowed = [10, 25, 50, 100] as const
  const safeSize = (allowed as readonly number[]).includes(Number(size))
    ? Number(size)
    : 25
  const safePage = Math.max(1, Math.min(100_000, Math.floor(Number(page) || 1)))
  return { page: safePage, size: safeSize }
}

/**
 * Build a list of pagination buttons (numbers + ellipsis markers) for the UI.
 * Returns null entries to indicate where ellipses should appear.
 */
export const paginationButtons = (
  page: number,
  pageCount: number,
  visible = 5
): (number | null)[] => {
  if (pageCount <= 1) return [1]
  const half = Math.floor(visible / 2)
  let from = Math.max(1, page - half)
  let to = Math.min(pageCount, from + visible - 1)
  if (to - from + 1 < visible) from = Math.max(1, to - visible + 1)

  const out: (number | null)[] = []
  if (from > 1) {
    out.push(1)
    if (from > 2) out.push(null)
  }
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pageCount) {
    if (to < pageCount - 1) out.push(null)
    out.push(pageCount)
  }
  return out
}
