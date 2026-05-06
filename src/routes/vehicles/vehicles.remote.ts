import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  object,
  optional,
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
import { idSchema, notesSchema } from '$lib/server/db/validation'
import {
  countVehicles,
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  updateVehicle
} from '$lib/server/services/vehicle-service'
import {
  addVehiclePhoto,
  deleteVehiclePhoto,
  listVehiclePhotos,
  setMainVehiclePhoto
} from '$lib/server/services/vehicle-photo-service'
import { db } from '$lib/server/db/client'
import { customers, documents, vehicles } from '$lib/server/db/schema'
import { and, count as sqlCount, desc, eq } from 'drizzle-orm'

/**
 * Validation schema shared by `createVehicleRemote` and
 * `updateVehicleRemote`. Numeric fields are bounded to fit Postgres `int`
 * (max 2_147_483_647) plus business-realistic ceilings.
 */
const vehicleInputSchema = object({
  customerId: optional(idSchema),
  make: optional(pipe(string(), trim(), maxLength(100))),
  model: optional(pipe(string(), trim(), maxLength(150))),
  licensePlate: optional(pipe(string(), trim(), maxLength(20))),
  vin: optional(pipe(string(), trim(), maxLength(25))),
  firstRegistration: optional(pipe(string(), trim(), maxLength(10))),
  mileageKm: optional(
    pipe(number(), integer(), minValue(0), maxValue(9_999_999))
  ),
  nextHu: optional(pipe(string(), trim(), maxLength(10))),
  nextAu: optional(pipe(string(), trim(), maxLength(10))),
  hsn: optional(pipe(string(), trim(), maxLength(10))),
  tsn: optional(pipe(string(), trim(), maxLength(10))),
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
  kind: optional(picklist(['customer', 'stock', 'all']))
})

/**
 * Paginated, searchable customer-vehicle list. Stock vehicles
 * (customer_id IS NULL) are filtered out by default.
 *
 * @group integration
 * @module vehicles
 */
export const listVehiclesRemote = query(listSchema, async (params) =>
  listVehicles({
    page: params.page,
    size: params.size,
    q: params.q,
    kind: params.kind ?? 'customer'
  })
)

/**
 * Load a single vehicle by id. Throws `404` if not found.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
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
export const countVehiclesRemote = query(async () => countVehicles())

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
 * @remarks
 * Single-flight mutation. Pass `listVehiclesRemote` to `.updates(...)` on the
 * client to refresh the current view inside the same response.
 *
 * @group integration
 * @module vehicles
 */
export const createVehicleRemote = command(
  vehicleInputSchema,
  async (input) => {
    const data = await createVehicle({
      ...input,
      firstRegistration: input.firstRegistration ?? null,
      nextHu: input.nextHu ?? null,
      nextAu: input.nextAu ?? null
    } as never)
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
    const data = await updateVehicle(id, values as never)
    await Promise.all([
      getVehicleRemote({ id }).refresh(),
      refreshListsAndCount()
    ])
    return data
  }
)

/**
 * Delete a vehicle.
 *
 * @group integration
 * @module vehicles
 */
export const deleteVehicleRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteVehicle(id)
    await refreshListsAndCount()
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
  async ({ vehicleId }) => listVehiclePhotos(vehicleId)
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
    await setMainVehiclePhoto(id)
    await listVehiclePhotosRemote({ vehicleId }).refresh()
  }
)
