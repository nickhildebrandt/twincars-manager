import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the global-search service. Verifies that
 * matches end up in the correct bucket with the right label / sublabel,
 * that the case-insensitive `ILIKE`-based search hits every advertised
 * column, that archived rows stay out, and that the minimum-length
 * guard returns an empty result for trivial queries.
 *
 * @group integration
 * @module search-service
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  items,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'
import { globalSearch } from './search-service'

async function resetDb() {
  await db.delete(documents)
  await db.delete(items)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(vehicles)
  await db.delete(customers)
}

async function seedCustomer(values: {
  customerNumber: string
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  city?: string | null
  archived?: boolean
}): Promise<string> {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: values.customerNumber,
      company: values.company ?? null,
      firstName: values.firstName ?? null,
      lastName: values.lastName ?? null,
      email: values.email ?? null,
      city: values.city ?? null,
      archived: values.archived ?? false
    })
    .returning({ id: customers.id })
  return row.id
}

async function seedVehicle(values: {
  make?: string | null
  model?: string | null
  vin?: string | null
  archived?: boolean
  plate?: string | null
  plateValidFrom?: string
}): Promise<string> {
  const [veh] = await db
    .insert(vehicles)
    .values({
      make: values.make ?? null,
      model: values.model ?? null,
      vin: values.vin ?? null,
      archived: values.archived ?? false
    })
    .returning({ id: vehicles.id })
  if (values.plate) {
    await db
      .insert(vehicleLicensePlateVersions)
      .values({
        vehicleId: veh.id,
        validFrom: values.plateValidFrom ?? '2024-01-01',
        licensePlate: values.plate
      })
  }
  return veh.id
}

async function seedItem(values: {
  articleNumber: string
  description: string
  kind?: string
}): Promise<string> {
  const [row] = await db
    .insert(items)
    .values({
      articleNumber: values.articleNumber,
      description: values.description,
      kind: values.kind ?? 'article'
    })
    .returning({ id: items.id })
  return row.id
}

async function seedDocument(values: {
  documentNumber: string
  type: string
  customerId?: string | null
  issueDate?: string
}): Promise<string> {
  const [row] = await db
    .insert(documents)
    .values({
      documentNumber: values.documentNumber,
      type: values.type,
      status: 'created',
      customerId: values.customerId ?? null,
      issueDate: values.issueDate ?? '2025-01-01'
    })
    .returning({ id: documents.id })
  return row.id
}

describe('search-service · globalSearch', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('returns empty buckets for queries shorter than 2 characters', async () => {
    await seedCustomer({ customerNumber: 'K-001', company: 'Alpha GmbH' })
    const res = await globalSearch('a')
    expect(res).toEqual({
      customers: [],
      vehicles: [],
      items: [],
      documents: []
    })
  })

  it('returns empty buckets for an empty / whitespace query', async () => {
    await seedCustomer({ customerNumber: 'K-001', company: 'Alpha GmbH' })
    const res = await globalSearch('   ')
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('finds customers by company / name / number / email', async () => {
    const alpha = await seedCustomer({
      customerNumber: 'K-001',
      company: 'Alpha GmbH',
      city: 'Berlin'
    })
    const beta = await seedCustomer({
      customerNumber: 'K-002',
      firstName: 'Bert',
      lastName: 'Beispiel',
      email: 'bert@example.com'
    })
    await seedCustomer({
      customerNumber: 'K-099',
      company: 'Other Co',
      archived: true
    })

    const byCompany = await globalSearch('alpha')
    expect(byCompany.customers.map((c) => c.id)).toEqual([alpha])
    expect(byCompany.customers[0].label).toBe('Alpha GmbH')
    expect(byCompany.customers[0].sublabel).toContain('K-001')
    expect(byCompany.customers[0].sublabel).toContain('Berlin')

    const byName = await globalSearch('Beispiel')
    expect(byName.customers.map((c) => c.id)).toEqual([beta])

    const byNumber = await globalSearch('K-002')
    expect(byNumber.customers.map((c) => c.id)).toEqual([beta])

    const byEmail = await globalSearch('bert@example')
    expect(byEmail.customers.map((c) => c.id)).toEqual([beta])

    // archived row is excluded
    const archivedHit = await globalSearch('Other')
    expect(archivedHit.customers).toEqual([])
  })

  it('search is case-insensitive', async () => {
    await seedCustomer({ customerNumber: 'K-001', company: 'Alpha GmbH' })
    const lower = await globalSearch('alpha')
    const upper = await globalSearch('ALPHA')
    expect(lower.customers).toHaveLength(1)
    expect(upper.customers).toHaveLength(1)
    expect(lower.customers[0].id).toBe(upper.customers[0].id)
  })

  it('finds vehicles by make / model / VIN / current license plate', async () => {
    const golf = await seedVehicle({
      make: 'VW',
      model: 'Golf',
      vin: 'WVWAA1234',
      plate: 'B-AA 100'
    })
    const bmw = await seedVehicle({
      make: 'BMW',
      model: '320i',
      vin: 'WBA9988',
      plate: 'M-XY 1'
    })
    await seedVehicle({
      make: 'Audi',
      model: 'A4',
      plate: 'F-OLD 1',
      archived: true
    })

    const byMake = await globalSearch('Golf')
    expect(byMake.vehicles.map((v) => v.id)).toEqual([golf])
    expect(byMake.vehicles[0].label).toBe('VW Golf')
    expect(byMake.vehicles[0].sublabel).toContain('B-AA 100')

    const byVin = await globalSearch('WBA99')
    expect(byVin.vehicles.map((v) => v.id)).toEqual([bmw])

    const byPlate = await globalSearch('M-XY')
    expect(byPlate.vehicles.map((v) => v.id)).toEqual([bmw])

    const archivedHit = await globalSearch('Audi')
    expect(archivedHit.vehicles).toEqual([])
  })

  it('finds items by article number or description', async () => {
    const filter = await seedItem({
      articleNumber: 'ART-0001',
      description: 'Ölfilter'
    })
    const tire = await seedItem({
      articleNumber: 'TIRE-5566',
      description: 'Sommerreifen 205/55R16'
    })

    const byNumber = await globalSearch('ART-0001')
    expect(byNumber.items.map((i) => i.id)).toEqual([filter])
    expect(byNumber.items[0].label).toBe('ART-0001 — Ölfilter')

    const byDesc = await globalSearch('Sommerreifen')
    expect(byDesc.items.map((i) => i.id)).toEqual([tire])
  })

  it('finds documents by document number; carries type for routing', async () => {
    const cust = await seedCustomer({
      customerNumber: 'K-100',
      company: 'Acme AG'
    })
    const inv = await seedDocument({
      documentNumber: 'RE-2025-001',
      type: 'invoice',
      customerId: cust
    })
    const off = await seedDocument({
      documentNumber: 'AN-2025-007',
      type: 'offer',
      customerId: cust
    })

    const re = await globalSearch('RE-2025')
    expect(re.documents.map((d) => d.id)).toEqual([inv])
    expect(re.documents[0].type).toBe('invoice')
    expect(re.documents[0].label).toBe('Rechnung RE-2025-001')
    expect(re.documents[0].sublabel).toBe('Acme AG')

    const an = await globalSearch('AN-2025')
    expect(an.documents.map((d) => d.id)).toEqual([off])
    expect(an.documents[0].type).toBe('offer')
    expect(an.documents[0].label).toBe('Angebot AN-2025-007')
  })

  it('respects the per-bucket limit', async () => {
    for (let i = 0; i < 12; i++) {
      await seedCustomer({
        customerNumber: `K-${String(i).padStart(3, '0')}`,
        company: `Sample Firma ${i}`
      })
    }
    const res = await globalSearch('Sample', 5)
    expect(res.customers).toHaveLength(5)
  })

  it('returns empty buckets when nothing matches', async () => {
    await seedCustomer({ customerNumber: 'K-001', company: 'Alpha GmbH' })
    const res = await globalSearch('zzz_nothing_matches')
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.documents).toEqual([])
  })
})
