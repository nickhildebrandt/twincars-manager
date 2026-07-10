import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  object,
  optional,
  nullable,
  picklist,
  pipe,
  number,
  integer,
  minValue,
  maxValue,
  string,
  trim,
  maxLength
} from 'valibot'
import {
  dateStringSchema,
  hsnSchema,
  idSchema,
  licensePlateSchema,
  notesSchema,
  tsnSchema,
  vinSchema
} from '$lib/server/db/validation'
import {
  countVehicles,
  createVehicle,
  deleteVehicle,
  getVehicle,
  listLicensePlateVersions,
  listVehiclePurchases,
  listVehicles,
  purchaseVehicleIntoStock,
  recordVehiclePurchase,
  setVehicleArchived,
  updateVehicle
} from '$lib/server/services/vehicle-service'
import { listInventoryRemote } from '../inventory/inventory.remote'
import {
  addVehiclePhoto,
  deleteVehiclePhoto,
  listVehiclePhotos,
  setMainVehiclePhoto
} from '$lib/server/services/vehicle-photo-service'
import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  vehicles,
  vehicleSales,
  workOrders
} from '$lib/server/db/schema'
import { and, count as sqlCount, desc, eq } from 'drizzle-orm'
import {
  requireAnyPermission,
  requirePermission
} from '$lib/server/auth-guards'
import { customerDisplayName } from '$lib/utils/picker-labels'

/**
 * Field shape shared by `createVehicleRemote` and
 * `updateVehicleRemote`. Numeric fields are bounded to fit Postgres `int`
 * (max 2_147_483_647) plus business-realistic ceilings.
 */
const vehicleInputShape = {
  customerId: optional(idSchema),
  /**
   * Optional Vorbesitzer relation (mainly stock vehicles: the customer
   * the car was bought from). An explicit `null` clears the relation
   * on update; omitting the key leaves it untouched.
   */
  previousOwnerCustomerId: optional(nullable(idSchema)),
  make: optional(pipe(string(), trim(), maxLength(100))),
  model: optional(pipe(string(), trim(), maxLength(150))),
  licensePlate: optional(licensePlateSchema),
  vin: optional(vinSchema),
  firstRegistration: optional(pipe(string(), trim(), maxLength(10))),
  mileageKm: optional(
    pipe(number(), integer(), minValue(0), maxValue(9_999_999))
  ),
  nextHu: optional(pipe(string(), trim(), maxLength(10))),
  nextAu: optional(pipe(string(), trim(), maxLength(10))),
  hsn: optional(hsnSchema),
  tsn: optional(tsnSchema),
  displacementCcm: optional(
    pipe(number(), integer(), minValue(0), maxValue(99_999))
  ),
  powerKw: optional(pipe(number(), integer(), minValue(0), maxValue(9_999))),
  colorCode: optional(pipe(string(), trim(), maxLength(30))),
  engineNumber: optional(pipe(string(), trim(), maxLength(50))),
  fuelType: optional(pipe(string(), trim(), maxLength(30))),
  gearbox: optional(pipe(string(), trim(), maxLength(30))),
  bodyType: optional(pipe(string(), trim(), maxLength(50))),
  notes: optional(notesSchema)
}

const vehicleInputSchema = object(vehicleInputShape)

/**
 * Ankaufspreis: the gross amount actually paid for the vehicle
 * (used-car purchases from private sellers carry no deductible input
 * VAT under § 25a UStG, so brutto is the canonical semantics of
 * `vehicle_purchases.purchase_price`).
 */
const purchasePriceSchema = pipe(
  number('Bitte einen Ankaufspreis eingeben.'),
  minValue(0, 'Der Ankaufspreis darf nicht negativ sein.'),
  maxValue(1_000_000_000, 'Der Ankaufspreis ist zu groß.')
)

/**
 * Create-only schema: the base vehicle fields plus optional Ankauf
 * data. `/inventory/new` always sends `purchaseDate` (defaulted to
 * today), which triggers a `vehicle_purchases` history row after the
 * vehicle insert; `/vehicles/new` never sends the purchase fields.
 * Both fields are optional — they never block creation.
 */
const createVehicleSchema = object({
  ...vehicleInputShape,
  purchasePrice: optional(purchasePriceSchema),
  purchaseDate: optional(dateStringSchema)
})

/**
 * Schema for the paginated vehicle list query.
 *
 * `kind` defaults to `'customer'` so `/vehicles` only ever shows
 * customer-owned cars; stock vehicles live in `/inventory` and are
 * fetched via `listInventoryRemote`. Pickers that span both kinds
 * pass `kind: 'all'`.
 */
const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  kind: optional(picklist(['customer', 'stock', 'all'])),
  archived: optional(picklist(['active', 'archived']))
})

/**
 * Paginated, searchable customer-vehicle list. Stock vehicles
 * (customer_id IS NULL) are filtered out by default. `archived`
 * defaults to `'active'`; `'archived'` switches to the archive view,
 * which spans both kinds (the `kind` filter is ignored there).
 *
 * @group integration
 * @module vehicles
 */
export const listVehiclesRemote = query(listSchema, async (params) => {
  requirePermission('vehicles')
  return listVehicles({
    page: params.page,
    size: params.size,
    q: params.q,
    kind: params.kind ?? 'customer',
    archived: params.archived === 'archived'
  })
})

/**
 * Load a single vehicle by id. Throws `404` if not found.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('vehicles')
    const v = await getVehicle(id)
    if (!v) error(404, 'Fahrzeug nicht gefunden.')
    return v
  }
)

/**
 * Total vehicle count for the dashboard.
 *
 * @group integration
 * @module vehicles
 */
export const countVehiclesRemote = query(async () => {
  requirePermission('vehicles')
  return countVehicles()
})

/**
 * Vehicle detail enrichment — owner + paginated invoices in one
 * round-trip, mirroring `getCustomerRelatedRemote` on the customers
 * side. Pagination is fixed at 25 (project rule); only the page
 * number is reactive.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleRelatedRemote = query(
  object({ id: idSchema, invoicesPage: number() }),
  async ({ id, invoicesPage }) => {
    requirePermission('vehicles')
    const size = 25
    const offset = Math.max(0, (invoicesPage - 1) * size)
    const where = and(
      eq(documents.vehicleId, id),
      eq(documents.type, 'invoice')
    )

    const [vehicleRows, invoiceRows, totalRows] = await Promise.all([
      // Inner join via the vehicle table so we only get the owner row.
      // A NULL customer_id (stock vehicle) returns no rows -> customer = null.
      db
        .select({
          customerId: customers.id,
          customerNumber: customers.customerNumber,
          firstName: customers.firstName,
          lastName: customers.lastName,
          company: customers.company,
          phone: customers.phone,
          email: customers.email
        })
        .from(customers)
        .innerJoin(vehicles, eq(customers.id, vehicles.customerId))
        .where(eq(vehicles.id, id))
        .limit(1),
      db
        .select({
          id: documents.id,
          documentNumber: documents.documentNumber,
          status: documents.status,
          issueDate: documents.issueDate,
          dueDate: documents.dueDate,
          grossTotal: documents.grossTotal
        })
        .from(documents)
        .where(where)
        .orderBy(desc(documents.issueDate))
        .limit(size)
        .offset(offset),
      db.select({ value: sqlCount() }).from(documents).where(where)
    ])

    const customer = vehicleRows[0] ?? null
    const total = Number(totalRows[0]?.value ?? 0)
    return {
      customer,
      invoices: {
        items: invoiceRows,
        total,
        page: invoicesPage,
        size,
        pageCount: Math.max(1, Math.ceil(total / size))
      }
    }
  }
)

/**
 * Paginated work orders of one vehicle (Aufträge tab on the detail
 * page). Mirrors the invoices block in `getVehicleRelatedRemote`:
 * fixed size 25, only the page number is reactive. Guarded with
 * ANY of `vehicles` / `orders` — the shop floor (orders-only) may
 * inspect a vehicle's order history, and vehicle-permission holders
 * see the tab without needing the orders module (same pattern as
 * `pickEmployeesRemote`).
 *
 * @group integration
 * @module vehicles
 */
export const listVehicleWorkOrdersRemote = query(
  object({ id: idSchema, page: number() }),
  async ({ id, page }) => {
    requireAnyPermission('vehicles', 'orders')
    const size = 25
    const offset = Math.max(0, (page - 1) * size)
    const where = eq(workOrders.vehicleId, id)

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: workOrders.id,
          orderNumber: workOrders.orderNumber,
          title: workOrders.title,
          status: workOrders.status,
          scheduledDate: workOrders.scheduledDate,
          scheduledTime: workOrders.scheduledTime,
          completedAt: workOrders.completedAt
        })
        .from(workOrders)
        .where(where)
        .orderBy(desc(workOrders.createdAt))
        .limit(size)
        .offset(offset),
      db.select({ value: sqlCount() }).from(workOrders).where(where)
    ])

    const total = Number(totalRows[0]?.value ?? 0)
    return {
      items: rows,
      total,
      page,
      size,
      pageCount: Math.max(1, Math.ceil(total / size))
    }
  }
)

/** One row of the vehicle Historie tab (Ankauf / Verkauf / Kennzeichen). */
export type VehicleHistoryEvent = {
  /** Stable key — kind-prefixed source row id. */
  id: string
  kind: 'purchase' | 'sale' | 'plate'
  /** ISO date the event applies to (Ankaufs-/Verkaufsdatum, valid_from). */
  date: string
  /** Gross amount for purchase/sale rows, `null` for plate changes. */
  amount: string | null
  /**
   * Counterpart display name: rename-proof `previous_owner` snapshot
   * for purchases, the buyer's current display name for sales.
   */
  counterpartLabel: string | null
  /** Buyer link target for sale rows whose customer still exists. */
  customerId: string | null
  /** Plate value for `kind = 'plate'` rows. */
  licensePlate: string | null
}

/**
 * Ownership + plate history of a vehicle, merged from
 * `vehicle_purchases` (Ankauf), `vehicle_sales` (Verkauf) and
 * `vehicle_license_plate_versions`, sorted newest first. The list is
 * bounded by real-world ownership cycles (a handful of rows), so it is
 * deliberately unpaginated.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleHistoryRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('vehicles')
    const [purchases, sales, plates] = await Promise.all([
      listVehiclePurchases(id),
      db
        .select({
          id: vehicleSales.id,
          saleDate: vehicleSales.saleDate,
          salesPriceGross: vehicleSales.salesPriceGross,
          createdAt: vehicleSales.createdAt,
          customerId: vehicleSales.customerId,
          buyerCompany: customers.company,
          buyerFirstName: customers.firstName,
          buyerLastName: customers.lastName,
          buyerNumber: customers.customerNumber
        })
        .from(vehicleSales)
        .leftJoin(customers, eq(vehicleSales.customerId, customers.id))
        .where(eq(vehicleSales.vehicleId, id)),
      listLicensePlateVersions(id)
    ])

    // `sortKey` (row creation time) breaks same-day ties so an Ankauf
    // and a later re-sale on one day keep their true order.
    type Sortable = VehicleHistoryEvent & { sortKey: number }
    const events: Sortable[] = [
      ...purchases.map(
        (p): Sortable => ({
          id: `purchase-${p.id}`,
          kind: 'purchase',
          date: p.purchaseDate,
          amount: p.purchasePrice,
          counterpartLabel: p.previousOwner,
          customerId: null,
          licensePlate: null,
          sortKey: p.createdAt.getTime()
        })
      ),
      ...sales.map((s): Sortable => {
        const buyerLabel = customerDisplayName({
          company: s.buyerCompany,
          firstName: s.buyerFirstName,
          lastName: s.buyerLastName,
          customerNumber: s.buyerNumber
        })
        return {
          id: `sale-${s.id}`,
          kind: 'sale',
          date: s.saleDate,
          amount: s.salesPriceGross,
          counterpartLabel: buyerLabel,
          // Link only while the buyer row still exists (left join miss
          // → label parts are all null).
          customerId: buyerLabel !== null ? s.customerId : null,
          licensePlate: null,
          sortKey: s.createdAt.getTime()
        }
      }),
      ...plates.map(
        (pl): Sortable => ({
          id: `plate-${pl.id}`,
          kind: 'plate',
          date: pl.validFrom,
          amount: null,
          counterpartLabel: null,
          customerId: null,
          licensePlate: pl.licensePlate,
          sortKey: pl.createdAt.getTime()
        })
      )
    ]
    events.sort((a, b) => b.date.localeCompare(a.date) || b.sortKey - a.sortKey)
    return events.map(
      ({ sortKey: _sortKey, ...event }): VehicleHistoryEvent => event
    )
  }
)

/**
 * Refresh the dashboard count plus every list instance the client requested
 * via `.updates(listVehiclesRemote)`. Caps at 4 instances per request.
 */
const refreshListsAndCount = async (): Promise<void> => {
  await Promise.all([
    countVehiclesRemote().refresh(),
    requested(listVehiclesRemote, 4).refreshAll()
  ])
}

/**
 * Create a vehicle.
 *
 * When the payload carries `purchaseDate` (stock creations from
 * `/inventory/new`), a `vehicle_purchases` history row is written
 * right after the insert — with the picked Vorbesitzer's display name
 * as a rename-proof snapshot and `purchasePrice` defaulting to
 * `'0.00'` when not provided.
 *
 * @remarks
 * Single-flight mutation. Pass `listVehiclesRemote` to `.updates(...)` on the
 * client to refresh the current view inside the same response.
 *
 * @group integration
 * @module vehicles
 */
export const createVehicleRemote = command(
  createVehicleSchema,
  async (input) => {
    requirePermission('vehicles')
    const { purchasePrice, purchaseDate, ...vehicleInput } = input
    const data = await createVehicle({
      ...vehicleInput,
      firstRegistration: vehicleInput.firstRegistration ?? null,
      nextHu: vehicleInput.nextHu ?? null,
      nextAu: vehicleInput.nextAu ?? null
    } as never)
    if (purchaseDate) {
      await recordVehiclePurchase({
        vehicleId: data.id,
        purchaseDate,
        purchasePrice,
        previousOwnerCustomerId: vehicleInput.previousOwnerCustomerId ?? null
      })
    }
    await refreshListsAndCount()
    return data
  }
)

/**
 * Update a vehicle.
 *
 * @group integration
 * @module vehicles
 */
export const updateVehicleRemote = command(
  object({ id: idSchema, values: vehicleInputSchema }),
  async ({ id, values }) => {
    requirePermission('vehicles')
    const data = await updateVehicle(id, values as never)
    await Promise.all([
      getVehicleRemote({ id }).refresh(),
      refreshListsAndCount()
    ])
    return data
  }
)

/**
 * Delete a vehicle. Refuses with a curated 409 while documents, work
 * orders or tire storage still link to the vehicle (see
 * `deleteVehicle`); archiving is the soft path for those.
 *
 * @group integration
 * @module vehicles
 */
export const deleteVehicleRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('vehicles')
    await deleteVehicle(id)
    await refreshListsAndCount()
  }
)

/**
 * Archive or reactivate a vehicle (soft delete). The sanctioned path
 * for vehicles the delete guard refuses. Refreshes the detail query,
 * the vehicle lists + count and the inventory list — an archived stock
 * car must drop out of the Verkaufsbestand in the same flight.
 *
 * @group integration
 * @module vehicles
 */
export const setVehicleArchivedRemote = command(
  object({ id: idSchema, archived: boolean() }),
  async ({ id, archived }) => {
    requirePermission('vehicles')
    const data = await setVehicleArchived(id, archived)
    await Promise.all([
      getVehicleRemote({ id }).refresh(),
      refreshListsAndCount(),
      requested(listInventoryRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Ankauf: take an existing CUSTOMER vehicle into the sales stock.
 * The current owner becomes the Vorbesitzer, `customer_id` is
 * cleared, and a `vehicle_purchases` history row records the deal
 * (price defaults to `'0.00'` when unknown). Requires the
 * `inventory` permission — buying into stock is an inventory
 * operation, not vehicle master-data editing.
 *
 * Refreshes the detail queries plus the vehicle/inventory lists the
 * client holds, so the detail page flips to Verkaufsbestand in the
 * same flight.
 *
 * @group integration
 * @module vehicles
 */
export const purchaseVehicleIntoStockRemote = command(
  object({
    id: idSchema,
    purchaseDate: dateStringSchema,
    purchasePrice: optional(purchasePriceSchema),
    notes: optional(notesSchema)
  }),
  async ({ id, purchaseDate, purchasePrice, notes }) => {
    requirePermission('inventory')
    const vehicle = await purchaseVehicleIntoStock({
      vehicleId: id,
      purchaseDate,
      purchasePrice,
      notes
    })
    // requested(...) only refreshes instances the CLIENT holds — the
    // detail page tracks getVehicleRemote({ id }) and its related
    // query, so both flip in the same flight. A hypothetical
    // inventory-only caller (no `vehicles` read) never holds them and
    // therefore never trips their guards here.
    await Promise.all([
      requested(getVehicleRemote, 4).refreshAll(),
      requested(getVehicleRelatedRemote, 4).refreshAll(),
      requested(getVehicleHistoryRemote, 4).refreshAll(),
      requested(listVehiclesRemote, 4).refreshAll(),
      requested(listInventoryRemote, 4).refreshAll()
    ])
    return vehicle
  }
)

/* ─── Photos ──────────────────────────────────────────────────────── */

/**
 * List all photos attached to a vehicle, ordered by sort order then
 * creation date. Cover image (`isMain: true`) is included in the rows.
 *
 * @group integration
 * @module vehicles
 */
export const listVehiclePhotosRemote = query(
  object({ vehicleId: idSchema }),
  async ({ vehicleId }) => {
    requirePermission('vehicles')
    return listVehiclePhotos(vehicleId)
  }
)

/**
 * Append a photo as a base64 data URL. The first photo on a vehicle
 * gets promoted to cover automatically — the service handles that.
 *
 * @group integration
 * @module vehicles
 */
export const addVehiclePhotoRemote = command(
  object({
    vehicleId: idSchema,
    mime: pipe(string(), trim(), maxLength(50)),
    // 20 MB binary → ~28 MB base64 data URL (4/3 overhead + `data:…`
    // prefix). Cap raised to 28 MB to allow proper 20 MB photos.
    dataUrl: pipe(string(), maxLength(28_000_000))
  }),
  async (input) => {
    requirePermission('vehicles')
    const row = await addVehiclePhoto(input)
    await listVehiclePhotosRemote({ vehicleId: input.vehicleId }).refresh()
    return row
  }
)

/**
 * Remove a photo. If the cover gets removed, the next photo is
 * promoted automatically so the vehicle never ends up cover-less.
 *
 * @group integration
 * @module vehicles
 */
export const deleteVehiclePhotoRemote = command(
  object({ id: idSchema, vehicleId: idSchema }),
  async ({ id, vehicleId }) => {
    requirePermission('vehicles')
    await deleteVehiclePhoto(id)
    await listVehiclePhotosRemote({ vehicleId }).refresh()
  }
)

/**
 * Promote a photo to cover (`isMain: true`) — clears the flag on all
 * other photos of the same vehicle in the same transaction.
 *
 * @group integration
 * @module vehicles
 */
export const setMainVehiclePhotoRemote = command(
  object({ id: idSchema, vehicleId: idSchema }),
  async ({ id, vehicleId }) => {
    requirePermission('vehicles')
    await setMainVehiclePhoto(id)
    await listVehiclePhotosRemote({ vehicleId }).refresh()
  }
)
