import { query } from '$app/server'
import {
  object,
  optional,
  pipe,
  string,
  trim,
  maxLength,
  number,
  picklist
} from 'valibot'
import { db } from '$lib/server/db/client'
import {
  customers,
  vehicles,
  vehicleListings,
  vehicleSales,
  employees,
  items,
  suppliers
} from '$lib/server/db/schema'
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'

const pickerSchema = object({
  q: optional(pipe(string(), trim(), maxLength(200))),
  page: number(),
  size: picklist([10, 25, 50, 100])
})

const buildResult = <T>(
  items: T[],
  total: number,
  page: number,
  size: number
) => ({
  items,
  total,
  page,
  size,
  pageCount: Math.max(1, Math.ceil(total / size))
})

/**
 * Paginated, searchable customer picker.
 *
 * @group integration
 * @module pickers
 */
export const pickCustomersRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    const offset = (page - 1) * size
    const filters = [eq(customers.archived, false)]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(
          ilike(customers.company, term),
          ilike(customers.lastName, term),
          ilike(customers.firstName, term),
          ilike(customers.customerNumber, term),
          ilike(customers.city, term)
        )!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: customers.id,
          company: customers.company,
          firstName: customers.firstName,
          lastName: customers.lastName,
          number: customers.customerNumber,
          city: customers.city
        })
        .from(customers)
        .where(where)
        .orderBy(asc(customers.lastName), asc(customers.company))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(customers).where(where)
    ])
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.company || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.number}${r.city ? ' · ' + r.city : ''}`
    }))
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Paginated, searchable vehicle picker.
 *
 * @group integration
 * @module pickers
 */
export const pickVehiclesRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    const offset = (page - 1) * size
    const filters = [eq(vehicles.archived, false)]
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
        .select({
          id: vehicles.id,
          plate: vehicles.licensePlate,
          make: vehicles.make,
          model: vehicles.model
        })
        .from(vehicles)
        .where(where)
        .orderBy(asc(vehicles.licensePlate))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(vehicles).where(where)
    ])
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.plate ?? '—'} · ${[r.make, r.model].filter(Boolean).join(' ') || '—'}`
    }))
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Paginated, searchable employee picker.
 *
 * @group integration
 * @module pickers
 */
export const pickEmployeesRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    const offset = (page - 1) * size
    const filters = [eq(employees.archived, false)]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(
          ilike(employees.firstName, term),
          ilike(employees.lastName, term),
          ilike(employees.personnelNumber, term)
        )!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          number: employees.personnelNumber
        })
        .from(employees)
        .where(where)
        .orderBy(asc(employees.lastName))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(employees).where(where)
    ])
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.firstName} ${r.lastName} · ${r.number}`
    }))
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Paginated, searchable item picker. Returns full pricing data so callers
 * can pre-fill positions on invoices/offers.
 *
 * @group integration
 * @module pickers
 */
export const pickItemsRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    const offset = (page - 1) * size
    const filters = [eq(items.discontinued, false)]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(ilike(items.articleNumber, term), ilike(items.description, term))!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: items.id,
          articleNumber: items.articleNumber,
          description: items.description,
          kind: items.kind,
          unit: items.unit,
          unitPriceNet: items.unitPriceNet,
          stockOnHand: items.stockOnHand
        })
        .from(items)
        .where(where)
        .orderBy(asc(items.articleNumber))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(items).where(where)
    ])
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.articleNumber} — ${r.description}`,
      articleNumber: r.articleNumber,
      description: r.description,
      kind: r.kind,
      unit: r.unit ?? 'Stk',
      unitPriceNet: Number(r.unitPriceNet ?? 0),
      stockOnHand: r.stockOnHand
    }))
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Picker for vehicles still in stock (have a listing, not yet sold).
 * Returns pricing data for invoice/offer positions.
 *
 * @group integration
 * @module pickers
 */
export const pickInventoryVehiclesRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
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
        .select({
          id: vehicles.id,
          plate: vehicles.licensePlate,
          vin: vehicles.vin,
          make: vehicles.make,
          model: vehicles.model,
          firstRegistration: vehicles.firstRegistration,
          salesPriceGross: vehicleListings.salesPriceGross,
          differentialTax: vehicleListings.differentialTax
        })
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
    const out = rows.map((r) => {
      const makeModel = [r.make, r.model].filter(Boolean).join(' ') || '—'
      const ident = r.plate ?? r.vin ?? ''
      return {
        id: r.id,
        label: `${makeModel}${ident ? ' · ' + ident : ''}`,
        plate: r.plate,
        vin: r.vin,
        make: r.make,
        model: r.model,
        firstRegistration: r.firstRegistration,
        salesPriceGross: Number(r.salesPriceGross ?? 0),
        differentialTax: r.differentialTax
      }
    })
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Paginated, searchable supplier picker.
 *
 * @group integration
 * @module pickers
 */
export const pickSuppliersRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    const offset = (page - 1) * size
    const filters = [eq(suppliers.archived, false)]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(ilike(suppliers.name, term), ilike(suppliers.city, term))!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          city: suppliers.city
        })
        .from(suppliers)
        .where(where)
        .orderBy(asc(suppliers.name))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(suppliers).where(where)
    ])
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.name}${r.city ? ' · ' + r.city : ''}`
    }))
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)
