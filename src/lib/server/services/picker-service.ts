import { db } from '$lib/server/db/client'
import { customers, vehicles, items } from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'

export type Picker = { id: string; label: string }

export async function customerPickers(): Promise<Picker[]> {
  const rows = await db
    .select({
      id: customers.id,
      company: customers.company,
      lastName: customers.lastName,
      firstName: customers.firstName,
      number: customers.customerNumber
    })
    .from(customers)
    .where(eq(customers.archived, false))
    .orderBy(asc(customers.lastName), asc(customers.company))
  return rows.map((r) => ({
    id: r.id,
    label:
      r.company || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.number
  }))
}

export async function vehiclePickers(): Promise<Picker[]> {
  const rows = await db
    .select({
      id: vehicles.id,
      plate: vehicles.licensePlate,
      make: vehicles.make,
      model: vehicles.model
    })
    .from(vehicles)
    .where(eq(vehicles.archived, false))
    .orderBy(asc(vehicles.licensePlate))
  return rows.map((r) => ({
    id: r.id,
    label:
      `${r.plate ?? ''} ${[r.make, r.model].filter(Boolean).join(' ')}`.trim() ||
      r.id.slice(0, 8)
  }))
}

export async function itemPickers(): Promise<
  Array<Picker & { unit: string | null; unitPriceNet: string | null }>
> {
  const rows = await db
    .select({
      id: items.id,
      number: items.articleNumber,
      description: items.description,
      unit: items.unit,
      unitPriceNet: items.unitPriceNet
    })
    .from(items)
    .where(eq(items.discontinued, false))
    .orderBy(asc(items.articleNumber))
  return rows.map((r) => ({
    id: r.id,
    label: `${r.number} — ${r.description}`,
    unit: r.unit,
    unitPriceNet: r.unitPriceNet
  }))
}
