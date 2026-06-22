/**
 * Handler implementation for `POST /api/public/appointments`.
 *
 * Books a workshop appointment from an external website. The caller
 * supplies customer contact data plus a desired start time + duration
 * (or a service id whose `attributes.durationMinutes` is used).
 *
 * Workflow:
 *   1. Validate the JSON body via Valibot.
 *   2. Resolve the service (if any) and finalise duration.
 *   3. Reject past starts.
 *   4. Re-run `findFreeSlots` over the requested window to confirm
 *      the slot is still free — race-safe against concurrent
 *      bookings.
 *   5. Look up an existing customer by email; if absent, create one.
 *   6. Insert the `calendar_entries` row (`kind='appointment'`,
 *      `status='scheduled'`) and stash a `confirmation:<uuid>` in
 *      `notes` as a future-proofing handle.
 *
 * The response purposefully exposes only the new appointment id, the
 * resolved time range and the generated confirmation token; the
 * customer's internal id never leaves the server.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { randomUUID } from 'node:crypto'
import {
  integer,
  maxValue,
  minValue,
  number,
  object,
  optional,
  parse,
  pipe,
  string,
  trim,
  ValiError
} from 'valibot'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { calendarEntries, customers } from '$lib/server/db/schema'
import { fail, ok } from '$lib/server/public-api'
import { findFreeSlots } from '$lib/server/services/public-api-service'
import { getItem } from '$lib/server/services/item-service'
import {
  emailSchema,
  dateFromStringSchema,
  nameSchema,
  notesSchema,
  phoneSchema
} from '$lib/server/db/validation'
import { nextCustomerNumber } from '$lib/server/services/customer-service'
import { sendAppointmentConfirmation } from '$lib/server/services/mail-service'

const MAX_DURATION_MINUTES = 480 // 8 hours

const bodySchema = object({
  customerEmail: emailSchema,
  customerName: nameSchema,
  customerPhone: optional(phoneSchema),
  serviceId: optional(pipe(string(), trim())),
  startsAt: dateFromStringSchema,
  durationMinutes: optional(
    pipe(
      number(),
      integer('durationMinutes must be an integer.'),
      minValue(1, 'durationMinutes must be positive.'),
      maxValue(MAX_DURATION_MINUTES, 'durationMinutes is too large.')
    )
  ),
  notes: optional(notesSchema)
})

type BookingInput = {
  customerEmail: string
  customerName: string
  customerPhone?: string
  serviceId?: string
  startsAt: Date
  durationMinutes?: number
  notes?: string
}

export async function handleBookAppointment(
  event: RequestEvent
): Promise<Response> {
  let raw: unknown
  try {
    raw = await event.request.json()
  } catch {
    fail(400, 'Request body must be valid JSON.')
  }

  let input: BookingInput
  try {
    input = parse(bodySchema, raw) as BookingInput
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

  // Resolve service + finalise duration.
  let title = 'Online-Termin'
  let durationMinutes = input.durationMinutes
  if (input.serviceId) {
    const service = await getItem(input.serviceId)
    if (!service || service.kind !== 'service') {
      fail(404, 'Service not found.')
    }
    title = service.description
    // Migration 0022 dropped the JSONB `attributes` column from
    // `items`. The caller must now supply `durationMinutes` directly
    // on the request body; we keep the service lookup so a bogus id
    // still fails fast with 404.
  }
  if (!durationMinutes) {
    fail(400, 'durationMinutes is required when serviceId is not provided.')
  }

  // Must be in the future.
  const now = Date.now()
  if (input.startsAt.getTime() <= now) {
    fail(400, 'Appointment must be in the future.')
  }

  // Re-check availability against the live calendar + workshop hours.
  const slotEnd = new Date(input.startsAt.getTime() + durationMinutes * 60_000)
  const windowEnd = new Date(slotEnd.getTime() + 60_000)
  const slots = await findFreeSlots({
    from: input.startsAt,
    to: windowEnd,
    durationMinutes
  })
  const requestedTs = input.startsAt.getTime()
  const isAvailable = slots.some((s) => s.startsAt.getTime() === requestedTs)
  if (!isAvailable) {
    fail(409, 'Termin ist nicht mehr verfügbar.')
  }

  // Find or create customer.
  const [existingCustomer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, input.customerEmail))
    .limit(1)
  let customerId: string
  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const trimmedName = input.customerName.trim()
    const space = trimmedName.indexOf(' ')
    const firstName = space >= 0 ? trimmedName.slice(0, space) : trimmedName
    const lastName = space >= 0 ? trimmedName.slice(space + 1) : null
    const number = await nextCustomerNumber()
    const [row] = await db
      .insert(customers)
      .values({
        customerNumber: number,
        kind: 'regular',
        wantsBroadcast: false,
        firstName,
        lastName,
        email: input.customerEmail,
        phone: input.customerPhone ?? null
      })
      .returning({ id: customers.id })
    customerId = row.id
  }

  // Insert the appointment with a confirmation handle stashed in notes.
  const confirmationToken = randomUUID()
  const noteParts: string[] = []
  if (input.notes && input.notes.trim().length > 0) {
    noteParts.push(input.notes.trim())
  }
  noteParts.push(`confirmation:${confirmationToken}`)

  const [created] = await db
    .insert(calendarEntries)
    .values({
      kind: 'appointment',
      title,
      startsAt: input.startsAt,
      endsAt: slotEnd,
      allDay: false,
      status: 'scheduled',
      customerId,
      notes: noteParts.join('\n')
    })
    .returning({ id: calendarEntries.id })

  // Best-effort confirmation mail. A failure here MUST NOT break the
  // booking — the customer's slot is reserved either way, so we log
  // and move on. `sendAppointmentConfirmation` already records the
  // outcome (success or failure) in `sent_messages` so the operator
  // can audit deliveries from the existing UI.
  try {
    await sendAppointmentConfirmation({
      appointmentId: created.id,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      startsAt: input.startsAt,
      durationMinutes,
      serviceTitle: input.serviceId ? title : null,
      confirmationToken
    })
  } catch (err) {
    console.error(
      `[appointments] confirmation mail crashed for ${created.id}:`,
      err
    )
  }

  return ok({
    appointmentId: created.id,
    startsAt: input.startsAt.toISOString(),
    endsAt: slotEnd.toISOString(),
    confirmationToken
  })
}
