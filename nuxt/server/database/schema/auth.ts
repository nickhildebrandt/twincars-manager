/**
 * Anmeldung, Sitzungen, Rollen und Rechte
 *
 * Die vier better-auth-Tabellen bleiben unverändert, damit Passwörter und
 * laufende Sitzungen den Umbau überstehen.
 *
 * Ihre Zeitstempel stehen auf `mode: 'date'`, weil die Bibliothek `Date`
 * übergibt und liest. Die fachlichen Tabellen führen Zeichenketten — der
 * Spaltentyp ist in beiden Fällen `timestamptz`, es geht nur darum, was der
 * Treiber erwartet.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, boolean, timestamp, index, uniqueIndex, foreignKey, text, primaryKey } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text(),
  username: text(),
  displayUsername: text('display_username'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
  active: boolean().default(true).notNull(),
}, table => [
  uniqueIndex('users_email_idx').using('btree', table.email.asc().nullsLast()),
  uniqueIndex('users_username_idx').using('btree', table.username.asc().nullsLast()),
])

export const sessions = pgTable('sessions', {
  id: text().primaryKey().notNull(),
  userId: text('user_id').notNull(),
  token: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, table => [
  uniqueIndex('sessions_token_idx').using('btree', table.token.asc().nullsLast()),
  index('sessions_user_id_idx').using('btree', table.userId.asc().nullsLast()),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'sessions_user_id_users_id_fk',
  }).onDelete('cascade'),
])

export const accounts = pgTable('accounts', {
  id: text().primaryKey().notNull(),
  userId: text('user_id').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true, mode: 'date' }),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, table => [
  index('accounts_user_id_idx').using('btree', table.userId.asc().nullsLast()),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'accounts_user_id_users_id_fk',
  }).onDelete('cascade'),
])

export const verifications = pgTable('verifications', {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, table => [
  index('verifications_identifier_idx').using('btree', table.identifier.asc().nullsLast()),
])

export const roles = pgTable('roles', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  uniqueIndex('roles_name_idx').using('btree', table.name.asc().nullsLast()),
])

export const userRoles = pgTable('user_roles', {
  userId: text('user_id').notNull(),
  roleId: uuid('role_id').notNull(),
}, table => [
  index('user_roles_role_id_idx').using('btree', table.roleId.asc().nullsLast()),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'user_roles_user_id_users_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [roles.id],
    name: 'user_roles_role_id_roles_id_fk',
  }).onDelete('cascade'),
  primaryKey({ columns: [table.userId, table.roleId], name: 'user_roles_pk' }),
])

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull(),
  permission: varchar({ length: 100 }).notNull(),
}, table => [
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [roles.id],
    name: 'role_permissions_role_id_roles_id_fk',
  }).onDelete('cascade'),
  primaryKey({ columns: [table.roleId, table.permission], name: 'role_permissions_pk' }),
])
