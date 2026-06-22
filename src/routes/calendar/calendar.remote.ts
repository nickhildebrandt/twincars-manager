import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  literal,
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim,
  variant
} from 'valibot'
import { idSchema, notesSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import {
  createCalendarEntry,
  deleteCalendarEntry,
  findOverlappingAppointments,
  getCalendarEntry,
  listAppointments,
  listCalendarEvents,
  updateCalendarEntry
} from '$lib/server/services/calendar-service'
import type { CalendarEntryKind } from '$lib/server/db/schema'

const isoDateSchema = pipe(string(), trim(), maxLength(10))
const dateTimeStringSchema = pipe(string(), trim(), maxLength(40))
const titleSchema = pipe(string(), trim(), maxLength(200))

/**
 * Discriminated input for `createCalendarEntryRemote`. The valibot
 * `variant` keeps each kind's invariants strictly typed:
 *
 * - `appointment`: status required, all three FK columns optional,
 *   `allDay` defaults false.
 * - `closure`: `allDay` forced `true`, `status` must be `null`, FK
 *   columns must be `null`. The form already enforces this; this
 *   schema is the server-side belt-and-braces check.
 *
 * Both branches share `title`, `startsAt`, `endsAt` (all required) and
 * `notes` (optional).
 */
const appointmentInput = object({
  kind: literal('appointment'),
  title: titleSchema,
  startsAt: dateTimeStringSchema,
  endsAt: dateTimeStringSchema,
  allDay: optional(boolean()),
  status: optional(picklist(['scheduled', 'completed', 'cancelled'])),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  employeeId: optional(idSchema),
  notes: optional(notesSchema)
})

/**
 * Closure inputs accept `status` and the three FK columns as optional
 * (they can be omitted entirely from the JSON), but the handler
 * rejects any non-empty value at runtime so the kind-discriminator
 * invariants stay enforced server-side.
 */
const closureInput = object({
  kind: literal('closure'),
  title: titleSchema,
  startsAt: dateTimeStringSchema,
  endsAt: dateTimeStringSchema,
  allDay: literal(true),
  status: optional(picklist(['scheduled', 'completed', 'cancelled'])),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  employeeId: optional(idSchema),
  notes: optional(notesSchema)
})

const createInputSchema = variant('kind', [appointmentInput, closureInput])

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  from: optional(dateTimeStringSchema),
  to: optional(dateTimeStringSchema)
})

/**
 * All calendar events overlapping `[from, to]` (YYYY-MM-DD inclusive),
 * optionally filtered by employee. Backs the month-view grid.
 *
 * @group integration
 * @module calendar
 */
export const listCalendarEventsRemote = query(
  object({
    from: isoDateSchema,
    to: isoDateSchema,
    employeeId: optional(idSchema)
  }),
  async ({ from, to, employeeId }) => {
    requirePermission('calendar')
    return listCalendarEvents(from, to, employeeId ?? null)
  }
)

/**
 * Paginated appointments list with optional date filters. Backs the
 * "Termine" table on the calendar page; closures are excluded.
 *
 * @group integration
 * @module calendar
 */
export const listAppointmentsRemote = query(listSchema, async (params) => {
  requirePermission('calendar')
  return listAppointments(params)
})

/**
 * Create a calendar entry. Discriminated by `kind`:
 *
 * - `appointment`: stores the time range as-is unless `allDay=true`,
 *   in which case the server normalises `startsAt` to 00:00:00 and
 *   `endsAt` to 23:59:59 of the date the user supplied.
 * - `closure`: always all-day. Server normalises the boundaries the
 *   same way; rejects any non-null status or FK column.
 *
 * @group integration
 * @module calendar
 */
export const createCalendarEntryRemote = command(
  createInputSchema,
  async (input) => {
    requirePermission('calendar')
    if (input.kind === 'appointment') {
      const allDay = input.allDay ?? false
      const startsAt = new Date(input.startsAt)
      const endsAt = new Date(input.endsAt)
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        error(400, 'Bitte einen gültigen Zeitraum angeben.')
      }
      if (endsAt < startsAt) {
        error(400, 'Endzeit muss nach Startzeit liegen.')
      }
      // For all-day: pin the boundaries to UTC midnight so the
      // calendar service (which buckets by UTC date) renders the
      // exact dates the user entered, regardless of server TZ.
      if (allDay) {
        const sIso = input.startsAt.slice(0, 10)
        const eIso = input.endsAt.slice(0, 10)
        startsAt.setTime(new Date(`${sIso}T00:00:00Z`).getTime())
        endsAt.setTime(new Date(`${eIso}T23:59:59Z`).getTime())
      }
      try {
        const row = await createCalendarEntry({
          kind: 'appointment',
          title: input.title,
          startsAt,
          endsAt,
          allDay,
          status: input.status ?? 'scheduled',
          customerId: input.customerId ?? null,
          vehicleId: input.vehicleId ?? null,
          employeeId: input.employeeId ?? null,
          notes: input.notes ?? null
        })
        await requested(listAppointmentsRemote, 4).refreshAll()
        return row
      } catch (e) {
        if (e instanceof Error) error(400, e.message)
        throw e
      }
    }

    // kind === 'closure'
    if (
      input.status ||
      input.customerId ||
      input.vehicleId ||
      input.employeeId
    ) {
      error(
        400,
        'Eine Betriebsschließung darf keine Verknüpfungen oder einen Status enthalten.'
      )
    }
    // UTC midnight on both sides so the calendar service buckets the
    // closure on the exact dates the user picked, regardless of TZ.
    const startsAt = new Date(`${input.startsAt}T00:00:00Z`)
    const endsAt = new Date(`${input.endsAt}T23:59:59Z`)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      error(400, 'Bitte ein gültiges Datum angeben.')
    }
    if (endsAt < startsAt) {
      error(400, 'Bis-Datum darf nicht vor dem Von-Datum liegen.')
    }
    try {
      const row = await createCalendarEntry({
        kind: 'closure',
        title: input.title,
        startsAt,
        endsAt,
        allDay: true,
        status: null,
        customerId: null,
        vehicleId: null,
        employeeId: null,
        notes: input.notes ?? null
      })
      return row
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)

/**
 * Delete any calendar entry (appointment or closure). The list is
 * refreshed only when an appointment was deleted; closures are not
 * shown in the appointments table.
 *
 * @group integration
 * @module calendar
 */
export const deleteCalendarEntryRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('calendar')
    await deleteCalendarEntry(id)
    await requested(listAppointmentsRemote, 4).refreshAll()
  }
)

/**
 * Load a single calendar entry — used by the edit page to seed its
 * form state. 404 if the id doesn't exist.
 *
 * @group integration
 * @module calendar
 */
export const getCalendarEntryRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('calendar')
    const row = await getCalendarEntry(id)
    if (!row) error(404, 'Kalendereintrag nicht gefunden.')
    return row
  }
)

/**
 * Update a calendar entry. Same discriminated input as create. The
 * `kind` cannot be changed after the fact (changing kind would mean
 * deleting + re-creating with different invariants); we ignore the
 * `kind` field on update and read the existing row's kind from the
 * DB.
 *
 * @group integration
 * @module calendar
 */
export const updateCalendarEntryRemote = command(
  object({ id: idSchema, values: createInputSchema }),
  async ({ id, values: input }) => {
    requirePermission('calendar')
    const existing = await getCalendarEntry(id)
    if (!existing) error(404, 'Kalendereintrag nicht gefunden.')
    if (existing.kind !== input.kind) {
      error(
        400,
        'Die Art eines Eintrags kann nicht nachträglich geändert werden. Bitte neu anlegen.'
      )
    }

    if (input.kind === 'appointment') {
      const allDay = input.allDay ?? false
      let startsAt = new Date(input.startsAt)
      let endsAt = new Date(input.endsAt)
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        error(400, 'Bitte einen gültigen Zeitraum angeben.')
      }
      if (endsAt < startsAt) {
        error(400, 'Endzeit muss nach Startzeit liegen.')
      }
      if (allDay) {
        const sIso = input.startsAt.slice(0, 10)
        const eIso = input.endsAt.slice(0, 10)
        startsAt = new Date(`${sIso}T00:00:00Z`)
        endsAt = new Date(`${eIso}T23:59:59Z`)
      }
      try {
        const row = await updateCalendarEntry(id, {
          title: input.title,
          startsAt,
          endsAt,
          allDay,
          status: input.status ?? 'scheduled',
          customerId: input.customerId ?? null,
          vehicleId: input.vehicleId ?? null,
          employeeId: input.employeeId ?? null,
          notes: input.notes ?? null
        })
        await requested(listAppointmentsRemote, 4).refreshAll()
        return row
      } catch (e) {
        if (e instanceof Error) error(400, e.message)
        throw e
      }
    }

    // kind === 'closure'
    if (
      input.status ||
      input.customerId ||
      input.vehicleId ||
      input.employeeId
    ) {
      error(
        400,
        'Eine Betriebsschließung darf keine Verknüpfungen oder einen Status enthalten.'
      )
    }
    const startsAt = new Date(`${input.startsAt}T00:00:00Z`)
    const endsAt = new Date(`${input.endsAt}T23:59:59Z`)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      error(400, 'Bitte ein gültiges Datum angeben.')
    }
    if (endsAt < startsAt) {
      error(400, 'Bis-Datum darf nicht vor dem Von-Datum liegen.')
    }
    try {
      const row = await updateCalendarEntry(id, {
        title: input.title,
        startsAt,
        endsAt,
        allDay: true,
        status: null,
        customerId: null,
        vehicleId: null,
        employeeId: null,
        notes: input.notes ?? null
      })
      return row
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)

/**
 * Return any existing appointments whose time window intersects the
 * candidate `[startsAt, endsAt]`. Used by the calendar form to warn —
 * NOT to refuse — when the operator is about to double-book a slot.
 *
 * @group integration
 * @module calendar
 */
export const findOverlappingAppointmentsRemote = query(
  object({
    startsAt: dateTimeStringSchema,
    endsAt: dateTimeStringSchema,
    excludeId: optional(idSchema)
  }),
  async ({ startsAt, endsAt, excludeId }) => {
    requirePermission('calendar')
    const s = new Date(startsAt)
    const e = new Date(endsAt)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      error(400, 'Bitte einen gültigen Zeitraum angeben.')
    }
    if (e <= s) {
      error(400, 'Endzeit muss nach Startzeit liegen.')
    }
    return findOverlappingAppointments(s, e, excludeId)
  }
)

export type { CalendarEntryKind }
