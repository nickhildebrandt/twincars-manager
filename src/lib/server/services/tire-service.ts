/**
 * Tire-catalogue service. The workshop sells exactly one kind of
 * physical product online — tires — so this is the only end-to-end
 * inventory service in the app. The shape mirrors `item-service.ts`:
 * paginated list with filters, single-row read, full CRUD,
 * versioned-pricing helpers and photo gallery management.
 *
 * Photos live in the dedicated `tire_photos` table; we keep them in
 * this service module rather than splitting into a sibling because
 * tires are the only consumer and the API is small.
 *
 * @group integration
 * @module tire-service
 */
import { db } from '$lib/server/db/client'
import {
  numberRanges,
  tirePhotos,
  tirePriceVersions,
  tires,
  type NewTirePhoto,
  type TirePhoto,
  type TirePriceVersion
} from '$lib/server/db/schema'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lte,
  or,
  sql
} from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type Tire = typeof tires.$inferSelect
type NewTire = typeof tires.$inferInsert

/**
 * Tire row enriched with the currently valid price version. Matches
 * the `ItemWithPrice` projection from `item-service.ts`.
 */
export type TireWithPrice = Tire & { unitPriceNet: string | null }

/**
 * Filters for the admin list view. The size triple is optional and
 * applies as exact equality on each provided component.
 */
export type TireListFilters = {
  season?: string
  brand?: string
  width?: number
  aspectRatio?: number
  diameterInch?: number
  onlineSellable?: boolean
}

/* ── List / Read ───────────────────────────────────────────────────── */

export async function listTires(
  params: ListParams & TireListFilters
): Promise<ListResult<TireWithPrice>> {
  const {
    page,
    size,
    q,
    season,
    brand,
    width,
    aspectRatio,
    diameterInch,
    onlineSellable
  } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(tires.articleNumber, term),
        ilike(tires.brand, term),
        ilike(tires.model, term)
      )
    )
  }
  if (season) filters.push(eq(tires.season, season))
  if (brand) filters.push(eq(tires.brand, brand))
  if (typeof width === 'number') filters.push(eq(tires.width, width))
  if (typeof aspectRatio === 'number')
    filters.push(eq(tires.aspectRatio, aspectRatio))
  if (typeof diameterInch === 'number')
    filters.push(eq(tires.diameterInch, diameterInch))
  if (typeof onlineSellable === 'boolean')
    filters.push(eq(tires.onlineSellable, onlineSellable))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [list, totalRow] = await Promise.all([
    db
      .select()
      .from(tires)
      .where(where)
      .orderBy(desc(tires.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(tires).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  const enriched = await Promise.all(
    list.map(async (t) => {
      const v = await getCurrentTirePrice(t.id)
      return { ...t, unitPriceNet: v?.unitPriceNet ?? null }
    })
  )
  return {
    items: enriched,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function getTire(id: string): Promise<TireWithPrice | null> {
  const [row] = await db.select().from(tires).where(eq(tires.id, id)).limit(1)
  if (!row) return null
  const v = await getCurrentTirePrice(id)
  return { ...row, unitPriceNet: v?.unitPriceNet ?? null }
}

/* ── Numbering ─────────────────────────────────────────────────────── */

/**
 * Generate the next tire article number from the `number_ranges`
 * row keyed by `'tire'`. The seed migration writes a `{N}` template
 * starting at 1, matching the plain-counter style of the invoice /
 * offer ranges.
 */
export async function nextArticleNumber(): Promise<string> {
  const [row] = await db
    .select()
    .from(numberRanges)
    .where(eq(numberRanges.kind, 'tire'))
    .limit(1)
  const next = row?.nextValue ?? 1
  if (row) {
    await db
      .update(numberRanges)
      .set({ nextValue: next + 1 })
      .where(eq(numberRanges.kind, 'tire'))
  } else {
    // Defensive: range row missing (older DB or test that resets
    // number_ranges). Treat row count as the seed.
    const [{ value }] = await db.select({ value: count() }).from(tires)
    return String(Number(value) + 1)
  }
  // Tires use the bare `{N}` template — render inline to avoid pulling
  // the heavier numbering util just for a counter.
  return String(next)
}

/* ── Create / Update / Delete ──────────────────────────────────────── */

export async function createTire(
  values: NewTire & { unitPriceNet?: string | number | null }
): Promise<TireWithPrice> {
  const { unitPriceNet, ...tireValues } = values
  const [created] = await db.insert(tires).values(tireValues).returning()
  if (unitPriceNet != null && unitPriceNet !== '') {
    await upsertTirePrice({
      tireId: created.id,
      validFrom: new Date().toISOString().slice(0, 10),
      unitPriceNet: String(unitPriceNet)
    })
  }
  const v = await getCurrentTirePrice(created.id)
  return { ...created, unitPriceNet: v?.unitPriceNet ?? null }
}

export async function updateTire(
  id: string,
  values: Partial<NewTire> & { unitPriceNet?: string | number | null }
): Promise<TireWithPrice> {
  const { unitPriceNet, ...tireValues } = values
  const [updated] = await db
    .update(tires)
    .set({ ...tireValues, updatedAt: new Date() })
    .where(eq(tires.id, id))
    .returning()
  if (unitPriceNet != null && unitPriceNet !== '') {
    await upsertTirePrice({
      tireId: id,
      validFrom: new Date().toISOString().slice(0, 10),
      unitPriceNet: String(unitPriceNet)
    })
  }
  const v = await getCurrentTirePrice(id)
  return { ...updated, unitPriceNet: v?.unitPriceNet ?? null }
}

export async function deleteTire(id: string): Promise<void> {
  await db.delete(tires).where(eq(tires.id, id))
}

/* ── Versionierte Preise ───────────────────────────────────────────── */

const todayIso = (): string => new Date().toISOString().slice(0, 10)

export const getTirePriceAt = async (
  tireId: string,
  asOf: string = todayIso()
): Promise<TirePriceVersion | null> => {
  const [row] = await db
    .select()
    .from(tirePriceVersions)
    .where(
      and(
        eq(tirePriceVersions.tireId, tireId),
        lte(tirePriceVersions.validFrom, asOf)
      )
    )
    .orderBy(desc(tirePriceVersions.validFrom))
    .limit(1)
  return row ?? null
}

export const getCurrentTirePrice = (tireId: string) => getTirePriceAt(tireId)

export const upsertTirePrice = async (params: {
  tireId: string
  validFrom: string
  unitPriceNet: string
}): Promise<TirePriceVersion> => {
  const [existing] = await db
    .select()
    .from(tirePriceVersions)
    .where(
      and(
        eq(tirePriceVersions.tireId, params.tireId),
        eq(tirePriceVersions.validFrom, params.validFrom)
      )
    )
    .limit(1)
  if (existing) {
    const [row] = await db
      .update(tirePriceVersions)
      .set({ unitPriceNet: params.unitPriceNet })
      .where(eq(tirePriceVersions.id, existing.id))
      .returning()
    return row
  }
  const [row] = await db
    .insert(tirePriceVersions)
    .values({
      tireId: params.tireId,
      validFrom: params.validFrom,
      unitPriceNet: params.unitPriceNet
    })
    .returning()
  return row
}

export const deleteTirePriceVersion = async (id: string): Promise<void> => {
  await db.delete(tirePriceVersions).where(eq(tirePriceVersions.id, id))
}

export type TirePriceHistoryRow = {
  id: string
  validFrom: string
  unitPriceNet: string
  createdAt: Date
}

export async function listTirePriceHistory(
  tireId: string,
  page: number,
  size: number
): Promise<ListResult<TirePriceHistoryRow>> {
  const offset = (page - 1) * size
  const where = eq(tirePriceVersions.tireId, tireId)
  const [list, totalRow] = await Promise.all([
    db
      .select({
        id: tirePriceVersions.id,
        validFrom: tirePriceVersions.validFrom,
        unitPriceNet: tirePriceVersions.unitPriceNet,
        createdAt: tirePriceVersions.createdAt
      })
      .from(tirePriceVersions)
      .where(where)
      .orderBy(desc(tirePriceVersions.validFrom))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(tirePriceVersions).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: list,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

/* ── Photos ────────────────────────────────────────────────────────── */

export const listTirePhotos = async (tireId: string): Promise<TirePhoto[]> =>
  db
    .select()
    .from(tirePhotos)
    .where(eq(tirePhotos.tireId, tireId))
    .orderBy(asc(tirePhotos.sortOrder), asc(tirePhotos.createdAt))

export type AddTirePhotoInput = Pick<NewTirePhoto, 'tireId' | 'mime' | 'data'>

export const addTirePhoto = async (
  input: AddTirePhotoInput
): Promise<TirePhoto> => {
  const [{ value }] = await db
    .select({ value: count() })
    .from(tirePhotos)
    .where(eq(tirePhotos.tireId, input.tireId))
  const existing = Number(value)
  const isFirst = existing === 0
  const [row] = await db
    .insert(tirePhotos)
    .values({
      tireId: input.tireId,
      mime: input.mime,
      data: input.data,
      isMain: isFirst,
      sortOrder: existing
    })
    .returning()
  return row
}

export const deleteTirePhoto = async (id: string): Promise<void> => {
  const [photo] = await db
    .select()
    .from(tirePhotos)
    .where(eq(tirePhotos.id, id))
    .limit(1)
  if (!photo) return
  await db.delete(tirePhotos).where(eq(tirePhotos.id, id))
  if (photo.isMain) {
    const [next] = await db
      .select()
      .from(tirePhotos)
      .where(eq(tirePhotos.tireId, photo.tireId))
      .orderBy(asc(tirePhotos.sortOrder), asc(tirePhotos.createdAt))
      .limit(1)
    if (next) {
      await db
        .update(tirePhotos)
        .set({ isMain: true })
        .where(eq(tirePhotos.id, next.id))
    }
  }
}

export const setMainTirePhoto = async (id: string): Promise<void> => {
  const [photo] = await db
    .select()
    .from(tirePhotos)
    .where(eq(tirePhotos.id, id))
    .limit(1)
  if (!photo) throw new Error('Foto nicht gefunden.')
  await db
    .update(tirePhotos)
    .set({ isMain: false })
    .where(eq(tirePhotos.tireId, photo.tireId))
  await db.update(tirePhotos).set({ isMain: true }).where(eq(tirePhotos.id, id))
}

/* ── Public storefront projection ─────────────────────────────────── */

/**
 * Storefront-facing tire row: the raw columns plus the canonical
 * size label (`<width>/<aspectRatio><construction><diameterInch>`),
 * the currently valid price and the gallery photos.
 */
export type PublicTireRow = TireWithPrice & {
  sizeLabel: string
  photos: Array<{ mime: string; data: string }>
}

export type PublicTireFilters = {
  q?: string
  /** Either the parsed-out triple or a literal slash-form like `205/55R16`. */
  width?: number
  aspectRatio?: number
  construction?: string
  diameterInch?: number
  size?: string
  season?: string
  brand?: string
  maxPriceNet?: number
}

/**
 * Parse the slash-shorthand size string into the four canonical
 * components. Returns `null` when the string does not match. Accepts
 * common variants such as `205/55R16`, `205/55 R16`, `205/55 ZR 17`,
 * `205/55D16` (no construction defaults to R).
 */
export function parseTireSize(
  raw: string
): {
  width: number
  aspectRatio: number
  construction: string
  diameterInch: number
} | null {
  const m = raw
    .trim()
    .toUpperCase()
    .match(/^(\d{2,3})\s*\/\s*(\d{2,3})\s*(Z?R|D)?\s*(\d{2,3})$/)
  if (!m) return null
  const width = Number(m[1])
  const aspectRatio = Number(m[2])
  // Normalise: `ZR` historically denotes a high-speed radial — store as
  // `R` because the speed index already carries the high-speed marker.
  const constructionRaw = m[3] ?? 'R'
  const construction = constructionRaw === 'ZR' ? 'R' : constructionRaw
  const diameterInch = Number(m[4])
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(aspectRatio) ||
    !Number.isFinite(diameterInch)
  )
    return null
  return { width, aspectRatio, construction, diameterInch }
}

const fetchTirePhotosFor = async (
  ids: string[]
): Promise<Map<string, Array<{ mime: string; data: string }>>> => {
  const out = new Map<string, Array<{ mime: string; data: string }>>()
  if (ids.length === 0) return out
  const rows = await db
    .select({
      tireId: tirePhotos.tireId,
      mime: tirePhotos.mime,
      data: tirePhotos.data,
      isMain: tirePhotos.isMain,
      sortOrder: tirePhotos.sortOrder
    })
    .from(tirePhotos)
    .where(inArray(tirePhotos.tireId, ids))
    .orderBy(
      desc(tirePhotos.isMain),
      asc(tirePhotos.sortOrder),
      asc(tirePhotos.createdAt)
    )
  for (const r of rows) {
    const list = out.get(r.tireId) ?? []
    if (list.length < 7) list.push({ mime: r.mime, data: r.data })
    out.set(r.tireId, list)
  }
  return out
}

const sizeLabelFor = (row: Tire): string =>
  `${row.width}/${row.aspectRatio}${row.construction}${row.diameterInch}`

/**
 * Return all active, online-sellable tires matching the given filters,
 * enriched with the currently valid price and gallery photos.
 */
export async function listPublicTires(
  filters?: PublicTireFilters
): Promise<PublicTireRow[]> {
  const where = [eq(tires.onlineSellable, true)]
  if (filters?.q && filters.q.trim().length > 0) {
    const term = `%${filters.q.trim()}%`
    where.push(
      or(
        ilike(tires.articleNumber, term),
        ilike(tires.brand, term),
        ilike(tires.model, term)
      )!
    )
  }
  if (filters?.size && filters.size.length > 0) {
    const parsed = parseTireSize(filters.size)
    if (parsed) {
      where.push(eq(tires.width, parsed.width))
      where.push(eq(tires.aspectRatio, parsed.aspectRatio))
      where.push(eq(tires.construction, parsed.construction))
      where.push(eq(tires.diameterInch, parsed.diameterInch))
    } else {
      // Unparseable size never matches — force an empty result instead
      // of silently ignoring the filter.
      where.push(sql`false`)
    }
  }
  if (typeof filters?.width === 'number')
    where.push(eq(tires.width, filters.width))
  if (typeof filters?.aspectRatio === 'number')
    where.push(eq(tires.aspectRatio, filters.aspectRatio))
  if (filters?.construction)
    where.push(eq(tires.construction, filters.construction))
  if (typeof filters?.diameterInch === 'number')
    where.push(eq(tires.diameterInch, filters.diameterInch))
  if (filters?.season) where.push(eq(tires.season, filters.season))
  if (filters?.brand) where.push(eq(tires.brand, filters.brand))

  const rows = await db
    .select()
    .from(tires)
    .where(and(...where))
    .orderBy(desc(tires.createdAt))
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const v = await getCurrentTirePrice(r.id)
      return { ...r, unitPriceNet: v?.unitPriceNet ?? null }
    })
  )
  const priceFiltered =
    filters?.maxPriceNet != null
      ? enriched.filter(
          (r) =>
            r.unitPriceNet != null &&
            Number(r.unitPriceNet) <= (filters.maxPriceNet as number)
        )
      : enriched
  const photoMap = await fetchTirePhotosFor(priceFiltered.map((r) => r.id))
  return priceFiltered.map((r) => ({
    ...r,
    sizeLabel: sizeLabelFor(r),
    photos: photoMap.get(r.id) ?? []
  }))
}

/**
 * Single-row equivalent of `listPublicTires`. Returns `null` when the
 * id is unknown or not flagged `onlineSellable`.
 */
export async function getPublicTire(id: string): Promise<PublicTireRow | null> {
  const [row] = await db
    .select()
    .from(tires)
    .where(and(eq(tires.id, id), eq(tires.onlineSellable, true)))
    .limit(1)
  if (!row) return null
  const v = await getCurrentTirePrice(row.id)
  const photoMap = await fetchTirePhotosFor([row.id])
  return {
    ...row,
    unitPriceNet: v?.unitPriceNet ?? null,
    sizeLabel: sizeLabelFor(row),
    photos: photoMap.get(row.id) ?? []
  }
}
