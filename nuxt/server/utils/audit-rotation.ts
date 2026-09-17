/**
 * Die Rotation des Protokolls (P-20).
 *
 * Ein Protokoll, das nie aufräumt, wächst bis zur Unbrauchbarkeit — nach fünf
 * Jahren sucht niemand mehr darin. Eines, das zu früh aufräumt, ist im
 * Ernstfall leer. Also drei Fristen, nach dem, worum es geht:
 *
 * | Was | Aufbewahrung |
 * | --- | --- |
 * | Buchhaltungsnahes | **10 Jahre** — Aufbewahrungspflicht |
 * | Gewicht `sicherheit` | **2 Jahre** |
 * | Alles andere | **1 Jahr** |
 *
 * **Sie löscht nur ganze Einträge nach Alter.** Sie ändert keinen und schneidet
 * keinen zurecht — das wäre eine Bearbeitung, und ein bearbeitetes Protokoll
 * ist kein Beweis (P-19).
 *
 * Die längste Frist gewinnt: ein Sicherheitsereignis an einem Beleg bleibt
 * zehn Jahre, nicht zwei.
 */
import { and, eq, inArray, lt, not, or, sql } from 'drizzle-orm'
import { auditLog, signInAttempts } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'

const DAY = 24 * 60 * 60 * 1000

/** Aufbewahrungsfristen in Tagen. */
export const RETENTION_DAYS = {
  /** Buchhaltungsnahes: zehn Jahre, wie die Belege selbst. */
  buchhaltung: 10 * 365,
  /** Sicherheitsereignisse: zwei Jahre. Lang genug für „das war letztes Jahr". */
  sicherheit: 2 * 365,
  /** Der gewöhnliche Änderungseintrag: ein Jahr. */
  standard: 365,
  /** Anmeldeversuche: das ist ein Zähler, kein Archiv. */
  anmeldeversuche: 90,
} as const

/**
 * Tabellen, deren Einträge der Aufbewahrungspflicht unterliegen.
 *
 * Nicht „alles, was mit Geld zu tun hat", sondern die Datensätze, die ein
 * Prüfer sehen will: Belege samt Positionen und Zahlungen, Buchungen,
 * Nummernkreise, Kassenanhänge.
 */
export const ACCOUNTING_ENTITIES = [
  'documents',
  'document_items',
  'document_payments',
  'ledger_entries',
  'ledger_attachments',
  'number_ranges',
  'reminders',
  'vehicle_sales',
  'vehicle_purchases',
] as const

export type RotationResult = {
  /** Wie viele Einträge je Gruppe verschwunden sind. */
  standard: number
  sicherheit: number
  anmeldeversuche: number
  /** Der älteste Eintrag, der übrig blieb. */
  oldestRemaining: string | null
}

const cutoff = (days: number, now: Date) => new Date(now.getTime() - days * DAY).toISOString()

/**
 * Räumt auf und meldet, was sie getan hat.
 *
 * Wiederholbar: ein zweiter Lauf am selben Tag löscht nichts mehr und meldet
 * Nullen. Das ist keine Nebensache — eine Aufgabe, die mit einem Zeitplan
 * läuft, wird irgendwann zweimal gestartet.
 */
export async function rotateAuditLog(
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<RotationResult> {
  const buchhaltung = inArray(auditLog.entity, [...ACCOUNTING_ENTITIES])

  // Alles Gewöhnliche, das weder Sicherheit noch Buchhaltung ist.
  const standard = await executor
    .delete(auditLog)
    .where(and(
      lt(auditLog.at, cutoff(RETENTION_DAYS.standard, now)),
      not(eq(auditLog.severity, 'sicherheit')),
      or(sql`${auditLog.entity} IS NULL`, not(buchhaltung)),
    ))
    .returning({ id: auditLog.id })

  // Sicherheitsereignisse, sofern sie keinen Buchhaltungsdatensatz betreffen.
  const sicherheit = await executor
    .delete(auditLog)
    .where(and(
      lt(auditLog.at, cutoff(RETENTION_DAYS.sicherheit, now)),
      eq(auditLog.severity, 'sicherheit'),
      or(sql`${auditLog.entity} IS NULL`, not(buchhaltung)),
    ))
    .returning({ id: auditLog.id })

  // Buchhaltungsnahes, nach zehn Jahren.
  const buchhaltungsAlt = await executor
    .delete(auditLog)
    .where(and(
      lt(auditLog.at, cutoff(RETENTION_DAYS.buchhaltung, now)),
      buchhaltung,
    ))
    .returning({ id: auditLog.id })

  // Der Zähler für die Anmeldesperre. Er braucht kein Jahr — die längste Frist,
  // die ihn liest, ist ein Tag (P-13).
  const versuche = await executor
    .delete(signInAttempts)
    .where(lt(signInAttempts.at, cutoff(RETENTION_DAYS.anmeldeversuche, now)))
    .returning({ id: signInAttempts.id })

  const [oldest] = await executor
    .select({ at: sql<string | null>`min(${auditLog.at})` })
    .from(auditLog)

  return {
    standard: standard.length + buchhaltungsAlt.length,
    sicherheit: sicherheit.length,
    anmeldeversuche: versuche.length,
    oldestRemaining: oldest?.at ?? null,
  }
}
