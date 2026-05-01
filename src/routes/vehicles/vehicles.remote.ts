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
 */
const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  archived: optional(picklist(['active', 'archived', 'all'])),
  stockOnly: optional(picklist(['true', 'false']))
})

/**
 * Paginated, searchable vehicle list.
 *
 * @group integration
 * @module vehicles
 */
export const listVehiclesRemote = query(listSchema, async (params) => {
  const archivedFilter =
    params.archived === 'archived'
      ? true
      : params.archived === 'active'
        ? false
        : undefined
  return listVehicles({
    page: params.page,
    size: params.size,
    q: params.q,
    archived: archivedFilter,
    stockOnly: params.stockOnly === 'true'
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
