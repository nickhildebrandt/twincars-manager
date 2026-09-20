/**
 * Die Suche hinter jeder Auswahl.
 *
 * Alle Auswahlen laufen über dieselbe Mechanik: serverseitig suchen,
 * serverseitig blättern, fest 25 je Seite, archivierte Datensätze weglassen.
 * Im Browser wird nie gefiltert — bei zweitausend Kunden wäre das eine
 * Übertragung von zweitausend Kunden.
 *
 * Drei Dinge, die beim Vorgänger je einzeln schiefgingen:
 *
 *   - **Die Beschriftung kommt aus `shared/picker-labels.ts`**, nicht aus
 *     sechs Stellen im Servercode (B-087). Sonst zeigte die Liste einen Namen
 *     und die Selbstauswahl nach dem Anlegen suchte einen anderen.
 *   - **Die Kennzeichensuche steht einmal da.** Sie war dreimal kopiert, und
 *     zwar als Vorabfrage, die eine unbegrenzte Liste von Kennungen in ein
 *     `IN` schob (B-086). Hier ist es ein `EXISTS`.
 *   - **Der aktuelle Preis kommt in derselben Abfrage.** Dort wurde er je
 *     Zeile nachgeladen: bis zu hundert zusätzliche Abfragen je Seite (B-084).
 */
import { and, asc, desc, eq, getTableName, ilike, or, sql } from 'drizzle-orm'
import type { AnyColumn, SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import {
  customers,
  documents,
  employees,
  itemPriceVersions,
  items,
  suppliers,
  tirePriceVersions,
  tires,
  vehicleLicensePlateVersions,
  vehicles,
} from '../database/schema/index.ts'
import { useDatabase } from '../utils/db.ts'
import type { Executor } from '../utils/db.ts'
import { PAGE_SIZE, listResult, offsetFor } from '#shared/schemas/pagination'
import type { ListResult } from '#shared/schemas/pagination'
import type { PickerOption } from '#shared/picker-labels'
import {
  customerLabel,
  customerSublabel,
  documentLabel,
  documentSublabel,
  employeeLabel,
  employeeSublabel,
  itemLabel,
  itemSublabel,
  supplierLabel,
  supplierSublabel,
  tireLabel,
  tireSublabel,
  vehicleLabel,
  vehicleSublabel,
} from '#shared/picker-labels'
import { documentTypes, labelOf, tireSeasons } from '#shared/domain'
import { formatEuro } from '#shared/money'
import { formatDate, today } from '#shared/datetime'

export type PickerRequest = {
  q?: string
  page: number
  customerId?: string
  vehicleId?: string
}

/** `müller` findet `Müller`, und ein leerer Begriff sucht nicht. */
const like = (term: string) => `%${term.trim()}%`

/**
 * Wie viele Datensätze die Bedingung trifft.
 *
 * Einmal, nicht siebenmal: die Gesamtzahl wird in jeder Auswahl gebraucht, und
 * sieben Kopien derselben Abfrage sind sieben Stellen, an denen jemand die
 * Bedingung vergessen kann.
 */
async function countOf(
  executor: Executor,
  table: PgTable,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(table)
    .where(where)
  return row?.total ?? 0
}

/**
 * `"vehicles"."id"` — eine Spalte mit ihrer Tabelle davor.
 *
 * Nötig für jede Unterabfrage in der **Auswahlliste**. Drizzle schreibt die
 * Tabelle nur dann davor, wenn die Spalte in `where` steht; in der
 * Auswahlliste kommt sie nackt heraus. Innerhalb einer Unterabfrage bindet
 * ein nacktes `"id"` dann an die **innere** Tabelle: aus dem Vergleich
 * „Kennzeichen dieses Fahrzeugs" wird „Kennzeichen, dessen eigene Kennung
 * gleich seiner Fahrzeugkennung ist" — nie wahr, immer `NULL`, keine
 * Fehlermeldung. Genau das lief hier, bis der Integrationstest es zeigte.
 */
const qualified = (column: AnyColumn): SQL =>
  sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`

/**
 * Ob irgendein Kennzeichen dieses Fahrzeugs passt.
 *
 * Als `EXISTS`, nicht als Vorabfrage mit anschließendem `IN`: eine Werkstatt
 * mit zehntausend Fahrzeugen erzeugte dort eine Liste von zehntausend
 * Kennungen, die in die nächste Abfrage geschoben wurde.
 */
const plateMatches = (term: string): SQL => sql`EXISTS (
  SELECT 1 FROM ${vehicleLicensePlateVersions}
  WHERE ${vehicleLicensePlateVersions.vehicleId} = ${vehicles.id}
    AND ${vehicleLicensePlateVersions.licensePlate} ILIKE ${like(term)}
)`

/** Das aktuell gültige Kennzeichen, in derselben Abfrage. */
const currentPlate = sql<string | null>`(
  SELECT ${vehicleLicensePlateVersions.licensePlate}
  FROM ${vehicleLicensePlateVersions}
  WHERE ${vehicleLicensePlateVersions.vehicleId} = ${qualified(vehicles.id)}
  ORDER BY ${vehicleLicensePlateVersions.validFrom} DESC
  LIMIT 1
)`

/* ── Kunden ──────────────────────────────────────────────────────────── */

export async function pickCustomers(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  const where = and(
    eq(customers.archived, false),
    term
      ? or(
          ilike(customers.company, like(term)),
          ilike(customers.lastName, like(term)),
          ilike(customers.firstName, like(term)),
          ilike(customers.customerNumber, like(term)),
          ilike(customers.city, like(term)),
        )
      : undefined,
  )

  const rows = await executor
    .select({
      id: customers.id,
      company: customers.company,
      lastName: customers.lastName,
      firstName: customers.firstName,
      customerNumber: customers.customerNumber,
      zip: customers.zip,
      city: customers.city,
    })
    .from(customers)
    .where(where)
    .orderBy(asc(customers.company), asc(customers.lastName), asc(customers.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, customers, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: customerLabel(row),
      sublabel: customerSublabel(row),
    })),
    total,
    request.page,
  )
}

/* ── Fahrzeuge ───────────────────────────────────────────────────────── */

export type VehicleScope = 'alle' | 'kunde' | 'bestand'

export async function pickVehicles(
  request: PickerRequest & { scope?: VehicleScope },
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()

  const scoped
    = request.scope === 'bestand'
      ? eq(vehicles.status, 'bestand')
      : request.scope === 'kunde' && request.customerId
        ? eq(vehicles.customerId, request.customerId)
        : undefined

  const where = and(
    eq(vehicles.archived, false),
    scoped,
    term
      ? or(
          ilike(vehicles.make, like(term)),
          ilike(vehicles.model, like(term)),
          ilike(vehicles.vin, like(term)),
          plateMatches(term),
        )
      : undefined,
  )

  const rows = await executor
    .select({
      id: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      vin: vehicles.vin,
      firstRegistration: vehicles.firstRegistration,
      licensePlate: currentPlate,
    })
    .from(vehicles)
    .where(where)
    .orderBy(asc(vehicles.make), asc(vehicles.model), asc(vehicles.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, vehicles, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: vehicleLabel(row),
      sublabel: vehicleSublabel({
        licensePlate: row.licensePlate,
        vin: row.vin,
        firstRegistration: row.firstRegistration ? formatDate(row.firstRegistration) : null,
      }),
    })),
    total,
    request.page,
  )
}

/* ── Artikel ─────────────────────────────────────────────────────────── */

/**
 * Der zum Stichtag gültige Preis, als Unterabfrage.
 *
 * Dieselbe Zahl je Zeile nachzuladen kostete beim Vorgänger bis zu hundert
 * zusätzliche Abfragen je Seite (B-084).
 */
const currentItemPrice = sql<number | null>`(
  SELECT ${itemPriceVersions.unitPriceNet}
  FROM ${itemPriceVersions}
  WHERE ${itemPriceVersions.itemId} = ${qualified(items.id)}
    AND ${itemPriceVersions.validFrom} <= ${today()}
  ORDER BY ${itemPriceVersions.validFrom} DESC
  LIMIT 1
)`

export async function pickItems(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  const where = term
    ? or(ilike(items.description, like(term)), ilike(items.articleNumber, like(term)))
    : undefined

  const rows = await executor
    .select({
      id: items.id,
      description: items.description,
      articleNumber: items.articleNumber,
      unit: items.unit,
      price: currentItemPrice,
    })
    .from(items)
    .where(where)
    .orderBy(asc(items.description), asc(items.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, items, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: itemLabel(row),
      sublabel: [
        itemSublabel(row),
        row.price === null ? null : formatEuro(row.price),
      ].filter(Boolean).join(' · '),
    })),
    total,
    request.page,
  )
}

/* ── Reifen ──────────────────────────────────────────────────────────── */

const currentTirePrice = sql<number | null>`(
  SELECT ${tirePriceVersions.unitPriceNet}
  FROM ${tirePriceVersions}
  WHERE ${tirePriceVersions.tireId} = ${qualified(tires.id)}
    AND ${tirePriceVersions.validFrom} <= ${today()}
  ORDER BY ${tirePriceVersions.validFrom} DESC
  LIMIT 1
)`

export async function pickTires(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  // Die Größe steht als drei Zahlen in der Tabelle, gesucht wird aber nach
  // „205/55 R16" — also wird sie für den Vergleich zusammengesetzt.
  const size = sql<string>`
    ${tires.width} || '/' || ${tires.aspectRatio} || ' ' || ${tires.construction} || ${tires.diameterInch}
  `
  const where = term
    ? or(
        ilike(tires.brand, like(term)),
        ilike(tires.model, like(term)),
        sql`${size} ILIKE ${like(term)}`,
        ilike(tires.articleNumber, like(term)),
      )
    : undefined

  const rows = await executor
    .select({
      id: tires.id,
      brand: tires.brand,
      model: tires.model,
      size,
      season: tires.season,
      articleNumber: tires.articleNumber,
      price: currentTirePrice,
    })
    .from(tires)
    .where(where)
    .orderBy(asc(tires.brand), asc(tires.model), asc(tires.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, tires, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: tireLabel(row),
      sublabel: [
        tireSublabel({
          size: row.size,
          seasonLabel: labelOf(tireSeasons, row.season),
          articleNumber: row.articleNumber,
        }),
        row.price === null ? null : formatEuro(row.price),
      ].filter(Boolean).join(' · '),
    })),
    total,
    request.page,
  )
}

/* ── Mitarbeiter ─────────────────────────────────────────────────────── */

export async function pickEmployees(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  // Ein deaktivierter Mitarbeiter erscheint nicht mehr zur Auswahl, bleibt
  // aber in allem stehen, wo er schon eingetragen ist (M-12).
  const where = and(
    eq(employees.archived, false),
    term
      ? or(
          ilike(employees.lastName, like(term)),
          ilike(employees.firstName, like(term)),
          ilike(employees.personnelNumber, like(term)),
        )
      : undefined,
  )

  const rows = await executor
    .select({
      id: employees.id,
      lastName: employees.lastName,
      firstName: employees.firstName,
      personnelNumber: employees.personnelNumber,
      jobTitle: employees.position,
    })
    .from(employees)
    .where(where)
    .orderBy(asc(employees.lastName), asc(employees.firstName), asc(employees.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, employees, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: employeeLabel(row),
      sublabel: employeeSublabel(row),
    })),
    total,
    request.page,
  )
}

/* ── Lieferanten ─────────────────────────────────────────────────────── */

export async function pickSuppliers(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  const where = and(
    eq(suppliers.archived, false),
    term
      ? or(ilike(suppliers.name, like(term)), ilike(suppliers.city, like(term)))
      : undefined,
  )

  const rows = await executor
    .select({
      id: suppliers.id,
      name: suppliers.name,
      city: suppliers.city,
      customerNumberAtSupplier: suppliers.customerNumberAtSupplier,
    })
    .from(suppliers)
    .where(where)
    .orderBy(asc(suppliers.name), asc(suppliers.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, suppliers, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: supplierLabel(row),
      sublabel: supplierSublabel(row),
    })),
    total,
    request.page,
  )
}

/* ── Belege ──────────────────────────────────────────────────────────── */

export async function pickDocuments(
  request: PickerRequest,
  executor: Executor = useDatabase(),
): Promise<ListResult<PickerOption>> {
  const term = request.q?.trim()
  const where = and(
    request.customerId ? eq(documents.customerId, request.customerId) : undefined,
    term ? ilike(documents.documentNumber, like(term)) : undefined,
  )

  const rows = await executor
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      type: documents.type,
      issueDate: documents.issueDate,
      grossTotal: documents.grossTotal,
    })
    .from(documents)
    .where(where)
    .orderBy(desc(documents.issueDate), desc(documents.id))
    .limit(PAGE_SIZE)
    .offset(offsetFor(request.page))

  const total = await countOf(executor, documents, where)

  return listResult(
    rows.map(row => ({
      id: row.id,
      label: documentLabel({
        typeLabel: labelOf(documentTypes, row.type),
        documentNumber: row.documentNumber,
      }),
      sublabel: documentSublabel({
        issueDate: formatDate(row.issueDate),
        totalLabel: formatEuro(row.grossTotal),
      }),
    })),
    total,
    request.page,
  )
}
