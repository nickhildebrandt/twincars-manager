import { db } from '$lib/server/db/client'
import {
  appointments,
  customers,
  vehicles,
  employees
} from '$lib/server/db/schema'
import { and, asc, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type Appointment = typeof appointments.$inferSelect
type NewAppointment = typeof appointments.$inferInsert

export type AppointmentWithRelations = Appointment & {
  customerName: string | null
  vehicleLabel: string | null
  employeeName: string | null
}

export async function listAppointments(
  params: ListParams & { from?: string; to?: string }
): Promise<ListResult<AppointmentWithRelations>> {
  const { page, size, q, from, to } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) filters.push(sql`${appointments.title} ilike ${'%' + q + '%'}`)
  if (from) filters.push(gte(appointments.startsAt, new Date(from)))
  if (to) filters.push(lte(appointments.startsAt, new Date(to)))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: appointments.id,
        title: appointments.title,
        customerId: appointments.customerId,
        vehicleId: appointments.vehicleId,
        employeeId: appointments.employeeId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        notes: appointments.notes,
        status: appointments.status,
        createdAt: appointments.createdAt,
        customerName:
          sql<string>`coalesce(${customers.company}, ${customers.lastName})`.as(
            'customer_name'
          ),
        vehicleLabel: sql<string>`${vehicles.licensePlate}`.as('vehicle_label'),
        employeeName:
          sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`.as(
            'employee_name'
          )
      })
      .from(appointments)
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .leftJoin(vehicles, eq(appointments.vehicleId, vehicles.id))
      .leftJoin(employees, eq(appointments.employeeId, employees.id))
      .where(where)
      .orderBy(asc(appointments.startsAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(appointments).where(where)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: items as AppointmentWithRelations[],
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function createAppointment(
  values: NewAppointment
): Promise<Appointment> {
  const [created] = await db.insert(appointments).values(values).returning()
  return created
}

export async function deleteAppointment(id: string): Promise<void> {
  await db.delete(appointments).where(eq(appointments.id, id))
}
