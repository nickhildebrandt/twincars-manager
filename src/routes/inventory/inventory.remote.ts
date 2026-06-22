import { query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { db } from '$lib/server/db/client'
import { vehicles, vehicleListings, vehicleSales } from '$lib/server/db/schema'
import { idSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { and, asc, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { vehicleLicensePlateVersions } from '$lib/server/db/schema'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200)))
})

const buildInventorySelect = (lp: ReturnType<typeof latestPlateSubquery>) => ({
  id: vehicles.id,
  plate: lp.licensePlate,
  vin: vehicles.vin,
  make: vehicles.make,
  model: vehicles.model,
  firstRegistration: vehicles.firstRegistration,
  mileageKm: vehicles.mileageKm,
  fuelType: vehicles.fuelType,
  gearbox: vehicles.gearbox,
  status: vehicleListings.status,
  salesPriceGross: vehicleListings.salesPriceGross,
  differentialTax: vehicleListings.differentialTax,
  location: vehicleListings.location
})

/**
 * List vehicles in stock — anything with no customer link and not yet
 * sold. The listing row is optional: a freshly created stock vehicle
 * shows up immediately (with empty price / location) and gets enriched
 * later when the user adds a listing.
 *
 * @group integration
 * @module inventory
 */
export const listInventoryRemote = query(listSchema, async (params) => {
  requirePermission('inventory')
  const { page, size, q } = params
  const offset = (page - 1) * size

  const filters = [
    eq(vehicles.archived, false),
    isNull(vehicles.customerId),
    isNull(vehicleSales.id)
  ]
  if (q) {
    const term = `%${q}%`
    // Suchtreffer im aktuellen Kennzeichen einsammeln und per
    // `inArray` auf Vehicle-Ids filtern — ohne handgeschriebenes SQL.
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
  const where = and(...filters)

  const lp = latestPlateSubquery()
  const [rows, totalRow] = await Promise.all([
    db
      .select(buildInventorySelect(lp))
      .from(vehicles)
      .leftJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
      .leftJoin(vehicleSales, eq(vehicleSales.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .where(where)
      .orderBy(asc(vehicles.make), asc(vehicles.model))
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(vehicles)
      .leftJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
      .leftJoin(vehicleSales, eq(vehicleSales.vehicleId, vehicles.id))
      .where(where)
  ])

  const items = rows.map((r) => ({
    ...r,
    salesPriceGross: Number(r.salesPriceGross ?? 0),
    mileageKm: r.mileageKm == null ? null : Number(r.mileageKm)
  }))
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
})

/**
 * Single inventory vehicle by id for pre-filling invoice positions.
 *
 * @group integration
 * @module inventory
 */
export const getInventoryVehicleRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('inventory')
    // LEFT JOIN auf `vehicleListings`, weil ein neu angelegtes
    // Verkaufsfahrzeug noch keinen Listing-Eintrag hat (Preis,
    // Standort etc.). Ohne LEFT JOIN würde der Verkaufen-Button
    // einen 404 werfen, sobald die Rechnungs-Vorausfüllung den
    // Fahrzeug-Datensatz braucht.
    const lp = latestPlateSubquery()
    const rows = await db
      .select(buildInventorySelect(lp))
      .from(vehicles)
      .leftJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .where(eq(vehicles.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) error(404, 'Fahrzeug nicht im Bestand gefunden.')
    return {
      ...row,
      salesPriceGross: Number(row.salesPriceGross ?? 0),
      mileageKm: row.mileageKm == null ? null : Number(row.mileageKm)
    }
  }
)
