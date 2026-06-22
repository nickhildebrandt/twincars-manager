import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  items,
  suppliers,
  tireStorage,
  tires,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'
import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm'

/**
 * One hit in a global search bucket. `label` is the primary display
 * line, `sublabel` an optional secondary (smaller, dimmer) line.
 *
 * `type` is set on the document bucket so the client can pick the
 * correct detail route (offers vs. invoices vs. credit notes etc.).
 */
export type SearchHit = {
  id: string
  label: string
  sublabel?: string
  type?: string
}

/**
 * Shape of the global search response — one bucket per entity type.
 * Bucket arrays are always present (possibly empty) so the client can
 * render section headers without `?.`-guarding every access.
 */
export type GlobalSearchResult = {
  customers: SearchHit[]
  vehicles: SearchHit[]
  items: SearchHit[]
  tires: SearchHit[]
  tireStorage: SearchHit[]
  suppliers: SearchHit[]
  documents: SearchHit[]
}

const empty = (): GlobalSearchResult => ({
  customers: [],
  vehicles: [],
  items: [],
  tires: [],
  tireStorage: [],
  suppliers: [],
  documents: []
})

/**
 * Skip-on-empty / minimum-length filter. The picker pattern across the
 * app debounces user input and only fires a search once at least two
 * characters are present — global search follows the same contract so
 * the dropdown isn't deluged on the first keystroke.
 */
const MIN_QUERY = 2

const typeLabel: Record<string, string> = {
  invoice: 'Rechnung',
  offer: 'Angebot',
  cost_estimate: 'Kostenvoranschlag',
  order_confirmation: 'Auftrag',
  credit_note: 'Gutschrift'
}

/**
 * Free-text search across all major entities. Each bucket runs a
 * single `ILIKE`-on-canonical-search-columns query, capped at
 * `perBucket` rows, ordered deterministically by the most useful
 * sort key for that entity. Empty / too-short queries short-circuit
 * to an empty result.
 *
 * The caller (the `globalSearchRemote` query) is responsible for
 * dropping buckets the current user has no read permission for.
 *
 * @group integration
 * @module search-service
 */
export async function globalSearch(
  q: string,
  perBucket = 8
): Promise<GlobalSearchResult> {
  const trimmed = q.trim()
  if (trimmed.length < MIN_QUERY) return empty()
  const term = `%${trimmed}%`

  const [
    customerRows,
    vehicleRows,
    itemRows,
    tireRows,
    tireStorageRows,
    supplierRows,
    documentRows
  ] = await Promise.all([
    searchCustomers(term, perBucket),
    searchVehicles(term, perBucket),
    searchItems(term, perBucket),
    searchTires(term, perBucket),
    searchTireStorage(term, perBucket),
    searchSuppliers(term, perBucket),
    searchDocuments(term, perBucket)
  ])
  return {
    customers: customerRows,
    vehicles: vehicleRows,
    items: itemRows,
    tires: tireRows,
    tireStorage: tireStorageRows,
    suppliers: supplierRows,
    documents: documentRows
  }
}

async function searchCustomers(
  term: string,
  limit: number
): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: customers.id,
      number: customers.customerNumber,
      company: customers.company,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      city: customers.city
    })
    .from(customers)
    .where(
      and(
        eq(customers.archived, false),
        or(
          ilike(customers.company, term),
          ilike(customers.lastName, term),
          ilike(customers.firstName, term),
          ilike(customers.customerNumber, term),
          ilike(customers.email, term)
        )!
      )
    )
    .orderBy(asc(customers.lastName), asc(customers.company))
    .limit(limit)
  return rows.map((r) => {
    const name = r.company || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()
    const label = name || r.number
    const subParts = [r.number]
    if (r.email) subParts.push(r.email)
    if (r.city) subParts.push(r.city)
    return { id: r.id, label, sublabel: subParts.join(' · ') }
  })
}

async function searchVehicles(
  term: string,
  limit: number
): Promise<SearchHit[]> {
  // Plate matches live in a separate versions table; resolve to ids
  // first so the main query can use a single OR-of-ILIKEs.
  const plateMatches = await db
    .selectDistinct({ vehicleId: vehicleLicensePlateVersions.vehicleId })
    .from(vehicleLicensePlateVersions)
    .where(ilike(vehicleLicensePlateVersions.licensePlate, term))
  const plateMatchIds = plateMatches.map((r) => r.vehicleId)

  const baseSearch = or(
    ilike(vehicles.vin, term),
    ilike(vehicles.make, term),
    ilike(vehicles.model, term)
  )!
  const whereSearch =
    plateMatchIds.length > 0
      ? or(baseSearch, inArray(vehicles.id, plateMatchIds))!
      : baseSearch

  // Pull the current plate alongside the row so the UI can show it as
  // a sublabel without a second round-trip.
  const rows = await db
    .selectDistinct({
      id: vehicles.id,
      vin: vehicles.vin,
      make: vehicles.make,
      model: vehicles.model
    })
    .from(vehicles)
    .where(and(eq(vehicles.archived, false), whereSearch))
    .orderBy(asc(vehicles.make), asc(vehicles.model))
    .limit(limit)
  if (rows.length === 0) return []

  // One small follow-up to grab the current-as-of-today plate per hit.
  // Avoids the heavier `latestPlateSubquery` because we already have
  // the ids and the result set is bounded by `limit`.
  const today = new Date().toISOString().slice(0, 10)
  const ids = rows.map((r) => r.id)
  const plates = await db
    .select({
      vehicleId: vehicleLicensePlateVersions.vehicleId,
      validFrom: vehicleLicensePlateVersions.validFrom,
      licensePlate: vehicleLicensePlateVersions.licensePlate
    })
    .from(vehicleLicensePlateVersions)
    .where(inArray(vehicleLicensePlateVersions.vehicleId, ids))
    .orderBy(desc(vehicleLicensePlateVersions.validFrom))
  const currentPlate = new Map<string, string>()
  for (const p of plates) {
    if (p.validFrom > today) continue
    if (!currentPlate.has(p.vehicleId)) {
      currentPlate.set(p.vehicleId, p.licensePlate)
    }
  }

  return rows.map((r) => {
    const makeModel = [r.make, r.model].filter(Boolean).join(' ') || '—'
    const plate = currentPlate.get(r.id) ?? null
    const subParts: string[] = []
    if (plate) subParts.push(plate)
    if (r.vin) subParts.push(r.vin)
    return {
      id: r.id,
      label: makeModel,
      sublabel: subParts.length > 0 ? subParts.join(' · ') : undefined
    }
  })
}

async function searchItems(term: string, limit: number): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: items.id,
      articleNumber: items.articleNumber,
      description: items.description,
      kind: items.kind
    })
    .from(items)
    .where(or(ilike(items.articleNumber, term), ilike(items.description, term)))
    .orderBy(asc(items.articleNumber))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    label: `${r.articleNumber} — ${r.description}`,
    sublabel: r.kind === 'service' ? 'Leistung' : 'Artikel'
  }))
}

const seasonLabel: Record<string, string> = {
  Sommer: 'Sommer',
  Winter: 'Winter',
  Ganzjahres: 'Ganzjahres',
  summer: 'Sommer',
  winter: 'Winter',
  allseason: 'Ganzjahres'
}

async function searchTires(term: string, limit: number): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: tires.id,
      articleNumber: tires.articleNumber,
      brand: tires.brand,
      model: tires.model,
      width: tires.width,
      aspectRatio: tires.aspectRatio,
      diameterInch: tires.diameterInch,
      season: tires.season,
      ean: tires.ean
    })
    .from(tires)
    .where(
      or(
        ilike(tires.articleNumber, term),
        ilike(tires.brand, term),
        ilike(tires.model, term),
        ilike(tires.ean, term)
      )!
    )
    .orderBy(asc(tires.brand), asc(tires.model))
    .limit(limit)
  return rows.map((r) => {
    const size = `${r.width}/${r.aspectRatio} R${r.diameterInch}`
    const subParts = [r.articleNumber, size]
    const season = seasonLabel[r.season] ?? r.season
    if (season) subParts.push(season)
    return {
      id: r.id,
      label: `${r.brand} ${r.model}`.trim(),
      sublabel: subParts.join(' · ')
    }
  })
}

async function searchTireStorage(
  term: string,
  limit: number
): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: tireStorage.id,
      storageNumber: tireStorage.storageNumber,
      brand: tireStorage.brand,
      size: tireStorage.size,
      season: tireStorage.season,
      retrievedAt: tireStorage.retrievedAt,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      customerNumber: customers.customerNumber
    })
    .from(tireStorage)
    .leftJoin(customers, eq(tireStorage.customerId, customers.id))
    .where(
      or(
        ilike(tireStorage.storageNumber, term),
        ilike(tireStorage.brand, term),
        ilike(tireStorage.size, term),
        ilike(customers.company, term),
        ilike(customers.lastName, term),
        ilike(customers.customerNumber, term)
      )!
    )
    .orderBy(desc(tireStorage.storedAt))
    .limit(limit)
  return rows.map((r) => {
    const cust =
      r.customerCompany ?? r.customerLastName ?? r.customerNumber ?? null
    const subParts: string[] = []
    if (cust) subParts.push(cust)
    if (r.brand) subParts.push(r.brand)
    if (r.size) subParts.push(r.size)
    if (r.retrievedAt) subParts.push('ausgelagert')
    return {
      id: r.id,
      label: `Einlagerung ${r.storageNumber}`,
      sublabel: subParts.length > 0 ? subParts.join(' · ') : undefined
    }
  })
}

async function searchSuppliers(
  term: string,
  limit: number
): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: suppliers.id,
      number: suppliers.legacySupplierNumber,
      name: suppliers.name,
      city: suppliers.city,
      email: suppliers.email
    })
    .from(suppliers)
    .where(
      and(
        eq(suppliers.archived, false),
        or(
          ilike(suppliers.name, term),
          ilike(suppliers.legacySupplierNumber, term),
          ilike(suppliers.city, term),
          ilike(suppliers.email, term)
        )!
      )
    )
    .orderBy(asc(suppliers.name))
    .limit(limit)
  return rows.map((r) => {
    const subParts: string[] = []
    if (r.number) subParts.push(r.number)
    if (r.city) subParts.push(r.city)
    if (r.email) subParts.push(r.email)
    return {
      id: r.id,
      label: r.name,
      sublabel: subParts.length > 0 ? subParts.join(' · ') : undefined
    }
  })
}

async function searchDocuments(
  term: string,
  limit: number
): Promise<SearchHit[]> {
  const rows = await db
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      type: documents.type,
      issueDate: documents.issueDate,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      customerNumber: customers.customerNumber
    })
    .from(documents)
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .where(
      and(
        inArray(documents.type, [
          'invoice',
          'offer',
          'cost_estimate',
          'order_confirmation',
          'credit_note'
        ]),
        or(
          ilike(documents.documentNumber, term),
          ilike(customers.company, term),
          ilike(customers.lastName, term),
          ilike(customers.customerNumber, term)
        )!
      )
    )
    .orderBy(desc(documents.issueDate), desc(documents.createdAt))
    .limit(limit)
  return rows.map((r) => {
    const cust = r.customerCompany ?? r.customerLastName ?? r.customerNumber
    const t = typeLabel[r.type] ?? r.type
    return {
      id: r.id,
      label: `${t} ${r.documentNumber}`,
      sublabel: cust ?? undefined,
      type: r.type
    }
  })
}
