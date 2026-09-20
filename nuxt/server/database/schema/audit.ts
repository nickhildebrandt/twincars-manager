/**
 * Das Ereignisprotokoll
 *
 * Wer hat wann an welchem Datensatz was geändert — mit altem und neuem Wert.
 * Daraus speist sich jede Historie-Anzeige (M-01).
 *
 * **Ein Eintrag je Speichervorgang, nicht je Feld.** Genau das will ein
 * Zeitstrahl zeigen: „am 4. März hat Anna die Anschrift und die Telefonnummer
 * geändert" — nicht zwei Einträge, die zufällig dieselbe Sekunde tragen. Die
 * geänderten Felder reisen im Eintrag mit.
 *
 * **Es ist zugleich das Sicherheitsprotokoll** (M-39). Anmeldung, Sperre,
 * abgewiesener Zugriff, Rechteänderung und Export stehen in derselben Tabelle,
 * unterschieden durch ihr `severity`. Wer wissen will, was am
 * Dienstagnachmittag geschah, soll an **einer** Stelle nachsehen.
 *
 * **Nachträglich unveränderlich** (P-19): geschrieben und gelesen, nie
 * geändert. Ein Protokoll, das sich bearbeiten lässt, ist kein Beweis. Die
 * einzige Ausnahme ist die Rotation, und die löscht nur ganze Einträge nach
 * Alter.
 *
 * Dieses Protokoll ersetzt weitere feldbezogene Versionstabellen. Es bleiben
 * genau drei: Reifenpreis, Artikelpreis, Gehaltsstand — Werte, die **ab einem
 * Datum gelten** und in der Zukunft liegen dürfen. Das Protokoll beantwortet
 * „wer hat was geändert", die Version „was gilt ab wann". Einen Preis aus
 * einem Änderungsprotokoll rückwärts zu rekonstruieren wäre die falsche
 * Antwort auf die falsche Frage.
 */
import { pgTable, uuid, varchar, boolean, timestamp, integer, index, uniqueIndex, jsonb, text, check } from 'drizzle-orm/pg-core'
import { oneOf, oneOfOrNull } from './_checks.ts'
import { sql } from 'drizzle-orm'
import { auditActions, auditSeverities, signInFailures, versionedEntities } from '../../../shared/domain.ts'

export const auditLog = pgTable('audit_log', {
  id: uuid().defaultRandom().primaryKey().notNull(),

  /** Wann. */
  at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),

  /**
   * Wer. Der Verweis ist absichtlich **kein** Fremdschlüssel: das Protokoll
   * muss einen gelöschten Benutzer überleben, sonst verschwände mit ihm die
   * Spur seiner Änderungen.
   */
  userId: text('user_id'),
  /** Der Name zum Zeitpunkt der Änderung — eingefroren wie bei einem Beleg. */
  userName: varchar('user_name', { length: 200 }),

  /**
   * Von wo. Hinter einem Proxy die weitergereichte Adresse, sonst die des
   * Anschlusses — dieselbe Regel wie bei der Drossel (B-003, B-054).
   */
  clientAddress: varchar('client_address', { length: 64 }),

  /**
   * Woran: Tabellenname und Schlüssel des betroffenen Datensatzes.
   *
   * Beides darf leer sein. Ein Sicherheitsereignis betrifft nicht immer einen
   * Datensatz — ein abgewiesener Zugriff etwa betrifft einen **Pfad**, und der
   * steht dann in `note`.
   */
  entity: varchar({ length: 60 }),
  entityId: varchar('entity_id', { length: 64 }),

  /** Was: angelegt, geändert, gelöscht, angemeldet, abgewiesen, … */
  action: varchar({ length: 20 }).notNull(),

  /**
   * Wie schwer es wiegt (M-39). Entscheidet über die Hervorhebung in der
   * Oberfläche **und** über die Aufbewahrung (P-20).
   */
  severity: varchar({ length: 20 }).default('info').notNull(),

  /**
   * Die geänderten Felder, je Eintrag:
   * `[{ field: 'city', before: 'Ulm', after: 'Neu-Ulm' }]`.
   *
   * Beim Anlegen steht `before` auf `null`, beim Löschen `after`.
   */
  changes: jsonb().$type<{ field: string, before: unknown, after: unknown }[]>()
    .default([]).notNull(),

  /** Kurzer deutscher Satz für den Zeitstrahl, falls die Felder nichts sagen. */
  note: varchar({ length: 300 }),
}, table => [
  check('audit_log_action_check', oneOf(table.action, auditActions.values)),
  check('audit_log_severity_check', oneOf(table.severity, auditSeverities.values)),
  // Der Zeitstrahl eines Datensatzes ist die häufigste Abfrage.
  index('audit_log_entity_idx').using('btree', table.entity.asc().nullsLast(), table.entityId.asc().nullsLast(), table.at.desc().nullsLast()),
  index('audit_log_at_idx').using('btree', table.at.desc().nullsLast()),
  index('audit_log_user_id_idx').using('btree', table.userId.asc().nullsLast()),
  // Die zweite häufige Abfrage: „zeig mir nur die Sicherheitsereignisse".
  index('audit_log_severity_idx').using('btree', table.severity.asc().nullsLast(), table.at.desc().nullsLast()),
])

/**
 * Anmeldeversuche — auch die gescheiterten (M-36).
 *
 * Eine Drossel allein macht nicht sichtbar, dass jemand systematisch probiert.
 * Dafür braucht es eine Spur: wer, von wo, wann, und ob es geklappt hat.
 *
 * Der Benutzername wird festgehalten, **auch wenn es ihn nicht gibt** — gerade
 * dann ist der Versuch interessant. Deshalb kein Fremdschlüssel.
 */
/**
 * Der vollständige Stand eines Datensatzes bei jedem Speichern (M-45).
 *
 * Die dritte Zeitleiste der Anwendung, und sie beantwortet eine andere Frage
 * als die beiden anderen:
 *
 *   - `audit_log` (M-01): **wer** hat wann **was geändert** — Spur, rotiert.
 *   - `document_snapshots` (M-42): wie sahen die **Verweise eines Belegs**
 *     beim Ausstellen aus — Beweis, unveränderlich.
 *   - Hier: wie sah **dieser Datensatz** nach jedem Speichern aus — damit man
 *     einen früheren Stand **wieder aufnehmen** kann.
 *
 * Warum nicht aus dem Protokoll ableiten? Weil das Protokoll nur die
 * **Unterschiede** speichert und nach Frist gelöscht wird (P-20). Einen Stand
 * daraus rückwärts zusammenzusetzen ginge genau so lange gut, bis die erste
 * Rotation gelaufen ist — und dann still nicht mehr.
 *
 * `entity_id` trägt **keinen** Fremdschlüssel: die Spalte zeigt je nach
 * `entity` auf verschiedene Tabellen. Sie muss den Datensatz ohnehin
 * überleben — ein Stand, der mit seinem Datensatz verschwindet, ist keiner.
 */
export const recordVersions = pgTable('record_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  /** Woraus der Stand stammt — `customers`, `vehicles`, … */
  entity: varchar({ length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  /** 1, 2, 3 … je Datensatz. */
  version: integer().notNull(),
  /** Der vollständige Stand. Ohne Kennung, Zeitstempel und Geheimnisse. */
  data: jsonb().$type<Record<string, unknown>>().notNull(),
  /**
   * Der Stand, aus dem dieser wiederhergestellt wurde.
   *
   * Gesetzt macht er aus einem Rücksprung einen sichtbaren Vorgang: „Stand 2
   * wieder aufgenommen" statt einer stillen Änderung, die aussieht wie jede
   * andere.
   */
  restoredFromVersion: integer('restored_from_version'),
  /** Ein deutscher Halbsatz für den Zeitstrahl. */
  note: varchar({ length: 300 }),
  /** Wer. Kein Fremdschlüssel — der Stand überlebt den Benutzer. */
  changedBy: text('changed_by'),
  changedByName: varchar('changed_by_name', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('record_versions_entity_check', oneOf(table.entity, versionedEntities.values)),
  check('record_versions_version_check', sql`${table.version} >= 1`),
  // Ein Stand kann nicht aus sich selbst oder aus einem späteren stammen.
  check('record_versions_restored_check', sql`${table.restoredFromVersion} IS NULL OR ${table.restoredFromVersion} < ${table.version}`),
  uniqueIndex('record_versions_entity_version_idx').using('btree', table.entity.asc().nullsLast(), table.entityId.asc().nullsLast(), table.version.asc().nullsLast()),
  index('record_versions_timeline_idx').using('btree', table.entity.asc().nullsLast(), table.entityId.asc().nullsLast(), table.version.desc().nullsLast()),
])

/**
 * Was zu einer Adresse festgehalten werden muss (P-15, P-22).
 *
 * Die **ersten beiden** Stufen der Staffel werden gerechnet — aus den
 * Fehlversuchen der letzten vierundzwanzig Stunden. Sie enden von selbst, und
 * genau so soll es sein.
 *
 * Die **oberste** Stufe darf nicht gerechnet werden: gerechnet wäre sie nach
 * vierundzwanzig Stunden von allein weg, weil die Fehlversuche aus dem
 * Zählfenster fallen. Das wäre keine dauerhafte Sperre, sondern die zweite
 * unter anderem Namen — derselbe Fehler, der bei den Konten schon einmal
 * dringestanden hat. Also steht sie hier, als Datum.
 *
 * Daneben das Gegenstück: wann ein Administrator die Adresse wieder
 * freigegeben hat. Ab diesem Zeitpunkt beginnt die Zählung neu.
 */
export const addressLocks = pgTable('address_locks', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  /** Die Adresse, genau so geschrieben, wie gezählt wird. */
  address: varchar({ length: 64 }).notNull(),
  /** Wann sie dauerhaft gesperrt wurde. Leer heißt: nie. */
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
  /** Wann sie zuletzt freigegeben wurde. Später als `locked_at` hebt auf. */
  unlockedAt: timestamp('unlocked_at', { withTimezone: true, mode: 'date' }),
  /** Wer freigegeben hat. Kein Fremdschlüssel — der Eintrag überlebt den Benutzer. */
  unlockedBy: text('unlocked_by'),
  unlockedByName: varchar('unlocked_by_name', { length: 200 }),
}, table => [
  uniqueIndex('address_locks_address_idx').using('btree', table.address.asc().nullsLast()),
])

export const signInAttempts = pgTable('sign_in_attempts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  /** So, wie er eingegeben wurde — klein geschrieben, sonst unverändert. */
  username: varchar({ length: 64 }).notNull(),
  /** Die Adresse, die gezählt wurde. Hinter einem Proxy die weitergereichte. */
  clientAddress: varchar('client_address', { length: 64 }),
  succeeded: boolean().notNull(),
  /** Warum es scheiterte, in einem Wort — die Liste steht in `shared/domain.ts`. */
  reason: varchar({ length: 20 }),
}, table => [
  check('sign_in_attempts_reason_check', oneOfOrNull(table.reason, signInFailures.values)),
  index('sign_in_attempts_at_idx').using('btree', table.at.desc().nullsLast()),
  index('sign_in_attempts_username_idx').using('btree', table.username.asc().nullsLast(), table.at.desc().nullsLast()),
  index('sign_in_attempts_address_idx').using('btree', table.clientAddress.asc().nullsLast(), table.at.desc().nullsLast()),
])
