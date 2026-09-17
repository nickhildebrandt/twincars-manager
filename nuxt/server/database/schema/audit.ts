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
import { pgTable, uuid, varchar, boolean, timestamp, index, jsonb, text, check } from 'drizzle-orm/pg-core'
import { oneOf, oneOfOrNull } from './_checks.ts'
import { auditActions, auditSeverities, signInFailures } from '../../../shared/domain.ts'

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
