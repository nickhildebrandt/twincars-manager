/**
 * Handler implementation for `POST /api/public/orders`.
 *
 * Books an order from the external website's checkout. Implementation
 * steps:
 *   1. Validate the JSON body via Valibot. Each line references a
 *      tire by id; non-tire products are not sold online.
 *   2. Find-or-create the customer (kind=`regular`, `wantsBroadcast`
 *      false) by email; fill in name + delivery address on create.
 *   3. For every line item, look up the current tire price; compute
 *      lineTotalNet = qty × price.
 *   4. Look up the chosen shipping option; apply `freeAboveNet` when
 *      the net total reaches the threshold.
 *   5. Compute gross with `companySettings.defaultVatRate`.
 *   6. Insert a `documents` row (`type='invoice'`, `status='draft'`)
 *      plus `document_items` rows via the existing `createDocument`
 *      helper — that keeps numbering and PDF rendering centralized.
 *   7. Return id, number, totals and an estimatedDelivery of today + 7
 *      days as an ISO date string.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import {
  array,
  integer,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  parse,
  pipe,
  string,
  trim,
  uuid,
  ValiError
} from 'valibot'
import { db } from '$lib/server/db/client'
import { customers, tires } from '$lib/server/db/schema'
import { fail, ok } from '$lib/server/public-api'
import {
  emailSchema,
  nameSchema,
  notesSchema,
  phoneSchema,
  zipSchema,
  citySchema,
  addressLineSchema
} from '$lib/server/db/validation'
import {
  createDocument,
  setDocumentStatus
} from '$lib/server/services/document-service'
import { getCurrentTirePrice } from '$lib/server/services/tire-service'
import {
  nextCustomerNumber,
  createCustomer
} from '$lib/server/services/customer-service'
import { getShippingOption } from '$lib/server/services/shipping-option-service'
import { getSettings } from '$lib/server/services/settings-service'

const lineSchema = object({
  tireId: pipe(string(), trim(), uuid('tireId must be a valid UUID.')),
  quantity: pipe(
    number(),
    integer('quantity must be an integer.'),
    minValue(1, 'quantity must be at least 1.'),
    maxValue(10_000, 'quantity is too large.')
  )
})

const deliveryAddressSchema = object({
  street: pipe(addressLineSchema, minLength(1, 'street may not be empty.')),
  zip: pipe(zipSchema, minLength(1, 'zip may not be empty.')),
  city: pipe(citySchema, minLength(1, 'city may not be empty.'))
})

const bodySchema = object({
  customerEmail: emailSchema,
  customerName: nameSchema,
  customerPhone: optional(phoneSchema),
  deliveryAddress: deliveryAddressSchema,
  shippingOptionId: pipe(
    string(),
    trim(),
    uuid('shippingOptionId must be a valid UUID.')
  ),
  lines: pipe(array(lineSchema), minLength(1, 'lines must not be empty.')),
  notes: optional(notesSchema)
})

type OrderInput = {
  customerEmail: string
  customerName: string
  customerPhone?: string
  deliveryAddress: { street: string; zip: string; city: string }
  shippingOptionId: string
  lines: Array<{ tireId: string; quantity: number }>
  notes?: string
}

const round2 = (v: number): number => Math.round(v * 100) / 100

const splitName = (
  full: string
): { firstName: string; lastName: string | null } => {
  const trimmed = full.trim()
  const space = trimmed.indexOf(' ')
  if (space < 0) return { firstName: trimmed, lastName: null }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1)
  }
}

export async function handlePublicOrder(
  event: RequestEvent
): Promise<Response> {
  let raw: unknown
  try {
    raw = await event.request.json()
  } catch {
    fail(400, 'Request body must be valid JSON.')
  }

  let input: OrderInput
  try {
    input = parse(bodySchema, raw) as OrderInput
  } catch (err) {
    if (err instanceof ValiError) {
      const first = err.issues[0]
      const path =
        first.path?.map((p: { key: unknown }) => String(p.key)).join('.') ??
        'body'
      fail(400, `Invalid "${path}": ${first.message}`)
    }
    throw err
  }

  // Resolve shipping option early so a bogus id fails before we touch
  // any other table.
  const shipping = await getShippingOption(input.shippingOptionId)
  if (!shipping || !shipping.active) {
    fail(404, 'Shipping option not found.')
  }

  // Look up each referenced tire. Every line must resolve to an
  // online-sellable tire — anything else is rejected as bad input even
  // though the JSON body otherwise validates.
  type ResolvedLine = {
    tireId: string
    articleNumber: string
    description: string
    quantity: number
    unitPriceNet: number
  }
  const resolved: ResolvedLine[] = []
  for (const line of input.lines) {
    const [row] = await db
      .select()
      .from(tires)
      .where(eq(tires.id, line.tireId))
      .limit(1)
    if (!row) {
      fail(404, `Tire ${line.tireId} not found.`)
    }
    if (!row.onlineSellable) {
      fail(400, 'Mindestens ein Artikel ist kein Online-Reifen.')
    }
    const price = await getCurrentTirePrice(row.id)
    if (!price) {
      fail(409, `Tire ${row.articleNumber} has no current price.`)
    }
    const description =
      row.description ??
      `${row.brand} ${row.model} ${row.width}/${row.aspectRatio}${row.construction}${row.diameterInch}`
    resolved.push({
      tireId: row.id,
      articleNumber: row.articleNumber,
      description,
      quantity: line.quantity,
      unitPriceNet: Number(price.unitPriceNet)
    })
  }

  // Find-or-create the customer.
  const [existingCustomer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, input.customerEmail))
    .limit(1)
  let customerId: string
  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { firstName, lastName } = splitName(input.customerName)
    const number = await nextCustomerNumber()
    const created = await createCustomer({
      customerNumber: number,
      kind: 'regular',
      wantsBroadcast: false,
      firstName,
      lastName,
      email: input.customerEmail,
      phone: input.customerPhone ?? null,
      street: input.deliveryAddress.street,
      zip: input.deliveryAddress.zip,
      city: input.deliveryAddress.city
    })
    customerId = created.id
  }

  const settings = await getSettings()
  const vatRate = Number(settings.defaultVatRate)

  const linesNet = round2(
    resolved.reduce((acc, l) => acc + l.unitPriceNet * l.quantity, 0)
  )
  const shippingNetRaw = Number(shipping.priceNet)
  const freeAbove =
    shipping.freeAboveNet == null ? null : Number(shipping.freeAboveNet)
  const shippingNet =
    freeAbove != null && linesNet >= freeAbove ? 0 : shippingNetRaw
  const totalNet = round2(linesNet + shippingNet)
  const totalGross = round2(totalNet * (1 + vatRate / 100))

  const today = new Date().toISOString().slice(0, 10)
  const docItems = resolved.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: 'Stk',
    unitPriceNet: l.unitPriceNet,
    discountPercent: 0,
    taxRate: vatRate,
    kind: 'article',
    articleNumber: l.articleNumber
  }))
  if (shippingNet > 0) {
    docItems.push({
      description: `Versand: ${shipping.name}`,
      quantity: 1,
      unit: 'Pos.',
      unitPriceNet: shippingNet,
      discountPercent: 0,
      taxRate: vatRate,
      kind: 'service',
      articleNumber: 'VERSAND'
    })
  }

  const created = await createDocument({
    type: 'invoice',
    customerId,
    issueDate: today,
    notes: [
      `Online-Bestellung`,
      `Lieferadresse: ${input.deliveryAddress.street}, ${input.deliveryAddress.zip} ${input.deliveryAddress.city}`,
      input.notes ?? null
    ]
      .filter((s): s is string => !!s)
      .join('\n'),
    items: docItems
  })
  // `createDocument` defaults to `status='created'`; flip to draft as
  // requested by the public-API spec so the operator sees orders as
  // unfinalised invoices in the admin UI.
  await setDocumentStatus(created.id, 'draft')

  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return ok({
    orderId: created.id,
    orderNumber: created.documentNumber,
    totalNet,
    totalGross,
    shippingNet,
    estimatedDelivery
  })
}
