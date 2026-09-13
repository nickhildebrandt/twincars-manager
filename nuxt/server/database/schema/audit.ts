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
 * Dieses Protokoll ersetzt weitere feldbezogene Versionstabellen. Es bleiben
 * genau drei: Reifenpreis, Artikelpreis, Gehaltsstand — Werte, die **ab einem
 * Datum gelten** und in der Zukunft liegen dürfen. Das Protokoll beantwortet
 * „wer hat was geändert", die Version „was gilt ab wann". Einen Preis aus
 * einem Änderungsprotokoll rückwärts zu rekonstruieren wäre die falsche
 * Antwort auf die falsche Frage.
 */
import { pgTable, uuid, varchar, boolean, timestamp, index, jsonb, text, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { auditActions } from '../../../shared/domain.ts'

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

  /** Woran: Tabellenname und Schlüssel des betroffenen Datensatzes. */
  entity: varchar({ length: 60 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }).notNull(),

  /** Was: angelegt, geändert oder gelöscht. */
  action: varchar({ length: 20 }).notNull(),

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
  // Der Zeitstrahl eines Datensatzes ist die häufigste Abfrage.
  index('audit_log_entity_idx').using('btree', table.entity.asc().nullsLast(), table.entityId.asc().nullsLast(), table.at.desc().nullsLast()),
  index('audit_log_at_idx').using('btree', table.at.desc().nullsLast()),
  index('audit_log_user_id_idx').using('btree', table.userId.asc().nullsLast()),
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
  /** Warum es scheiterte, in einem Wort: `passwort`, `unbekannt`, `gesperrt`, `drossel`. */
  reason: varchar({ length: 20 }),
}, table => [
  index('sign_in_attempts_at_idx').using('btree', table.at.desc().nullsLast()),
  index('sign_in_attempts_username_idx').using('btree', table.username.asc().nullsLast(), table.at.desc().nullsLast()),
  index('sign_in_attempts_address_idx').using('btree', table.clientAddress.asc().nullsLast(), table.at.desc().nullsLast()),
])
