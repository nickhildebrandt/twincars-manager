/**
 * Tire storage service — CRUD for the workshop's seasonal tire
 * storage facility. Each entry represents one customer's set of
 * tires sitting on a shelf with a printed QR/storage number.
 *
 * Storage numbers (`L-{YYYY}-{NNNN}`) are auto-allocated from the
 * shared `number_ranges` table via {@link nextNumber}.
 */
import { db } from '$lib/server/db/client'
import {
  customers,
  tireStorage,
  type TireStorage,
  type NewTireStorage
} from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, isNotNull, isNull, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import { nextNumber } from '$lib/utils/numbering'

export type TireStorageListItem = TireStorage & {
  customerLabel: string
  customerNumber: string
}

/**
 * List entries with server-side pagination + free-text search across
 * the most useful columns (storage number, brand, model, size, plus
 * the joined customer name). The `active` filter splits the table
 * into "still stored" (`retrievedAt IS NULL`) and "retrieved"
 * (`retrievedAt IS NOT NULL`) for the page's two tabs.
 */
export async function listTireStorage(
  params: ListParams & { active?: boolean }
): Promise<ListResult<TireStorageListItem>> {
  const { page, size, q, active } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(tireStorage.storageNumber, term),
        ilike(tireStorage.brand, term),
        ilike(tireStorage.model, term),
        ilike(tireStorage.size, term),
        ilike(customers.lastName, term),
        ilike(customers.firstName, term),
        ilike(customers.company, term),
        ilike(customers.customerNumber, term)
      )!
    )
  }
  if (active === true) filters.push(isNull(tireStorage.retrievedAt))
  else if (active === false) filters.push(isNotNull(tireStorage.retrievedAt))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        entry: tireStorage,
        customerCompany: customers.company,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerNumber: customers.customerNumber
      })
      .from(tireStorage)
      .innerJoin(customers, eq(customers.id, tireStorage.customerId))
      .where(where)
      .orderBy(desc(tireStorage.storedAt), desc(tireStorage.createdAt))
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(tireStorage)
      .innerJoin(customers, eq(customers.id, tireStorage.customerId))
      .where(where)
  ])

  const items: TireStorageListItem[] = rows.map((r) => ({
    ...r.entry,
    customerNumber: r.customerNumber,
    customerLabel:
      r.customerCompany ||
      `${r.customerFirstName ?? ''} ${r.customerLastName ?? ''}`.trim() ||
      r.customerNumber
  }))

  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

/**
 * Load one entry with the joined customer label so the detail page
 * doesn't need a second roundtrip.
 */
export async function getTireStorage(
  id: string
): Promise<TireStorageListItem | null> {
  const [row] = await db
    .select({
      entry: tireStorage,
      customerCompany: customers.company,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerNumber: customers.customerNumber
    })
    .from(tireStorage)
    .innerJoin(customers, eq(customers.id, tireStorage.customerId))
    .where(eq(tireStorage.id, id))
    .limit(1)
  if (!row) return null
  return {
    ...row.entry,
    customerNumber: row.customerNumber,
    customerLabel:
      row.customerCompany ||
      `${row.customerFirstName ?? ''} ${row.customerLastName ?? ''}`.trim() ||
      row.customerNumber
  }
}

/**
 * Resolve a storage number (the value printed + QR-encoded on the label)
 * to its entry id, for the phone-scan deep link. Returns null when no
 * entry matches.
 */
export async function getTireStorageIdByNumber(
  storageNumber: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: tireStorage.id })
    .from(tireStorage)
    .where(eq(tireStorage.storageNumber, storageNumber))
    .limit(1)
  return row?.id ?? null
}

/**
 * Generate the next storage number from the configured range and
 * bump the counter. Format defaults to `L-{YYYY}-{NNNN}` if the
 * range row is missing (the seed step always creates it).
 */
export async function nextStorageNumber(): Promise<string> {
  return nextNumber('tire_storage', 'L-{YYYY}-{NNNN}')
}

/**
 * Create a new entry. The `storageNumber` is auto-allocated server-side
 * unless the caller explicitly supplies one (used by the legacy
 * importer to preserve historic numbers).
 */
export async function createTireStorage(
  values: Omit<NewTireStorage, 'storageNumber' | 'storedAt'> & {
    storageNumber?: string
    storedAt?: string
  }
): Promise<TireStorage> {
  const storageNumber = values.storageNumber ?? (await nextStorageNumber())
  const storedAt = values.storedAt ?? new Date().toISOString().slice(0, 10)
  const [created] = await db
    .insert(tireStorage)
    .values({ ...values, storageNumber, storedAt })
    .returning()
  return created
}

/**
 * Update an existing entry. Re-stamps `updatedAt`.
 */
export async function updateTireStorage(
  id: string,
  values: Partial<NewTireStorage>
): Promise<TireStorage> {
  const [updated] = await db
    .update(tireStorage)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(tireStorage.id, id))
    .returning()
  return updated
}

/**
 * Mark an entry as retrieved (tires picked up by the customer).
 * Defaults to today if no explicit date is given.
 */
export async function markRetrieved(
  id: string,
  date?: string
): Promise<TireStorage> {
  const retrievedAt = date ?? new Date().toISOString().slice(0, 10)
  const [updated] = await db
    .update(tireStorage)
    .set({ retrievedAt, updatedAt: new Date() })
    .where(eq(tireStorage.id, id))
    .returning()
  return updated
}

/**
 * Delete an entry permanently.
 */
export async function deleteTireStorage(id: string): Promise<void> {
  await db.delete(tireStorage).where(eq(tireStorage.id, id))
}
