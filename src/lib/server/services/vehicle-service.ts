import { db } from '$lib/server/db/client'
import {
  vehicleLicensePlateVersions,
  vehicleListings,
  vehiclePhotos,
  vehicleSales,
  vehicles,
  type Vehicle,
  type NewVehicle,
  type VehicleLicensePlateVersion
} from '$lib/server/db/schema'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or
} from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

export type VehicleKindFilter = 'customer' | 'stock' | 'all'

/**
 * Vehicle-Datensatz angereichert um das aktuell gültige Kennzeichen.
 * `licensePlate` ist `null`, wenn noch keine Version gepflegt ist.
 */
export type VehicleWithPlate = Vehicle & { licensePlate: string | null }

const todayIso = (): string => new Date().toISOString().slice(0, 10)

/**
 * Drizzle-Subquery: pro Fahrzeug die zum heutigen Tag gültige
 * Kennzeichenversion (höchstes `valid_from <= today`). Aufrufer joinen
 * sie per `leftJoin(latestPlateSubquery(), eq(<sub>.vehicleId, vehicles.id))`
 * und greifen `<sub>.licensePlate` als Spalte ab.
 */
export const latestPlateSubquery = () =>
  db
    .selectDistinctOn([vehicleLicensePlateVersions.vehicleId], {
      vehicleId: vehicleLicensePlateVersions.vehicleId,
      licensePlate: vehicleLicensePlateVersions.licensePlate
    })
    .from(vehicleLicensePlateVersions)
    .where(lte(vehicleLicensePlateVersions.validFrom, todayIso()))
    .orderBy(
      vehicleLicensePlateVersions.vehicleId,
      desc(vehicleLicensePlateVersions.validFrom)
    )
    .as('latest_plate')

/**
 * Holt zu einer Liste von Fahrzeug-Ids die jeweils aktuelle
 * Kennzeichenversion in einem einzigen Query — vermeidet das N+1, das
 * `getEffectiveLicensePlate` einzeln verursacht hätte.
 */
const fetchCurrentPlatesFor = async (
  vehicleIds: string[],
  asOf: string = todayIso()
): Promise<Map<string, string>> => {
  if (vehicleIds.length === 0) return new Map()
  const rows = await db
    .select({
      vehicleId: vehicleLicensePlateVersions.vehicleId,
      validFrom: vehicleLicensePlateVersions.validFrom,
      licensePlate: vehicleLicensePlateVersions.licensePlate
    })
    .from(vehicleLicensePlateVersions)
    .where(
      and(
        inArray(vehicleLicensePlateVersions.vehicleId, vehicleIds),
        lte(vehicleLicensePlateVersions.validFrom, asOf)
      )
    )
    .orderBy(
      vehicleLicensePlateVersions.vehicleId,
      desc(vehicleLicensePlateVersions.validFrom)
    )
  const out = new Map<string, string>()
  for (const r of rows) {
    if (!out.has(r.vehicleId)) out.set(r.vehicleId, r.licensePlate)
  }
  return out
}

/**
 * Liefert die zum Stichtag gültige Kennzeichen-Version eines
 * Fahrzeugs (höchstes `valid_from <= asOf`). Ohne Version `null`.
 */
export const getEffectiveLicensePlate = async (
  vehicleId: string,
  asOf: string = todayIso()
): Promise<VehicleLicensePlateVersion | null> => {
  const [row] = await db
    .select()
    .from(vehicleLicensePlateVersions)
    .where(
      and(
        eq(vehicleLicensePlateVersions.vehicleId, vehicleId),
        lte(vehicleLicensePlateVersions.validFrom, asOf)
      )
    )
    .orderBy(desc(vehicleLicensePlateVersions.validFrom))
    .limit(1)
  return row ?? null
}

/**
 * Komplette Kennzeichenhistorie eines Fahrzeugs, jüngste Version
 * zuerst — für die Detailseite (read-only Tabelle).
 */
export const listLicensePlateVersions = async (
  vehicleId: string
): Promise<VehicleLicensePlateVersion[]> =>
  db
    .select()
    .from(vehicleLicensePlateVersions)
    .where(eq(vehicleLicensePlateVersions.vehicleId, vehicleId))
    .orderBy(desc(vehicleLicensePlateVersions.validFrom))

/**
 * Schreibt eine neue Kennzeichenversion oder aktualisiert die mit dem
 * gleichen `valid_from`. Doppelte Eingaben am gleichen Tag erzeugen
 * keine Spam-Versionen.
 */
export const upsertLicensePlateVersion = async (params: {
  vehicleId: string
  validFrom: string
  licensePlate: string
}): Promise<VehicleLicensePlateVersion> => {
  const [existing] = await db
    .select()
    .from(vehicleLicensePlateVersions)
    .where(
      and(
        eq(vehicleLicensePlateVersions.vehicleId, params.vehicleId),
        eq(vehicleLicensePlateVersions.validFrom, params.validFrom)
      )
    )
    .limit(1)
  if (existing) {
    const [row] = await db
      .update(vehicleLicensePlateVersions)
      .set({ licensePlate: params.licensePlate })
      .where(eq(vehicleLicensePlateVersions.id, existing.id))
      .returning()
    return row
  }
  const [row] = await db
    .insert(vehicleLicensePlateVersions)
    .values({
      vehicleId: params.vehicleId,
      validFrom: params.validFrom,
      licensePlate: params.licensePlate
    })
    .returning()
  return row
}

export const deleteLicensePlateVersion = async (id: string): Promise<void> => {
  await db
    .delete(vehicleLicensePlateVersions)
    .where(eq(vehicleLicensePlateVersions.id, id))
}

/**
 * List vehicles with server-side pagination + search + kind filter.
 *
 * - Archived rows are always excluded.
 * - Suche schließt das aktuell gültige Kennzeichen mit ein, indem die
 *   Versionentabelle vorab nach Treffern gefiltert wird und die
 *   gefundenen Vehicle-Ids in den Filter einfließen.
 */
export async function listVehicles(
  params: ListParams & { kind?: VehicleKindFilter }
): Promise<ListResult<VehicleWithPlate>> {
  const { page, size, q, kind = 'all' } = params
  const offset = (page - 1) * size

  const filters = [eq(vehicles.archived, false)]
  if (q) {
    const term = `%${q}%`
    // Vehicles, deren aktuelles Kennzeichen den Suchbegriff enthält.
    const plateMatches = await db
      .selectDistinct({ vehicleId: vehicleLicensePlateVersions.vehicleId })
      .from(vehicleLicensePlateVersions)
      .where(ilike(vehicleLicensePlateVersions.licensePlate, term))
    const plateMatchIds = plateMatches.map((r) => r.vehicleId)
    const baseSearch = or(
      ilike(vehicles.vin, term),
      ilike(vehicles.make, term),
      ilike(vehicles.model, term)
    )!
    filters.push(
      plateMatchIds.length > 0
        ? or(baseSearch, inArray(vehicles.id, plateMatchIds))!
        : baseSearch
    )
  }
  if (kind === 'customer') {
    filters.push(isNotNull(vehicles.customerId))
  } else if (kind === 'stock') {
    filters.push(isNull(vehicles.customerId))
  }
  const where = and(...filters)

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(vehicles)
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(vehicles).where(where)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  const plates = await fetchCurrentPlatesFor(items.map((v) => v.id))
  return {
    items: items.map((v) => ({ ...v, licensePlate: plates.get(v.id) ?? null })),
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function createVehicle(
  values: NewVehicle & { licensePlate?: string | null }
): Promise<VehicleWithPlate> {
  const { licensePlate, ...vehicleValues } = values
  const [created] = await db.insert(vehicles).values(vehicleValues).returning()
  if (licensePlate && licensePlate.trim().length > 0) {
    await upsertLicensePlateVersion({
      vehicleId: created.id,
      validFrom: todayIso(),
      licensePlate: licensePlate.trim()
    })
  }
  const v = await getEffectiveLicensePlate(created.id)
  return { ...created, licensePlate: v?.licensePlate ?? null }
}

export async function updateVehicle(
  id: string,
  values: Partial<NewVehicle> & { licensePlate?: string | null }
): Promise<VehicleWithPlate> {
  const { licensePlate, ...vehicleValues } = values
  const [updated] = await db
    .update(vehicles)
    .set({ ...vehicleValues, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning()
  if (licensePlate !== undefined) {
    const next = (licensePlate ?? '').trim()
    const current = await getEffectiveLicensePlate(id)
    if (next.length > 0 && current?.licensePlate !== next) {
      await upsertLicensePlateVersion({
        vehicleId: id,
        validFrom: todayIso(),
        licensePlate: next
      })
    }
  }
  const v = await getEffectiveLicensePlate(id)
  return { ...updated, licensePlate: v?.licensePlate ?? null }
}

export async function deleteVehicle(id: string): Promise<void> {
  await db.delete(vehicles).where(eq(vehicles.id, id))
}

export async function getVehicle(id: string): Promise<VehicleWithPlate | null> {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
  if (!row) return null
  const v = await getEffectiveLicensePlate(id)
  return { ...row, licensePlate: v?.licensePlate ?? null }
}

export async function countVehicles(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(vehicles)
    .where(eq(vehicles.archived, false))
  return Number(row?.value ?? 0)
}

/**
 * Hilfsfunktion fürs Anreichern beliebiger Vehicle-Listen mit
 * aktuellem Kennzeichen — Pickers, Dashboard, Customer-Detail etc.
 */
export async function withCurrentPlates<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { licensePlate: string | null }>> {
  const plates = await fetchCurrentPlatesFor(rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, licensePlate: plates.get(r.id) ?? null }))
}

export { asc }

/* ────────────────────────────────────────────────────────────────────── */
/* Public storefront helpers                                              */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * One row in the public used-car listing, projected to what an
 * external website is allowed to see. Only fields that already appear
 * in the customer-facing inventory are exposed; internal price
 * margins, purchase data and internal notes never make it into this
 * shape.
 */
export type PublicUsedCar = {
  id: string
  make: string | null
  model: string | null
  firstRegistration: string | null
  mileageKm: number | null
  priceGross: number | null
  fuel: string | null
  transmission: string | null
  description: string | null
  photos: Array<{ mime: string; dataUrl: string }>
}

/**
 * Inventory vehicles available for the public used-car listing:
 * not archived, no customer (i.e. stock), not sold yet, and with a
 * sales listing in `available` state. Each vehicle is enriched with
 * its cover photo plus up to 6 additional photos in `sortOrder`,
 * encoded as data URLs ready to be embedded into a public website.
 */
export async function listPublicUsedCars(): Promise<PublicUsedCar[]> {
  const rows = await db
    .select({
      id: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      firstRegistration: vehicles.firstRegistration,
      mileageKm: vehicles.mileageKm,
      fuelType: vehicles.fuelType,
      gearbox: vehicles.gearbox,
      salesPriceGross: vehicleListings.salesPriceGross,
      highlights: vehicleListings.highlights,
      status: vehicleListings.status,
      saleId: vehicleSales.id
    })
    .from(vehicles)
    .leftJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
    .leftJoin(vehicleSales, eq(vehicleSales.vehicleId, vehicles.id))
    .where(
      and(
        eq(vehicles.archived, false),
        isNull(vehicles.customerId),
        isNull(vehicleSales.id)
      )
    )
    .orderBy(desc(vehicles.createdAt))

  if (rows.length === 0) return []

  // Pull all photos for these vehicles in one query, then bucket by id.
  const ids = rows.map((r) => r.id)
  const photoRows = await db
    .select({
      vehicleId: vehiclePhotos.vehicleId,
      mime: vehiclePhotos.mime,
      dataUrl: vehiclePhotos.dataUrl,
      isMain: vehiclePhotos.isMain,
      sortOrder: vehiclePhotos.sortOrder
    })
    .from(vehiclePhotos)
    .where(inArray(vehiclePhotos.vehicleId, ids))
    .orderBy(
      desc(vehiclePhotos.isMain),
      asc(vehiclePhotos.sortOrder),
      asc(vehiclePhotos.createdAt)
    )
  const photosByVehicle = new Map<
    string,
    Array<{ mime: string; dataUrl: string }>
  >()
  for (const p of photoRows) {
    const list = photosByVehicle.get(p.vehicleId) ?? []
    // Cap at 7 photos per vehicle (cover + 6 additional).
    if (list.length < 7) list.push({ mime: p.mime, dataUrl: p.dataUrl })
    photosByVehicle.set(p.vehicleId, list)
  }

  return rows.map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    firstRegistration: r.firstRegistration,
    mileageKm: r.mileageKm == null ? null : Number(r.mileageKm),
    priceGross: r.salesPriceGross == null ? null : Number(r.salesPriceGross),
    fuel: r.fuelType,
    transmission: r.gearbox,
    description: r.highlights ?? null,
    photos: photosByVehicle.get(r.id) ?? []
  }))
}

/**
 * Single-row equivalent of {@link listPublicUsedCars}. Returns the
 * same `PublicUsedCar` projection for one vehicle, or `null` when the
 * id is unknown, the vehicle is archived, owned by a customer, or
 * already sold. Used by `GET /api/public/used-cars/:id` for the
 * external website's vehicle-detail page.
 */
export async function getPublicUsedCar(
  id: string
): Promise<PublicUsedCar | null> {
  const [row] = await db
    .select({
      id: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      firstRegistration: vehicles.firstRegistration,
      mileageKm: vehicles.mileageKm,
      fuelType: vehicles.fuelType,
      gearbox: vehicles.gearbox,
      salesPriceGross: vehicleListings.salesPriceGross,
      highlights: vehicleListings.highlights,
      saleId: vehicleSales.id
    })
    .from(vehicles)
    .leftJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
    .leftJoin(vehicleSales, eq(vehicleSales.vehicleId, vehicles.id))
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.archived, false),
        isNull(vehicles.customerId),
        isNull(vehicleSales.id)
      )
    )
    .limit(1)
  if (!row) return null
  const photoRows = await db
    .select({ mime: vehiclePhotos.mime, dataUrl: vehiclePhotos.dataUrl })
    .from(vehiclePhotos)
    .where(eq(vehiclePhotos.vehicleId, row.id))
    .orderBy(
      desc(vehiclePhotos.isMain),
      asc(vehiclePhotos.sortOrder),
      asc(vehiclePhotos.createdAt)
    )
  const photos = photoRows.slice(0, 7)
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    firstRegistration: row.firstRegistration,
    mileageKm: row.mileageKm == null ? null : Number(row.mileageKm),
    priceGross:
      row.salesPriceGross == null ? null : Number(row.salesPriceGross),
    fuel: row.fuelType,
    transmission: row.gearbox,
    description: row.highlights ?? null,
    photos
  }
}
