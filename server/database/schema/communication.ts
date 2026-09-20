/**
 * E-Mail-Versand, Vorlagen und Beiträge
 *
 * Der Versand wird protokolliert — Metadaten und Klartext, nie Anhänge.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, integer, boolean, timestamp, index, uniqueIndex, text, jsonb, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { messageKinds, messageStatuses, messageSubjects, smtpSecurities } from '../../../shared/domain.ts'
import { sql } from 'drizzle-orm'

export const sentMessages = pgTable('sent_messages', {
  id: uuid().defaultRandom().primaryKey().notNull(),

  /**
   * Worauf sich die Nachricht bezog (M-34).
   *
   * Beim Vorgänger stand hier ein Verweis auf einen Beleg und sonst nichts,
   * obwohl Zahlungserinnerungen, Reifen-Erinnerungen und Antworten auf Anfragen
   * denselben Weg nehmen. Jetzt zwei Felder: die Art des Vorgangs und seine
   * Kennung. Kein Fremdschlüssel — das Protokoll muss den Vorgang überleben,
   * sonst verschwände mit ihm die Spur, dass etwas rausging.
   */
  subjectType: varchar('subject_type', { length: 30 }).notNull(),
  subjectId: varchar('subject_id', { length: 64 }),

  /** Welche Art Nachricht es war — für den Filter der Versandhistorie. */
  documentType: varchar('document_type', { length: 30 }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 254 }).notNull(),
  recipientName: varchar('recipient_name', { length: 200 }),
  subject: varchar({ length: 200 }).notNull(),
  bodyText: text('body_text').notNull(),
  attachmentMeta: jsonb('attachment_meta').default([]),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  // Die Zeile entsteht VOR dem Versand, damit ein Absturz eine Spur
  // hinterlässt. Der Vorgabewert war beim Vorgänger 'sent', während jeder
  // Sendeweg 'pending' eintrug — ein Widerspruch, der nur nicht auffiel.
  status: varchar({ length: 20 }).default('wartend').notNull(),
  errorMessage: text('error_message'),
  smtpMessageId: varchar('smtp_message_id', { length: 200 }),
}, table => [
  check('sent_messages_status_check', oneOf(table.status, messageStatuses.values)),
  check('sent_messages_document_type_check', oneOf(table.documentType, messageKinds.values)),
  check('sent_messages_subject_type_check', oneOf(table.subjectType, messageSubjects.values)),
  index('sent_messages_subject_idx').using('btree', table.subjectType.asc().nullsLast(), table.subjectId.asc().nullsLast()),
  index('sent_messages_sent_at_idx').using('btree', table.sentAt.asc().nullsLast()),
])

export const mailTemplates = pgTable('mail_templates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  key: varchar({ length: 50 }).notNull(),
  subject: varchar({ length: 200 }).notNull(),
  body: text().notNull(),
  isCustom: boolean('is_custom').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('mail_templates_key_idx').using('btree', table.key.asc().nullsLast()),
])

export const smtpSettings = pgTable('smtp_settings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  host: varchar({ length: 255 }).default('').notNull(),
  port: integer().default(587).notNull(),
  secure: varchar({ length: 10 }).default('STARTTLS').notNull(),
  username: varchar({ length: 200 }).default('').notNull(),
  password: text().default('').notNull(),
  fromAddress: varchar('from_address', { length: 254 }).default('').notNull(),
  fromName: varchar('from_name', { length: 200 }).default('').notNull(),
  replyTo: varchar('reply_to', { length: 254 }),
  verified: boolean().default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('smtp_settings_secure_check', oneOf(table.secure, smtpSecurities.values)),
  uniqueIndex('smtp_settings_singleton').using('btree', sql`((true))`),
])

export const posts = pgTable('posts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  title: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 220 }).notNull(),
  excerpt: varchar({ length: 500 }),
  body: text().notNull(),
  coverImage: jsonb('cover_image'),
  published: boolean().default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('posts_published_idx').using('btree', table.published.asc().nullsLast(), table.publishedAt.asc().nullsLast()),
  uniqueIndex('posts_slug_idx').using('btree', table.slug.asc().nullsLast()),
])
