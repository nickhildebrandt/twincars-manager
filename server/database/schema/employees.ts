/**
 * Mitarbeiter, Abwesenheiten, Zeiten und Öffnungszeiten
 *
 * Gehälter sind versioniert und stichtagsgenau auflösbar.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text, time, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { absenceStatuses, absenceTypes } from '../../../shared/domain.ts'

export const employees = pgTable('employees', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  personnelNumber: varchar('personnel_number', { length: 30 }).notNull(),
  salutation: varchar({ length: 30 }),
  title: varchar({ length: 30 }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthday: date(),
  birthplace: varchar({ length: 100 }),
  nationality: varchar({ length: 50 }),
  street: varchar({ length: 200 }),
  zip: varchar({ length: 10 }),
  city: varchar({ length: 150 }),
  country: varchar({ length: 100 }).default('Deutschland'),
  privateEmail: varchar('private_email', { length: 254 }),
  privatePhone: varchar('private_phone', { length: 30 }),
  mobile: varchar({ length: 30 }),
  hireDate: date('hire_date'),
  terminationDate: date('termination_date'),
  position: varchar({ length: 150 }),
  department: varchar({ length: 100 }),
  employmentType: varchar('employment_type', { length: 30 }),
  weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 }),
  vacationDaysPerYear: integer('vacation_days_per_year'),
  taxId: varchar('tax_id', { length: 30 }),
  taxClass: varchar('tax_class', { length: 5 }),
  socialInsuranceNumber: varchar('social_insurance_number', { length: 30 }),
  healthInsurance: varchar('health_insurance', { length: 100 }),
  bankAccountHolder: varchar('bank_account_holder', { length: 200 }),
  bankIban: varchar('bank_iban', { length: 34 }),
  bankBic: varchar('bank_bic', { length: 11 }),
  bankName: varchar('bank_name', { length: 100 }),
  archived: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('employees_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  uniqueIndex('employees_personnel_number_idx').using('btree', table.personnelNumber.asc().nullsLast()),
])

export const employeeAbsences = pgTable('employee_absences', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  employeeId: uuid('employee_id').notNull(),
  type: varchar({ length: 20 }).notNull(),
  dateFrom: date('date_from').notNull(),
  dateTo: date('date_to').notNull(),
  halfDay: boolean('half_day').default(false).notNull(),
  notes: text(),
  status: varchar({ length: 20 }).default('approved').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  attachmentMime: varchar('attachment_mime', { length: 50 }),
  attachmentName: varchar('attachment_name', { length: 200 }),
  attachmentData: text('attachment_data'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('employee_absences_type_check', oneOf(table.type, absenceTypes.values)),
  check('employee_absences_status_check', oneOf(table.status, absenceStatuses.values)),
  index('employee_absences_date_from_idx').using('btree', table.dateFrom.asc().nullsLast()),
  index('employee_absences_employee_id_idx').using('btree', table.employeeId.asc().nullsLast()),
  // M-38: Gehaltsstände sind Personalunterlagen. Ein Mitarbeiter mit
  // Gehaltshistorie wird deaktiviert (M-12), nie gelöscht.
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'employee_absences_employee_id_employees_id_fk',
  }).onDelete('no action'),
])

export const employeeSalaryVersions = pgTable('employee_salary_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  employeeId: uuid('employee_id').notNull(),
  validFrom: date('valid_from').notNull(),
  monthlySalary: integer('monthly_salary'),
  hourlyWage: integer('hourly_wage'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('employee_salary_versions_emp_from_idx').using('btree', table.employeeId.asc().nullsLast(), table.validFrom.asc().nullsLast()),
  index('employee_salary_versions_employee_idx').using('btree', table.employeeId.asc().nullsLast()),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'employee_salary_versions_employee_id_employees_id_fk',
  }).onDelete('no action'),
])

export const workshopHours = pgTable('workshop_hours', {
  weekday: integer().primaryKey().notNull(),
  opensAt: time('opens_at').default('08:00:00').notNull(),
  closesAt: time('closes_at').default('17:00:00').notNull(),
  closed: boolean().default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
})
