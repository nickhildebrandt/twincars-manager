import { command, query } from '$app/server'
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
 * Load a single vehicle by id.
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
 * Vehicle count for dashboard.
 *
 * @group integration
 * @module vehicles
 */
export const countVehiclesRemote = query(async () => countVehicles())

const toDate = (v: string | undefined): Date | null | undefined =>
  v ? new Date(v) : v === '' ? null : undefined

/**
 * Create a vehicle.
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
    void listVehiclesRemote({ page: 1, size: 25 }).refresh()
    void countVehiclesRemote().refresh()
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
    void listVehiclesRemote({ page: 1, size: 25 }).refresh()
    void getVehicleRemote({ id }).refresh()
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
    void listVehiclesRemote({ page: 1, size: 25 }).refresh()
    void countVehiclesRemote().refresh()
  }
)
