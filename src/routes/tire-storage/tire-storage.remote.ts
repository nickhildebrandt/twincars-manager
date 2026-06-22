import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  boolean,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import {
  dateStringSchema,
  idSchema,
  notesSchema
} from '$lib/server/db/validation'
import {
  createTireStorage,
  deleteTireStorage,
  getTireStorage,
  getTireStorageIdByNumber,
  listTireStorage,
  markRetrieved,
  updateTireStorage
} from '$lib/server/services/tire-storage-service'
import { requirePermission } from '$lib/server/auth-guards'

/**
 * Photo payload — a base64 `data` blob plus the original mime type
 * and an optional caption. Capped at 8 MB per image to keep the
 * jsonb column manageable; the UI resizes before upload.
 */
const photoSchema = object({
  mime: pipe(string(), trim(), minLength(1), maxLength(64)),
  data: pipe(string(), minLength(1), maxLength(8 * 1024 * 1024)),
  caption: optional(pipe(string(), trim(), maxLength(200)))
})

const seasonSchema = picklist(['summer', 'winter', 'allseason'])

const tireStorageInputSchema = object({
  customerId: idSchema,
  vehicleId: optional(idSchema),
  brand: optional(pipe(string(), trim(), maxLength(80))),
  model: optional(pipe(string(), trim(), maxLength(120))),
  size: optional(pipe(string(), trim(), maxLength(40))),
  profileMm: optional(
    pipe(
      number('Bitte eine Zahl eingeben.'),
      minValue(0, 'Profil darf nicht negativ sein.'),
      maxValue(20, 'Profil darf höchstens 20 mm sein.')
    )
  ),
  dotYear: optional(
    pipe(
      number('Bitte eine Jahreszahl eingeben.'),
      minValue(1980, 'Jahr muss ab 1980 sein.'),
      maxValue(2100, 'Jahr darf höchstens 2100 sein.')
    )
  ),
  season: optional(seasonSchema),
  quantity: optional(
    pipe(
      number('Bitte eine Stückzahl eingeben.'),
      minValue(1, 'Mindestens 1 Reifen.'),
      maxValue(20, 'Höchstens 20 Reifen.')
    )
  ),
  photos: optional(array(photoSchema)),
  notes: optional(notesSchema),
  storedAt: optional(dateStringSchema),
  retrievedAt: optional(dateStringSchema)
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  active: optional(boolean())
})

/**
 * Coerce the validated input into the shape the service expects.
 * Drizzle's `numeric` columns serialize to string on insert when the
 * caller passes a `number`, so we hand them as strings ourselves to
 * keep round-trip values predictable.
 */
type TireStorageInput = {
  customerId: string
  vehicleId?: string
  brand?: string
  model?: string
  size?: string
  profileMm?: number
  dotYear?: number
  season?: 'summer' | 'winter' | 'allseason'
  quantity?: number
  photos?: Array<{ mime: string; data: string; caption?: string }>
  notes?: string
  storedAt?: string
  retrievedAt?: string
}

const toServiceValues = (input: TireStorageInput) => ({
  ...input,
  profileMm: input.profileMm == null ? undefined : String(input.profileMm)
})

/**
 * Paginated tire-storage list with active/retrieved filter.
 *
 * @group integration
 * @module tire-storage
 */
export const listTireStorageRemote = query(listSchema, async (params) => {
  requirePermission('tires')
  return listTireStorage({
    page: params.page,
    size: params.size,
    q: params.q,
    active: params.active
  })
})

/**
 * Load a single tire-storage entry by id. 404 if missing.
 *
 * @group integration
 * @module tire-storage
 */
export const getTireStorageRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('tires')
    const row = await getTireStorage(id)
    if (!row) error(404, 'Reifeneinlagerung nicht gefunden.')
    return row
  }
)

/**
 * Resolve a storage number (scanned from the QR label) to its entry id.
 * Used by the `/tire-storage/scan/<number>` deep link so a phone scan
 * lands on the right detail page. 404 when no entry carries the number.
 *
 * @group integration
 * @module tire-storage
 */
export const resolveTireStorageByNumberRemote = query(
  object({ number: pipe(string(), trim(), minLength(1), maxLength(50)) }),
  async ({ number }) => {
    requirePermission('tires')
    const id = await getTireStorageIdByNumber(number)
    if (!id) error(404, 'Keine Einlagerung mit dieser Nummer gefunden.')
    return { id }
  }
)

/**
 * Create a new entry. The storage number is auto-allocated server-side.
 *
 * @group integration
 * @module tire-storage
 */
export const createTireStorageRemote = command(
  tireStorageInputSchema,
  async (input) => {
    requirePermission('tires')
    const data = await createTireStorage(toServiceValues(input))
    await requested(listTireStorageRemote, 4).refreshAll()
    return data
  }
)

/**
 * Update an existing entry.
 *
 * @group integration
 * @module tire-storage
 */
export const updateTireStorageRemote = command(
  object({ id: idSchema, values: tireStorageInputSchema }),
  async ({ id, values }) => {
    requirePermission('tires')
    const data = await updateTireStorage(id, toServiceValues(values))
    await Promise.all([
      getTireStorageRemote({ id }).refresh(),
      requested(listTireStorageRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Mark an entry as retrieved (tires picked up). Defaults to today
 * when no date is given.
 *
 * @group integration
 * @module tire-storage
 */
export const markRetrievedRemote = command(
  object({ id: idSchema, date: optional(dateStringSchema) }),
  async ({ id, date }) => {
    requirePermission('tires')
    const data = await markRetrieved(id, date)
    await Promise.all([
      getTireStorageRemote({ id }).refresh(),
      requested(listTireStorageRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete an entry permanently.
 *
 * @group integration
 * @module tire-storage
 */
export const deleteTireStorageRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('tires')
    await deleteTireStorage(id)
    await requested(listTireStorageRemote, 4).refreshAll()
  }
)
