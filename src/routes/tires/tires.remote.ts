import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  maxLength,
  maxValue,
  minLength,
  minValue,
  nullable,
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
  addTirePhoto,
  createTire,
  deleteTire,
  deleteTirePhoto,
  getTire,
  listTirePhotos,
  listTirePriceHistory,
  listTires,
  nextArticleNumber,
  setMainTirePhoto,
  updateTire,
  upsertTirePrice
} from '$lib/server/services/tire-service'
import { requirePermission } from '$lib/server/auth-guards'

const seasonSchema = picklist(['Sommer', 'Winter', 'Ganzjahres'])
const constructionSchema = picklist(['R', 'D'])
const labelLetterSchema = optional(
  pipe(
    string(),
    trim(),
    maxLength(1, 'Bitte einen einzelnen Buchstaben angeben (A–E).')
  )
)

const tireInputSchema = object({
  articleNumber: optional(pipe(string(), trim(), maxLength(50))),
  legacyArticleNumber: optional(pipe(string(), trim(), maxLength(50))),
  brand: pipe(
    string('Bitte die Marke angeben.'),
    trim(),
    minLength(1, 'Bitte die Marke angeben.'),
    maxLength(80)
  ),
  model: pipe(
    string('Bitte das Modell angeben.'),
    trim(),
    minLength(1, 'Bitte das Modell angeben.'),
    maxLength(120)
  ),
  width: pipe(
    number('Bitte die Breite in mm angeben.'),
    minValue(50, 'Die Breite ist unrealistisch klein.'),
    maxValue(500, 'Die Breite ist unrealistisch groß.')
  ),
  aspectRatio: pipe(
    number('Bitte den Querschnitt in % angeben.'),
    minValue(10, 'Der Querschnitt ist unrealistisch klein.'),
    maxValue(100, 'Der Querschnitt ist unrealistisch groß.')
  ),
  construction: optional(constructionSchema),
  diameterInch: pipe(
    number('Bitte den Felgendurchmesser angeben.'),
    minValue(8, 'Der Durchmesser ist unrealistisch klein.'),
    maxValue(30, 'Der Durchmesser ist unrealistisch groß.')
  ),
  loadIndex: optional(pipe(string(), trim(), maxLength(10))),
  speedIndex: optional(pipe(string(), trim(), maxLength(5))),
  season: seasonSchema,
  ean: optional(pipe(string(), trim(), maxLength(20))),
  manufacturerPartNumber: optional(pipe(string(), trim(), maxLength(50))),
  fuelEfficiency: labelLetterSchema,
  wetGrip: labelLetterSchema,
  noiseClass: labelLetterSchema,
  noiseDb: optional(
    pipe(
      number(),
      minValue(0, 'Geräuschwert darf nicht negativ sein.'),
      maxValue(150)
    )
  ),
  runFlat: optional(boolean()),
  reinforced: optional(boolean()),
  studdedWinter: optional(boolean()),
  mSMarking: optional(boolean()),
  snowFlake: optional(boolean()),
  evCertified: optional(boolean()),
  description: optional(pipe(string(), trim(), maxLength(1000))),
  purchasePriceNet: optional(number()),
  unitPriceNet: optional(number()),
  stockOnHand: optional(number()),
  onlineSellable: optional(boolean()),
  shippingOptionId: optional(nullable(idSchema)),
  notes: optional(notesSchema)
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  season: optional(pipe(string(), trim(), maxLength(20))),
  brand: optional(pipe(string(), trim(), maxLength(80))),
  width: optional(number()),
  aspectRatio: optional(number()),
  diameterInch: optional(number()),
  onlineSellable: optional(boolean())
})

/**
 * Paginated tire list with filters for season + size triple.
 *
 * @group integration
 * @module tires
 */
export const listTiresRemote = query(listSchema, async (params) => {
  requirePermission('tires')
  const season =
    params.season && params.season !== 'all' ? params.season : undefined
  return listTires({ ...params, season })
})

/**
 * Load a single tire.
 *
 * @group integration
 * @module tires
 */
export const getTireRemote = query(object({ id: idSchema }), async ({ id }) => {
  requirePermission('tires')
  const t = await getTire(id)
  if (!t) error(404, 'Reifen nicht gefunden.')
  return t
})

const priceHistorySchema = object({
  id: idSchema,
  page: number(),
  size: picklist([10, 25, 50, 100])
})

/**
 * Paginated price history for one tire.
 *
 * @group integration
 * @module tires
 */
export const getTirePriceHistoryRemote = query(
  priceHistorySchema,
  async ({ id, page, size }) => {
    requirePermission('tires')
    return listTirePriceHistory(id, page, size)
  }
)

const toRow = (
  v: typeof tireInputSchema.entries extends never
    ? never
    : Record<string, unknown>
) => {
  const out: Record<string, unknown> = { ...v }
  if (typeof out.unitPriceNet === 'number')
    out.unitPriceNet = String(out.unitPriceNet)
  if (typeof out.purchasePriceNet === 'number')
    out.purchasePriceNet = String(out.purchasePriceNet)
  // Drop blanks so they don't replace populated columns with empty
  // strings (the table treats `brand`/`model` as NOT NULL).
  for (const key of [
    'articleNumber',
    'legacyArticleNumber',
    'loadIndex',
    'speedIndex',
    'ean',
    'manufacturerPartNumber',
    'fuelEfficiency',
    'wetGrip',
    'noiseClass',
    'description',
    'notes'
  ]) {
    if (typeof out[key] === 'string' && (out[key] as string).length === 0) {
      out[key] = null
    }
  }
  if (!out.construction) out.construction = 'R'
  return out
}

/**
 * Create tire.
 *
 * @group integration
 * @module tires
 */
export const createTireRemote = command(tireInputSchema, async (values) => {
  requirePermission('tires')
  const articleNumber =
    values.articleNumber && values.articleNumber.length > 0
      ? values.articleNumber
      : await nextArticleNumber()
  const data = await createTire({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(toRow(values as any) as any),
    articleNumber
  })
  await requested(listTiresRemote, 4).refreshAll()
  return data
})

/**
 * Update tire.
 *
 * @group integration
 * @module tires
 */
export const updateTireRemote = command(
  object({ id: idSchema, values: tireInputSchema }),
  async ({ id, values }) => {
    requirePermission('tires')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await updateTire(id, toRow(values as any) as any)
    await Promise.all([
      getTireRemote({ id }).refresh(),
      requested(listTiresRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete tire.
 *
 * @group integration
 * @module tires
 */
export const deleteTireRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('tires')
    await deleteTire(id)
    await requested(listTiresRemote, 4).refreshAll()
  }
)

/* ── Pricing ──────────────────────────────────────────────────────── */

export const upsertTirePriceRemote = command(
  object({
    tireId: idSchema,
    validFrom: dateStringSchema,
    unitPriceNet: number()
  }),
  async ({ tireId, validFrom, unitPriceNet }) => {
    requirePermission('tires')
    const row = await upsertTirePrice({
      tireId,
      validFrom,
      unitPriceNet: String(unitPriceNet)
    })
    await Promise.all([
      getTireRemote({ id: tireId }).refresh(),
      requested(listTiresRemote, 4).refreshAll()
    ])
    return row
  }
)

/* ── Photos ──────────────────────────────────────────────────────── */

const photoSchema = object({
  tireId: idSchema,
  mime: pipe(string(), trim(), minLength(1), maxLength(50)),
  data: pipe(string(), minLength(1), maxLength(8 * 1024 * 1024))
})

export const listTirePhotosRemote = query(
  object({ tireId: idSchema }),
  async ({ tireId }) => {
    requirePermission('tires')
    return listTirePhotos(tireId)
  }
)

export const addTirePhotoRemote = command(photoSchema, async (input) => {
  requirePermission('tires')
  const row = await addTirePhoto(input)
  await listTirePhotosRemote({ tireId: input.tireId }).refresh()
  return row
})

export const setMainTirePhotoRemote = command(
  object({ id: idSchema, tireId: idSchema }),
  async ({ id, tireId }) => {
    requirePermission('tires')
    await setMainTirePhoto(id)
    await listTirePhotosRemote({ tireId }).refresh()
  }
)

export const deleteTirePhotoRemote = command(
  object({ id: idSchema, tireId: idSchema }),
  async ({ id, tireId }) => {
    requirePermission('tires')
    await deleteTirePhoto(id)
    await listTirePhotosRemote({ tireId }).refresh()
  }
)
