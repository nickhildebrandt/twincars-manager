import { command, query } from '$app/server'
import {
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema, notesSchema } from '$lib/server/db/validation'
import {
  createAppointment,
  deleteAppointment,
  listAppointments
} from '$lib/server/services/appointment-service'
import { db } from '$lib/server/db/client'
import { customers, vehicles, employees } from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'

const inputSchema = object({
  title: pipe(string(), trim(), maxLength(200)),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  employeeId: optional(idSchema),
  startsAt: pipe(string(), trim(), maxLength(40)),
  endsAt: pipe(string(), trim(), maxLength(40)),
  notes: optional(notesSchema),
  status: optional(picklist(['scheduled', 'completed', 'cancelled']))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  from: optional(pipe(string(), trim(), maxLength(40))),
  to: optional(pipe(string(), trim(), maxLength(40)))
})

/**
 * Paginated appointments list with optional date filters.
 *
 * @group integration
 * @module appointments
 */
export const listAppointmentsRemote = query(listSchema, async (params) =>
  listAppointments(params)
)

/**
 * Pickers for the appointment form.
 *
 * @group integration
 * @module appointments
 */
export const getPickersRemote = query(async () => {
  const [c, v, e] = await Promise.all([
    db
      .select({
        id: customers.id,
        label: customers.company,
        fallback: customers.lastName
      })
      .from(customers)
      .where(eq(customers.archived, false))
      .orderBy(asc(customers.lastName)),
    db
      .select({
        id: vehicles.id,
        plate: vehicles.licensePlate,
        make: vehicles.make
      })
      .from(vehicles)
      .where(eq(vehicles.archived, false))
      .orderBy(asc(vehicles.licensePlate)),
    db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName
      })
      .from(employees)
      .where(eq(employees.archived, false))
      .orderBy(asc(employees.lastName))
  ])
  return {
    customers: c.map((row) => ({
      id: row.id,
      label: row.label || row.fallback || row.id.slice(0, 8)
    })),
    vehicles: v.map((row) => ({
      id: row.id,
      label: `${row.plate ?? row.id.slice(0, 8)} (${row.make ?? '—'})`
    })),
    employees: e.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`
    }))
  }
})

/**
 * Create an appointment.
 *
 * @group integration
 * @module appointments
 */
export const createAppointmentRemote = command(inputSchema, async (values) => {
  const data = await createAppointment({
    title: values.title,
    customerId: values.customerId ?? null,
    vehicleId: values.vehicleId ?? null,
    employeeId: values.employeeId ?? null,
    startsAt: new Date(values.startsAt),
    endsAt: new Date(values.endsAt),
    notes: values.notes ?? null,
    status: values.status ?? 'scheduled'
  })
  void listAppointmentsRemote({ page: 1, size: 25 }).refresh()
  return data
})

/**
 * Delete an appointment.
 *
 * @group integration
 * @module appointments
 */
export const deleteAppointmentRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteAppointment(id)
    void listAppointmentsRemote({ page: 1, size: 25 }).refresh()
  }
)
