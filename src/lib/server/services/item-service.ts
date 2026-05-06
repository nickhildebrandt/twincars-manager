import { db } from '$lib/server/db/client'
import {
  itemPriceVersions,
  items,
  type ItemPriceVersion
} from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, lte, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type Item = typeof items.$inferSelect
type NewItem = typeof items.$inferInsert

/**
 * Item-Datensatz angereichert um die jeweils aktuell gültige
 * Preisversion. `unitPriceNet` ist `null`, wenn noch keine Version
 * existiert (sollte nach dem Backfill aus Migration 0008 nicht
 * vorkommen — Defensive für neu angelegte Items während des Übergangs).
 */
export type ItemWithPrice = Item & { unitPriceNet: string | null }

export async function listItems(
  params: ListParams & { kind?: string }
): Promise<ListResult<ItemWithPrice>> {
  const { page, size, q, kind } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(ilike(items.articleNumber, term), ilike(items.description, term))
    )
  }
  if (kind) filters.push(eq(items.kind, kind))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [list, totalRow] = await Promise.all([
    db
      .select()
      .from(items)
      .where(where)
      .orderBy(desc(items.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(items).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  const enriched = await Promise.all(
    list.map(async (i) => {
      const v = await getCurrentItemPrice(i.id)
      return { ...i, unitPriceNet: v?.unitPriceNet ?? null }
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

/**
 * Erzeugt das Item und legt parallel die initiale Preisversion an.
 * Akzeptiert `unitPriceNet` als optionalen Wert auf dem Eingabeobjekt
 * (kommt aus dem Frontend-Form), schreibt ihn aber NICHT in `items` —
 * dort gibt es die Spalte seit Migration 0008 nicht mehr.
 */
export async function createItem(
  values: NewItem & { unitPriceNet?: string | number | null }
): Promise<ItemWithPrice> {
  const { unitPriceNet, ...itemValues } = values
  const [created] = await db.insert(items).values(itemValues).returning()
  if (unitPriceNet != null && unitPriceNet !== '') {
    await upsertItemPrice({
      itemId: created.id,
      validFrom: new Date().toISOString().slice(0, 10),
      unitPriceNet: String(unitPriceNet)
    })
  }
  const v = await getCurrentItemPrice(created.id)
  return { ...created, unitPriceNet: v?.unitPriceNet ?? null }
}

/**
 * Aktualisiert die Item-Stammdaten. Ein neuer `unitPriceNet`-Wert legt
 * eine neue Preisversion mit `valid_from = heute` an (oder
 * aktualisiert eine schon vorhandene heutige Version, statt zu
 * duplizieren).
 */
export async function updateItem(
  id: string,
  values: Partial<NewItem> & { unitPriceNet?: string | number | null }
): Promise<ItemWithPrice> {
  const { unitPriceNet, ...itemValues } = values
  const [updated] = await db
    .update(items)
    .set({ ...itemValues, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning()
  if (unitPriceNet != null && unitPriceNet !== '') {
    await upsertItemPrice({
      itemId: id,
      validFrom: new Date().toISOString().slice(0, 10),
      unitPriceNet: String(unitPriceNet)
    })
  }
  const v = await getCurrentItemPrice(id)
  return { ...updated, unitPriceNet: v?.unitPriceNet ?? null }
}

export async function deleteItem(id: string): Promise<void> {
  await db.delete(items).where(eq(items.id, id))
}

export async function getItem(id: string): Promise<ItemWithPrice | null> {
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1)
  if (!row) return null
  const v = await getCurrentItemPrice(id)
  return { ...row, unitPriceNet: v?.unitPriceNet ?? null }
}

export async function nextArticleNumber(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(items)
  return `ART-${String(Number(value) + 1).padStart(5, '0')}`
}

/* ── Versionierte Preise ───────────────────────────────────────────── */

const todayIso = (): string => new Date().toISOString().slice(0, 10)

/**
 * Liefert die zum Stichtag gültige Preisversion eines Items: die mit
 * dem höchsten `valid_from <= asOf`. Defaults auf heute.
 */
export const getItemPriceAt = async (
  itemId: string,
  asOf: string = todayIso()
): Promise<ItemPriceVersion | null> => {
  const [row] = await db
    .select()
    .from(itemPriceVersions)
    .where(
      and(
        eq(itemPriceVersions.itemId, itemId),
        lte(itemPriceVersions.validFrom, asOf)
      )
    )
    .orderBy(desc(itemPriceVersions.validFrom))
    .limit(1)
  return row ?? null
}

export const getCurrentItemPrice = (itemId: string) => getItemPriceAt(itemId)

/**
 * Setzt eine neue Preisversion oder aktualisiert eine bereits am
 * gleichen `valid_from` existierende. Doppelte Eingaben am gleichen
 * Tag erzeugen so keine Versions-Spam-Zeilen.
 */
export const upsertItemPrice = async (params: {
  itemId: string
  validFrom: string
  unitPriceNet: string
}): Promise<ItemPriceVersion> => {
  const [existing] = await db
    .select()
    .from(itemPriceVersions)
    .where(
      and(
        eq(itemPriceVersions.itemId, params.itemId),
        eq(itemPriceVersions.validFrom, params.validFrom)
      )
    )
    .limit(1)
  if (existing) {
    const [row] = await db
      .update(itemPriceVersions)
      .set({ unitPriceNet: params.unitPriceNet })
      .where(eq(itemPriceVersions.id, existing.id))
      .returning()
    return row
  }
  const [row] = await db
    .insert(itemPriceVersions)
    .values({
      itemId: params.itemId,
      validFrom: params.validFrom,
      unitPriceNet: params.unitPriceNet
    })
    .returning()
  return row
}

export const deleteItemPriceVersion = async (id: string): Promise<void> => {
  await db.delete(itemPriceVersions).where(eq(itemPriceVersions.id, id))
}

/**
 * Paginierter Preisverlauf pro Item — direkt aus der
 * `item_price_versions`-Tabelle, neuste zuerst. Ersetzt die ältere,
 * aus `document_items` zusammengezogene Version.
 */
export type ItemPriceHistoryRow = {
  id: string
  validFrom: string
  unitPriceNet: string
  createdAt: Date
}

export async function listItemPriceHistory(
  itemId: string,
  page: number,
  size: number
): Promise<ListResult<ItemPriceHistoryRow>> {
  const offset = (page - 1) * size
  const where = eq(itemPriceVersions.itemId, itemId)
  const [list, totalRow] = await Promise.all([
    db
      .select({
        id: itemPriceVersions.id,
        validFrom: itemPriceVersions.validFrom,
        unitPriceNet: itemPriceVersions.unitPriceNet,
        createdAt: itemPriceVersions.createdAt
      })
      .from(itemPriceVersions)
      .where(where)
      .orderBy(desc(itemPriceVersions.validFrom))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(itemPriceVersions).where(where)
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
