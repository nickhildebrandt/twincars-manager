/**
 * Zeitstrahl und Rücksprung für jeden versionierten Datensatz (M-45).
 *
 * Festgelegt am 20.09.2026: „Aus dem Zeitstrahl heraus muss ein früherer Stand
 * wiederhergestellt werden können … Ziel ist ein wiederverwendbares Feature
 * für Versionierung mit Zeitstrahl und gegebenenfalls Rücksprung, keine
 * Einzellösung."
 *
 * Genau das ist diese Datei. Sie weiß **nichts** über Kunden, Fahrzeuge oder
 * Artikel — sie kennt nur `entity`, `entityId` und einen Zustand. Einen
 * weiteren Datensatz zu versionieren heißt: eine Zeile in `versionedEntities`
 * und ein Aufruf im Speicherpfad. Kein zweites Formular, kein zweiter
 * Zeitstrahl, keine zweite Rücksprunglogik.
 *
 * **Drei Zusagen:**
 *
 *   - Der Zähler hat keine Lücken. Er wird unter einer Zeilensperre gezogen,
 *     damit zwei gleichzeitige Speichervorgänge nicht dieselbe Nummer bekommen
 *     (derselbe Grund wie bei der Belegnummer, P-02).
 *   - Ein Rücksprung **löscht nichts**. Der alte Stand wird als neuer,
 *     aktueller Stand obendrauf gesetzt; der Zeitstrahl bleibt lückenlos.
 *   - Ein Rücksprung ist **sichtbar**. `restored_from_version` macht aus ihm
 *     einen benannten Vorgang statt einer Änderung, die aussieht wie jede
 *     andere.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { recordVersions } from '../database/schema/index.ts'
import type { Executor, Transaction } from '../utils/db.ts'
import { useDatabase, withTransaction } from '../utils/db.ts'
import { stateOf } from '../utils/record-state.ts'
import { conflict, notFound } from '../utils/errors.ts'
import type { VersionedEntity } from '#shared/domain'

/** Wer den Stand erzeugt hat. */
export type Author = { userId?: string | null, userName?: string | null }

/** Ein Eintrag im Zeitstrahl. */
export type RecordVersion = {
  version: number
  data: Record<string, unknown>
  note: string | null
  restoredFromVersion: number | null
  changedBy: string | null
  changedByName: string | null
  createdAt: string
}

/**
 * Schreibt den aktuellen Zustand als nächsten Stand.
 *
 * Läuft **in der Transaktion des Speicherns** mit: entweder steht der
 * geänderte Datensatz mit seinem Stand, oder keines von beidem. Ein Zeitstrahl
 * mit Löchern ist schlimmer als keiner, weil niemand die Löcher sieht.
 *
 * Gibt die vergebene Versionsnummer zurück.
 */
export async function recordVersion(
  entity: VersionedEntity,
  entityId: string,
  record: Record<string, unknown>,
  options: { note?: string | null, restoredFromVersion?: number | null } & Author = {},
  executor: Executor = useDatabase(),
): Promise<number> {
  // `max(version) + 1` unter einer Sperre auf die vorhandenen Zeilen. Ohne
  // `FOR UPDATE` bekämen zwei gleichzeitige Speichervorgänge dieselbe Nummer,
  // und der eindeutige Index wiese den zweiten ab — ein Speichern, das aus
  // heiterem Himmel scheitert.
  const [current] = await executor
    .select({ version: recordVersions.version })
    .from(recordVersions)
    .where(and(eq(recordVersions.entity, entity), eq(recordVersions.entityId, entityId)))
    .orderBy(desc(recordVersions.version))
    .limit(1)
    .for('update')

  const version = (current?.version ?? 0) + 1

  await executor.insert(recordVersions).values({
    entity,
    entityId,
    version,
    data: stateOf(record),
    note: options.note?.slice(0, 300) ?? null,
    restoredFromVersion: options.restoredFromVersion ?? null,
    changedBy: options.userId ?? null,
    changedByName: options.userName?.slice(0, 200) ?? null,
  })

  return version
}

/**
 * Der Zeitstrahl eines Datensatzes, neuester Stand zuerst.
 *
 * Ohne Begrenzung: ein Datensatz, der hundertmal gespeichert wurde, hat
 * hundert Stände, und die Seite blättert sie. Eine Begrenzung hier hieße, dass
 * der älteste Stand irgendwann unerreichbar wird — und genau der ist der, den
 * jemand sucht.
 */
export async function versionsOf(
  entity: VersionedEntity,
  entityId: string,
  executor: Executor = useDatabase(),
): Promise<RecordVersion[]> {
  const rows = await executor
    .select({
      version: recordVersions.version,
      data: recordVersions.data,
      note: recordVersions.note,
      restoredFromVersion: recordVersions.restoredFromVersion,
      changedBy: recordVersions.changedBy,
      changedByName: recordVersions.changedByName,
      createdAt: recordVersions.createdAt,
    })
    .from(recordVersions)
    .where(and(eq(recordVersions.entity, entity), eq(recordVersions.entityId, entityId)))
    .orderBy(desc(recordVersions.version))

  return rows
}

/** Ein einzelner Stand, oder ein 404 mit deutschem Satz. */
export async function versionAt(
  entity: VersionedEntity,
  entityId: string,
  version: number,
  executor: Executor = useDatabase(),
): Promise<RecordVersion> {
  const [row] = await executor
    .select({
      version: recordVersions.version,
      data: recordVersions.data,
      note: recordVersions.note,
      restoredFromVersion: recordVersions.restoredFromVersion,
      changedBy: recordVersions.changedBy,
      changedByName: recordVersions.changedByName,
      createdAt: recordVersions.createdAt,
    })
    .from(recordVersions)
    .where(and(
      eq(recordVersions.entity, entity),
      eq(recordVersions.entityId, entityId),
      eq(recordVersions.version, version),
    ))
    .limit(1)

  if (!row) throw notFound('Dieser Stand')
  return row
}

/** Die Nummer des aktuellen Standes, oder 0, wenn es noch keinen gibt. */
export async function latestVersionOf(
  entity: VersionedEntity,
  entityId: string,
  executor: Executor = useDatabase(),
): Promise<number> {
  const [row] = await executor
    .select({ version: sql<number>`coalesce(max(${recordVersions.version}), 0)` })
    .from(recordVersions)
    .where(and(eq(recordVersions.entity, entity), eq(recordVersions.entityId, entityId)))

  return Number(row?.version ?? 0)
}

/**
 * Nimmt einen früheren Stand wieder auf.
 *
 * **Nichts wird überschrieben und nichts gelöscht.** Der alte Stand wird auf
 * den Datensatz zurückgeschrieben und **zusätzlich** als neuer, aktueller
 * Stand angelegt. Der Zeitstrahl wird länger, nicht kürzer, und der
 * zurückgenommene Stand bleibt darin stehen.
 *
 * Das Zurückschreiben selbst macht der Aufrufer über `apply` — nur er weiß,
 * welche Spalten seine Tabelle hat und was davon überhaupt gesetzt werden
 * darf. Beides läuft in **einer** Transaktion.
 *
 * @returns die Nummer des neuen Standes.
 */
export async function restoreVersion(
  entity: VersionedEntity,
  entityId: string,
  version: number,
  apply: (data: Record<string, unknown>, tx: Transaction) => Promise<void>,
  author: Author = {},
  executor?: Executor,
): Promise<number> {
  const run = async (tx: Transaction): Promise<number> => {
    const target = await versionAt(entity, entityId, version, tx)
    const latest = await latestVersionOf(entity, entityId, tx)

    // Den aktuellen Stand „wiederherzustellen" ist keine Handlung, sondern ein
    // Versehen. Ein Zeitstrahl, der denselben Zustand zweimal hintereinander
    // führt, erzählt nichts.
    if (version === latest) {
      throw conflict('Dieser Stand ist bereits der aktuelle.')
    }

    await apply(target.data, tx)

    return recordVersion(entity, entityId, target.data, {
      ...author,
      restoredFromVersion: version,
      note: `Stand ${version} wieder aufgenommen`,
    }, tx)
  }

  return executor && 'rollback' in executor
    ? run(executor as Transaction)
    : withTransaction(run)
}

/**
 * Was sich zwischen zwei Ständen geändert hat — für den Zeitstrahl.
 *
 * Liefert die Feldnamen, nicht die Werte: die Zeile im Zeitstrahl sagt
 * „Anschrift und Telefon geändert", und wer mehr will, öffnet den Stand.
 */
export function changedFieldsBetween(
  older: Record<string, unknown> | null | undefined,
  newer: Record<string, unknown> | null | undefined,
): string[] {
  const fields = new Set([...Object.keys(older ?? {}), ...Object.keys(newer ?? {})])
  const changed: string[] = []

  for (const field of [...fields].sort()) {
    const before = older?.[field] ?? null
    const after = newer?.[field] ?? null
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(field)
  }

  return changed
}
