import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  check,
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  regex,
  string,
  transform,
  trim
} from 'valibot'
import { idSchema, notesSchema } from '$lib/server/db/validation'
import {
  createShippingOption,
  deleteShippingOption,
  getShippingOption,
  listShippingOptions,
  updateShippingOption
} from '$lib/server/services/shipping-option-service'
import { requirePermission } from '$lib/server/auth-guards'

/**
 * Money field accepted from the German UI. Either `1234`, `1234,56` or
 * `1234.56`. Stored as a normalised dot-decimal string (Drizzle numeric).
 */
const moneyStringSchema = pipe(
  string('Bitte einen Betrag eingeben.'),
  trim(),
  regex(
    /^\d+([,.]\d{1,2})?$/,
    'Bitte einen gültigen Betrag eingeben (z. B. 6,90).'
  ),
  transform((v) => v.replace(',', '.'))
)

const optionalMoneyStringSchema = optional(
  pipe(
    string(),
    trim(),
    check(
      (v) => v.length === 0 || /^\d+([,.]\d{1,2})?$/.test(v),
      'Bitte einen gültigen Betrag eingeben (z. B. 100,00).'
    ),
    transform((v) => (v.length === 0 ? null : v.replace(',', '.')))
  )
)

const shippingOptionInputSchema = object({
  name: pipe(
    string('Bitte einen Namen eingeben.'),
    trim(),
    minLength(1, 'Der Name darf nicht leer sein.'),
    maxLength(150, 'Der Name darf maximal 150 Zeichen lang sein.')
  ),
  description: optional(notesSchema),
  priceNet: moneyStringSchema,
  freeAboveNet: optionalMoneyStringSchema,
  active: boolean(),
  sortOrder: pipe(
    number(),
    integer('Bitte eine ganze Zahl eingeben.'),
    minValue(0, 'Die Reihenfolge darf nicht negativ sein.'),
    maxValue(100000, 'Die Reihenfolge ist zu groß.')
  )
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200)))
})

/**
 * Paginated shipping-options list.
 *
 * @group integration
 * @module shipping
 */
export const listShippingOptionsRemote = query(listSchema, async (params) => {
  requirePermission('shipping')
  return listShippingOptions(params)
})

/**
 * Load a single shipping option.
 *
 * @group integration
 * @module shipping
 */
export const getShippingOptionRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('shipping')
    const row = await getShippingOption(id)
    if (!row) error(404, 'Versandoption nicht gefunden.')
    return row
  }
)

/**
 * Create shipping option.
 *
 * @remarks
 * Single-flight mutation. Pass `listShippingOptionsRemote` to `.updates(...)`
 * to refresh the active list view in the same response.
 *
 * @group integration
 * @module shipping
 */
export const createShippingOptionRemote = command(
  shippingOptionInputSchema,
  async (values) => {
    requirePermission('shipping')
    const data = await createShippingOption({
      name: values.name,
      description: values.description ?? null,
      priceNet: values.priceNet,
      freeAboveNet: values.freeAboveNet ?? null,
      active: values.active,
      sortOrder: values.sortOrder
    })
    await requested(listShippingOptionsRemote, 4).refreshAll()
    return data
  }
)

/**
 * Update shipping option.
 *
 * @group integration
 * @module shipping
 */
export const updateShippingOptionRemote = command(
  object({ id: idSchema, values: shippingOptionInputSchema }),
  async ({ id, values }) => {
    requirePermission('shipping')
    const data = await updateShippingOption(id, {
      name: values.name,
      description: values.description ?? null,
      priceNet: values.priceNet,
      freeAboveNet: values.freeAboveNet ?? null,
      active: values.active,
      sortOrder: values.sortOrder
    })
    await Promise.all([
      getShippingOptionRemote({ id }).refresh(),
      requested(listShippingOptionsRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete shipping option.
 *
 * @group integration
 * @module shipping
 */
export const deleteShippingOptionRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('shipping')
    await deleteShippingOption(id)
    await requested(listShippingOptionsRemote, 4).refreshAll()
  }
)
