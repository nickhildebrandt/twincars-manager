/**
 * Der Stand der Verweise zum Zeitpunkt des Ausstellens (M-42).
 *
 * Eine Rechnung wird ausgestellt. Zwei Jahre später zieht der Kunde um, das
 * Fahrzeug bekommt ein neues Kennzeichen, die Firma wechselt die Steuernummer.
 * Dann steht auf dem PDF von damals etwas anderes als in der Anwendung — und
 * das ist **richtig so**. Falsch wäre nur, wenn niemand es merkt.
 *
 * Deshalb zwei getrennte Dinge:
 *
 *   - Die eingefrorenen Spalten am Beleg (`billed_*`, `vehicle_*`, `company_*`)
 *     sind **Inhalt**: was gedruckt wurde, unveränderlich, im PDF.
 *   - Die Zeilen in `document_snapshots` sind **Beweis**: wie der verwiesene
 *     Datensatz insgesamt aussah. Aus ihnen beantwortet die Anwendung die
 *     Frage „hat sich seit dem Ausstellen etwas geändert?" — und zwar für
 *     jedes Feld, nicht nur für die gedruckten.
 *
 * Geschrieben wird genau einmal, beim Ausstellen (P-25). Es gibt in dieser
 * Datei kein `update` und kein `delete`.
 */
import { and, eq } from 'drizzle-orm'
import {
  companySettings,
  customers,
  documentSnapshots,
  documents,
  vehicleLicensePlateVersions,
  vehicles,
} from '../database/schema/index.ts'
import type { Executor } from '../utils/db.ts'
import { useDatabase } from '../utils/db.ts'
import { changesBetween, isLoggableField } from '../utils/audit.ts'
import type { FieldChange } from '../utils/audit.ts'
import { labelOf, snapshotEntities } from '#shared/domain'
import type { SnapshotEntity } from '#shared/domain'
import { FIELD_LABELS } from '#shared/schemas/field-labels'

/** Felder, die in keinen Schnappschuss gehören — sie sagen nichts über den Stand. */
const SKIPPED = ['id', 'createdAt', 'updatedAt', 'logoData', 'logoMime']

/**
 * Macht aus einem Datensatz die Abschrift, die aufbewahrt wird.
 *
 * Herausgenommen wird zweierlei: was ohnehin in jeder Zeile steht (Kennung,
 * Zeitstempel) und alles, was ein Geheimnis sein könnte. Für das Zweite gilt
 * dieselbe Liste wie im Protokoll — ein Schnappschuss, der Zugangsdaten
 * mitschreibt, wäre dieselbe Lücke an einer zweiten Stelle.
 */
export function snapshotOf(record: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(record)) {
    if (SKIPPED.includes(field)) continue
    if (!isLoggableField(field)) continue
    if (value === undefined) continue
    copy[field] = value instanceof Date ? value.toISOString() : value
  }
  return copy
}

/** Eine Abweichung zwischen damals und heute, fertig zum Anzeigen. */
export type SnapshotDrift = {
  entity: SnapshotEntity
  /** „Kunde", „Fahrzeug", „Firma". */
  entityLabel: string
  entityId: string | null
  changes: (FieldChange & { label: string })[]
}

/**
 * Was sich seit dem Ausstellen geändert hat.
 *
 * Verglichen wird die Abschrift von damals gegen den Datensatz von heute.
 * Fehlt der Datensatz inzwischen ganz, ist das keine Abweichung, sondern der
 * Normalfall eines archivierten Kunden — dann steht die Abschrift für sich.
 *
 * Gibt eine **leere Liste** zurück, wenn alles unverändert ist. Die Oberfläche
 * zeigt den Hinweis genau dann, wenn hier etwas ankommt.
 */
export async function driftOf(
  documentId: string,
  executor: Executor = useDatabase(),
): Promise<SnapshotDrift[]> {
  const taken = await executor
    .select()
    .from(documentSnapshots)
    .where(eq(documentSnapshots.documentId, documentId))

  const drift: SnapshotDrift[] = []

  for (const snapshot of taken) {
    const entity = snapshot.entity as SnapshotEntity
    const current = await currentStateOf(entity, snapshot.entityId, executor)
    if (!current) continue

    const changes = changesBetween(snapshot.data, current)
      .filter(change => !SKIPPED.includes(change.field))
    if (changes.length === 0) continue

    drift.push({
      entity,
      entityLabel: labelOf(snapshotEntities, entity),
      entityId: snapshot.entityId,
      changes: changes.map(change => ({
        ...change,
        label: FIELD_LABELS[change.field] ?? change.field,
      })),
    })
  }

  return drift
}

/** Der heutige Stand eines verwiesenen Datensatzes, in derselben Form wie die Abschrift. */
async function currentStateOf(
  entity: SnapshotEntity,
  entityId: string | null,
  executor: Executor,
): Promise<Record<string, unknown> | null> {
  if (entity === 'company_settings') {
    const [row] = await executor.select().from(companySettings).limit(1)
    return row ? snapshotOf(row) : null
  }

  if (!entityId) return null

  if (entity === 'customers') {
    const [row] = await executor.select().from(customers).where(eq(customers.id, entityId)).limit(1)
    return row ? snapshotOf(row) : null
  }

  const [row] = await executor.select().from(vehicles).where(eq(vehicles.id, entityId)).limit(1)
  if (!row) return null
  return snapshotOf({ ...row, licensePlate: await currentPlateOf(entityId, executor) })
}

/**
 * Das aktuelle Kennzeichen eines Fahrzeugs.
 *
 * Es steht nicht am Fahrzeug, sondern in seiner Kennzeichenhistorie — und
 * gerade der Kennzeichenwechsel ist der Fall, für den es diesen Vergleich
 * gibt. Ohne diese Zeile fiele er als einziger nicht auf.
 */
async function currentPlateOf(
  vehicleId: string,
  executor: Executor,
): Promise<string | null> {
  const versions = await executor
    .select({ validFrom: vehicleLicensePlateVersions.validFrom, plate: vehicleLicensePlateVersions.licensePlate })
    .from(vehicleLicensePlateVersions)
    .where(eq(vehicleLicensePlateVersions.vehicleId, vehicleId))

  // Das späteste `gültig ab`, das nicht in der Zukunft liegt. Ein Wechsel darf
  // vorab erfasst werden, ohne sofort zu gelten.
  const today = new Date().toISOString().slice(0, 10)
  const current = versions
    .filter(version => version.validFrom <= today)
    .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0]

  return current?.plate ?? null
}

/**
 * Nimmt die Abschriften — genau einmal, beim Ausstellen (P-25).
 *
 * Läuft in der Transaktion des Ausstellens mit: entweder steht der Beleg
 * **mit** seinem Beweis, oder es steht nichts. Ein ausgestellter Beleg ohne
 * Schnappschuss wäre schlimmer als gar keiner, weil niemand ihn vermisst.
 *
 * Ist für diesen Beleg schon einmal abgeschrieben worden, geschieht nichts:
 * die Abschrift von damals gilt, nicht die von heute.
 */
export async function takeSnapshots(
  documentId: string,
  executor: Executor = useDatabase(),
): Promise<number> {
  const [document] = await executor
    .select({ customerId: documents.customerId, vehicleId: documents.vehicleId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!document) return 0

  const existing = await executor
    .select({ entity: documentSnapshots.entity })
    .from(documentSnapshots)
    .where(eq(documentSnapshots.documentId, documentId))

  const already = new Set(existing.map(row => row.entity))
  const rows: { documentId: string, entity: string, entityId: string | null, data: Record<string, unknown> }[] = []

  if (!already.has('customers') && document.customerId) {
    const [row] = await executor.select().from(customers).where(eq(customers.id, document.customerId)).limit(1)
    if (row) rows.push({ documentId, entity: 'customers', entityId: row.id, data: snapshotOf(row) })
  }

  if (!already.has('vehicles') && document.vehicleId) {
    const [row] = await executor.select().from(vehicles).where(eq(vehicles.id, document.vehicleId)).limit(1)
    if (row) {
      rows.push({
        documentId,
        entity: 'vehicles',
        entityId: row.id,
        data: snapshotOf({ ...row, licensePlate: await currentPlateOf(row.id, executor) }),
      })
    }
  }

  if (!already.has('company_settings')) {
    const [row] = await executor.select().from(companySettings).limit(1)
    if (row) rows.push({ documentId, entity: 'company_settings', entityId: null, data: snapshotOf(row) })
  }

  if (rows.length === 0) return 0

  await executor.insert(documentSnapshots).values(rows)
  return rows.length
}

/** Die Abschriften eines Belegs, so wie sie geschrieben wurden. */
export async function snapshotsOf(
  documentId: string,
  executor: Executor = useDatabase(),
): Promise<typeof documentSnapshots.$inferSelect[]> {
  return executor
    .select()
    .from(documentSnapshots)
    .where(eq(documentSnapshots.documentId, documentId))
}

/**
 * Welche Belege einen Datensatz eingefroren haben.
 *
 * Die Gegenrichtung: von einem Kunden oder Fahrzeug aus sehen, auf welchen
 * ausgestellten Belegen sein damaliger Stand steht. Das ist die Antwort auf
 * „warum steht auf dieser Rechnung die alte Anschrift".
 */
export async function documentsHolding(
  entity: SnapshotEntity,
  entityId: string,
  executor: Executor = useDatabase(),
): Promise<string[]> {
  const rows = await executor
    .select({ documentId: documentSnapshots.documentId })
    .from(documentSnapshots)
    .where(and(
      eq(documentSnapshots.entity, entity),
      eq(documentSnapshots.entityId, entityId),
    ))

  return rows.map(row => row.documentId)
}
