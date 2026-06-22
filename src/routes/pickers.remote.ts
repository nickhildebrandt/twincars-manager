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
  documents,
  vehicles,
  vehicleLicensePlateVersions,
  vehicleListings,
  vehicleSales,
  employees,
  items,
  shippingOptions,
  suppliers,
  tires
} from '$lib/server/db/schema'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL
} from 'drizzle-orm'
import { getCurrentItemPrice } from '$lib/server/services/item-service'
import { getCurrentTirePrice } from '$lib/server/services/tire-service'
import {
  requireAnyPermission,
  requirePermission
} from '$lib/server/auth-guards'

const pickerSchema = object({
  q: optional(pipe(string(), trim(), maxLength(200))),
  page: number(),
  size: picklist([10, 25, 50, 100])
})

/**
 * Items-Picker erlaubt zusätzlich einen Filter nach Artikel-Kategorie:
 * `services` = nur Leistungen (`kind='service'`),
 * `articles` = Artikel/Material/Durchlaufposten,
 * `all` (Default) = alles, was nicht ausgemustert ist.
 */
const itemsPickerSchema = object({
  q: optional(pipe(string(), trim(), maxLength(200))),
  page: number(),
  size: picklist([10, 25, 50, 100]),
  category: optional(picklist(['all', 'services', 'articles']))
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
    requirePermission('customers')
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
    requirePermission('vehicles')
    const offset = (page - 1) * size
    const filters = [eq(vehicles.archived, false)]
    if (q) {
      const term = `%${q}%`
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
        .select({
          id: vehicles.id,
          plate: lp.licensePlate,
          make: vehicles.make,
          model: vehicles.model
        })
        .from(vehicles)
        .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
        .where(where)
        .orderBy(asc(lp.licensePlate))
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
    requirePermission('employees')
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
  itemsPickerSchema,
  async ({ q, page, size, category }) => {
    requirePermission('items')
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(ilike(items.articleNumber, term), ilike(items.description, term))!
      )
    }
    if (category === 'services') {
      filters.push(eq(items.kind, 'service'))
    } else if (category === 'articles') {
      filters.push(inArray(items.kind, ['article', 'material', 'pass_through']))
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
          stockOnHand: items.stockOnHand
        })
        .from(items)
        .where(where)
        .orderBy(asc(items.articleNumber))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(items).where(where)
    ])
    // Aktuellen Preis pro Item aus `item_price_versions` ziehen.
    const out = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        label: `${r.articleNumber} — ${r.description}`,
        articleNumber: r.articleNumber,
        description: r.description,
        kind: r.kind,
        unit: r.unit ?? 'Stk',
        unitPriceNet: Number(
          (await getCurrentItemPrice(r.id))?.unitPriceNet ?? 0
        ),
        stockOnHand: r.stockOnHand
      }))
    )
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
    requirePermission('inventory')
    const offset = (page - 1) * size
    const filters = [
      eq(vehicles.archived, false),
      eq(vehicleListings.status, 'available'),
      isNull(vehicleSales.id)
    ]
    if (q) {
      const term = `%${q}%`
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
        .select({
          id: vehicles.id,
          plate: lp.licensePlate,
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
        .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
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
 * Paginated, searchable shipping-option picker. Returns only active
 * options so retired methods don't accidentally get linked from new
 * items. Label includes the net price in EUR for at-a-glance review.
 *
 * @group integration
 * @module pickers
 */
export const pickShippingOptionsRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    requirePermission('shipping')
    const offset = (page - 1) * size
    const filters = [eq(shippingOptions.active, true)]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(
          ilike(shippingOptions.name, term),
          ilike(shippingOptions.description, term)
        )!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: shippingOptions.id,
          name: shippingOptions.name,
          priceNet: shippingOptions.priceNet
        })
        .from(shippingOptions)
        .where(where)
        .orderBy(asc(shippingOptions.sortOrder), asc(shippingOptions.name))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(shippingOptions).where(where)
    ])
    const fmtEur = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    })
    const out = rows.map((r) => ({
      id: r.id,
      label: `${r.name} (${fmtEur.format(Number(r.priceNet ?? 0))})`,
      name: r.name,
      priceNet: Number(r.priceNet ?? 0)
    }))
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
    requirePermission('suppliers')
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

/**
 * Paginated, searchable document picker. Returns offers + invoices +
 * order confirmations so a time entry can link to "the document this
 * effort was spent on". Filtered by `documents.type` when a caller
 * narrows the bucket; defaults to all booking-relevant types.
 *
 * Access is satisfied by holding either the `invoices` or `offers`
 * module — both groups need the picker.
 *
 * @group integration
 * @module pickers
 */
export const pickDocumentsRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    requireAnyPermission('invoices', 'offers')
    const offset = (page - 1) * size
    const filters = [
      inArray(documents.type, [
        'invoice',
        'offer',
        'cost_estimate',
        'order_confirmation'
      ])
    ]
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(
          ilike(documents.documentNumber, term),
          ilike(customers.company, term),
          ilike(customers.lastName, term)
        )!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: documents.id,
          documentNumber: documents.documentNumber,
          type: documents.type,
          issueDate: documents.issueDate,
          customerCompany: customers.company,
          customerLastName: customers.lastName
        })
        .from(documents)
        .leftJoin(customers, eq(documents.customerId, customers.id))
        .where(where)
        .orderBy(desc(documents.issueDate), desc(documents.createdAt))
        .limit(size)
        .offset(offset),
      db
        .select({ value: count() })
        .from(documents)
        .leftJoin(customers, eq(documents.customerId, customers.id))
        .where(where)
    ])
    const typeLabel: Record<string, string> = {
      invoice: 'Rechnung',
      offer: 'Angebot',
      cost_estimate: 'Kostenvoranschlag',
      order_confirmation: 'Auftrag'
    }
    const out = rows.map((r) => {
      const cust = r.customerCompany ?? r.customerLastName
      const t = typeLabel[r.type] ?? r.type
      return {
        id: r.id,
        label: `${t} ${r.documentNumber}${cust ? ' · ' + cust : ''}`
      }
    })
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)

/**
 * Paginated, searchable tire picker. Returns full pricing + size data
 * so callers can pre-fill positions on invoices/offers.
 *
 * @group integration
 * @module pickers
 */
export const pickTiresRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    requirePermission('tires')
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (q) {
      const term = `%${q}%`
      filters.push(
        or(
          ilike(tires.articleNumber, term),
          ilike(tires.brand, term),
          ilike(tires.model, term)
        )!
      )
    }
    const where = and(...filters)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: tires.id,
          articleNumber: tires.articleNumber,
          brand: tires.brand,
          model: tires.model,
          width: tires.width,
          aspectRatio: tires.aspectRatio,
          construction: tires.construction,
          diameterInch: tires.diameterInch,
          season: tires.season,
          stockOnHand: tires.stockOnHand
        })
        .from(tires)
        .where(where)
        .orderBy(asc(tires.articleNumber))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(tires).where(where)
    ])
    const out = await Promise.all(
      rows.map(async (r) => {
        const sizeLabel = `${r.width}/${r.aspectRatio}R${r.diameterInch}`
        return {
          id: r.id,
          label: `${r.articleNumber} · ${r.brand} ${r.model} · ${sizeLabel} · ${r.season}`,
          articleNumber: r.articleNumber,
          brand: r.brand,
          model: r.model,
          width: r.width,
          aspectRatio: r.aspectRatio,
          construction: r.construction,
          diameterInch: r.diameterInch,
          sizeLabel,
          season: r.season,
          stockOnHand: r.stockOnHand,
          unitPriceNet: Number(
            (await getCurrentTirePrice(r.id))?.unitPriceNet ?? 0
          )
        }
      })
    )
    return buildResult(out, Number(totalRow[0]?.value ?? 0), page, size)
  }
)
