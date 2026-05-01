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
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200)))
})

const inventorySelect = {
  id: vehicles.id,
  plate: vehicles.licensePlate,
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
}

/**
 * List vehicles currently in stock (have a listing, not yet sold).
 *
 * @group integration
 * @module inventory
 */
export const listInventoryRemote = query(listSchema, async (params) => {
  const { page, size, q } = params
  const offset = (page - 1) * size

  const filters = [
    eq(vehicles.archived, false),
    eq(vehicleListings.status, 'available'),
    isNull(vehicleSales.id)
  ]
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(vehicles.licensePlate, term),
        ilike(vehicles.vin, term),
        ilike(vehicles.make, term),
        ilike(vehicles.model, term)
      )!
    )
  }
  const where = and(...filters)

  const [rows, totalRow] = await Promise.all([
    db
      .select(inventorySelect)
      .from(vehicles)
      .innerJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
      .leftJoin(vehicleSales, eq(vehicleSales.vehicleId, vehicles.id))
      .where(where)
      .orderBy(asc(vehicles.make), asc(vehicles.model))
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(vehicles)
      .innerJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
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
    const rows = await db
      .select(inventorySelect)
      .from(vehicles)
      .innerJoin(vehicleListings, eq(vehicleListings.vehicleId, vehicles.id))
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
