import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  object,
  optional,
  picklist,
  pipe,
  number,
  string,
  trim,
  maxLength
} from 'valibot'
import {
  idSchema,
  notesSchema,
  optionalEmailSchema
} from '$lib/server/db/validation'
import {
  createEmployee,
  deleteEmployee,
  deleteSalaryVersion,
  getEffectiveSalary,
  getEmployee,
  listEmployees,
  listSalaryVersions,
  nextPersonnelNumber,
  updateEmployee,
  upsertSalaryVersion
} from '$lib/server/services/employee-service'
import {
  createAbsence,
  deleteAbsence,
  deleteAbsencesByIds,
  findVacationSickConflicts,
  getAbsence,
  listAbsencesForEmployee,
  remainingVacationDays,
  updateAbsence
} from '$lib/server/services/absence-service'
import { db } from '$lib/server/db/client'
import { and, asc, count as sqlCount, desc, eq, gte, lte } from 'drizzle-orm'
import { requirePermission } from '$lib/server/auth-guards'

const employeeInputSchema = object({
  personnelNumber: optional(pipe(string(), trim(), maxLength(30))),
  salutation: optional(pipe(string(), trim(), maxLength(30))),
  title: optional(pipe(string(), trim(), maxLength(30))),
  firstName: pipe(string(), trim(), maxLength(100)),
  lastName: pipe(string(), trim(), maxLength(100)),
  birthday: optional(pipe(string(), trim(), maxLength(10))),
  birthplace: optional(pipe(string(), trim(), maxLength(100))),
  nationality: optional(pipe(string(), trim(), maxLength(50))),
  street: optional(pipe(string(), trim(), maxLength(200))),
  zip: optional(pipe(string(), trim(), maxLength(10))),
  city: optional(pipe(string(), trim(), maxLength(150))),
  country: optional(pipe(string(), trim(), maxLength(100))),
  privateEmail: optionalEmailSchema,
  privatePhone: optional(pipe(string(), trim(), maxLength(30))),
  mobile: optional(pipe(string(), trim(), maxLength(30))),
  hireDate: optional(pipe(string(), trim(), maxLength(10))),
  terminationDate: optional(pipe(string(), trim(), maxLength(10))),
  position: optional(pipe(string(), trim(), maxLength(150))),
  department: optional(pipe(string(), trim(), maxLength(100))),
  employmentType: optional(pipe(string(), trim(), maxLength(30))),
  weeklyHours: optional(number()),
  monthlySalary: optional(number()),
  hourlyWage: optional(number()),
  vacationDaysPerYear: optional(number()),
  taxId: optional(pipe(string(), trim(), maxLength(30))),
  taxClass: optional(pipe(string(), trim(), maxLength(5))),
  socialInsuranceNumber: optional(pipe(string(), trim(), maxLength(30))),
  healthInsurance: optional(pipe(string(), trim(), maxLength(100))),
  bankAccountHolder: optional(pipe(string(), trim(), maxLength(200))),
  bankIban: optional(pipe(string(), trim(), maxLength(34))),
  bankBic: optional(pipe(string(), trim(), maxLength(11))),
  bankName: optional(pipe(string(), trim(), maxLength(100)))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  archived: optional(picklist(['active', 'archived', 'all']))
})

/**
 * Paginated employee list.
 *
 * @group integration
 * @module employees
 */
export const listEmployeesRemote = query(listSchema, async (params) => {
  requirePermission('employees')
  const archivedFilter =
    params.archived === 'archived'
      ? true
      : params.archived === 'active'
        ? false
        : undefined
  return listEmployees({ ...params, archived: archivedFilter })
})

/**
 * Load a single employee.
 *
 * @group integration
 * @module employees
 */
export const getEmployeeRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('employees')
    const e = await getEmployee(id)
    if (!e) error(404, 'Mitarbeiter nicht gefunden.')
    return e
  }
)

/**
 * Create employee.
 *
 * @remarks
 * Single-flight mutation. Pass `listEmployeesRemote` to `.updates(...)`.
 *
 * @group integration
 * @module employees
 */
export const createEmployeeRemote = command(
  employeeInputSchema,
  async (values) => {
    requirePermission('employees')
    const personnelNumber =
      values.personnelNumber || (await nextPersonnelNumber())
    // Stamm-Spalten ohne Gehalt — die Werte landen in
    // `employee_salary_versions` (initiale Version).
    const { monthlySalary, hourlyWage, ...rest } = values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await createEmployee({ ...(rest as any), personnelNumber })
    if (monthlySalary != null || hourlyWage != null) {
      await upsertSalaryVersion({
        employeeId: data.id,
        validFrom: data.hireDate ?? new Date().toISOString().slice(0, 10),
        monthlySalary: monthlySalary != null ? String(monthlySalary) : null,
        hourlyWage: hourlyWage != null ? String(hourlyWage) : null
      })
    }
    await requested(listEmployeesRemote, 4).refreshAll()
    return data
  }
)

/**
 * Update employee.
 *
 * @group integration
 * @module employees
 */
export const updateEmployeeRemote = command(
  object({ id: idSchema, values: employeeInputSchema }),
  async ({ id, values }) => {
    requirePermission('employees')
    // Gehaltswerte abspalten und nur dann eine neue Version anlegen,
    // wenn sich gegenüber der aktuell gültigen Version etwas ändert.
    const { monthlySalary, hourlyWage, ...rest } = values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await updateEmployee(id, rest as any)
    if (monthlySalary !== undefined || hourlyWage !== undefined) {
      const currentVersion = await getEffectiveSalary(id)
      const nextMonthly = monthlySalary != null ? String(monthlySalary) : null
      const nextHourly = hourlyWage != null ? String(hourlyWage) : null
      const changed =
        (currentVersion?.monthlySalary ?? null) !== nextMonthly ||
        (currentVersion?.hourlyWage ?? null) !== nextHourly
      if (changed) {
        await upsertSalaryVersion({
          employeeId: id,
          validFrom: new Date().toISOString().slice(0, 10),
          monthlySalary: nextMonthly,
          hourlyWage: nextHourly
        })
      }
    }
    await Promise.all([
      getEmployeeRemote({ id }).refresh(),
      requested(listEmployeesRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete employee.
 *
 * @group integration
 * @module employees
 */
export const deleteEmployeeRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('employees')
    await deleteEmployee(id)
    await requested(listEmployeesRemote, 4).refreshAll()
  }
)

/* ─── Versionierte Gehälter ───────────────────────────────────────── */

/**
 * Liefert die komplette Gehaltshistorie für einen Mitarbeiter
 * (neueste Version zuerst). Wird auf der Mitarbeiter-Detailseite als
 * eigene Karte angezeigt.
 *
 * @group integration
 * @module employees
 */
export const listEmployeeSalaryVersionsRemote = query(
  object({ employeeId: idSchema }),
  async ({ employeeId }) => {
    requirePermission('employees')
    return listSalaryVersions(employeeId)
  }
)

const salaryVersionSchema = object({
  employeeId: idSchema,
  validFrom: pipe(string(), trim(), maxLength(10)),
  monthlySalary: optional(number()),
  hourlyWage: optional(number())
})

/**
 * Legt eine neue Gehaltsversion an oder aktualisiert die Version mit
 * dem gleichen `valid_from`.
 *
 * @group integration
 * @module employees
 */
export const upsertEmployeeSalaryVersionRemote = command(
  salaryVersionSchema,
  async (data) => {
    requirePermission('employees')
    const row = await upsertSalaryVersion({
      employeeId: data.employeeId,
      validFrom: data.validFrom,
      monthlySalary:
        data.monthlySalary != null ? String(data.monthlySalary) : null,
      hourlyWage: data.hourlyWage != null ? String(data.hourlyWage) : null
    })
    await Promise.all([
      listEmployeeSalaryVersionsRemote({
        employeeId: data.employeeId
      }).refresh(),
      getEmployeeRemote({ id: data.employeeId }).refresh()
    ])
    return row
  }
)

/**
 * Löscht eine Gehaltsversion.
 *
 * @group integration
 * @module employees
 */
export const deleteEmployeeSalaryVersionRemote = command(
  object({ id: idSchema, employeeId: idSchema }),
  async ({ id, employeeId }) => {
    requirePermission('employees')
    await deleteSalaryVersion(id)
    await Promise.all([
      listEmployeeSalaryVersionsRemote({ employeeId }).refresh(),
      getEmployeeRemote({ id: employeeId }).refresh()
    ])
  }
)

/* ─── Abwesenheiten (Urlaub / Krankheit / Sonstiges) ──────────────── */

const absenceInputSchema = object({
  employeeId: idSchema,
  type: picklist(['vacation', 'sick', 'other']),
  /** YYYY-MM-DD. */
  dateFrom: pipe(string(), trim(), maxLength(10)),
  dateTo: pipe(string(), trim(), maxLength(10)),
  halfDay: optional(boolean()),
  notes: optional(notesSchema),
  status: optional(picklist(['planned', 'approved', 'cancelled'])),
  attachmentMime: optional(pipe(string(), trim(), maxLength(50))),
  attachmentName: optional(pipe(string(), trim(), maxLength(200))),
  attachmentData: optional(pipe(string(), maxLength(7_000_000))),
  /**
   * Wenn true, werden bestehende Urlaub/Krankheit-Konflikte vor dem
   * Anlegen gelöscht. Der Client setzt das Flag erst, nachdem der
   * Nutzer den Konflikt-Modal explizit bestätigt hat.
   */
  replaceConflicting: optional(boolean())
})

/**
 * List absences for an employee plus the current Resturlaub balance.
 * Filters by `year` if provided — an absence overlaps a year if its
 * range intersects `year-01-01..year-12-31`.
 *
 * @group integration
 * @module employees
 */
export const listAbsencesRemote = query(
  object({ employeeId: idSchema, year: optional(number()) }),
  async ({ employeeId, year }) => {
    requirePermission('employees')
    const [absences, balance] = await Promise.all([
      listAbsencesForEmployee(employeeId, { year: year ?? null }),
      remainingVacationDays(employeeId)
    ])
    return { absences, balance }
  }
)

/**
 * Create a new absence row.
 *
 * @group integration
 * @module employees
 */
export const createAbsenceRemote = command(absenceInputSchema, async (data) => {
  requirePermission('employees')
  if (data.type === 'sick') {
    const currentYear = new Date().getFullYear()
    const fromY = Number(data.dateFrom.slice(0, 4))
    const toY = Number(data.dateTo.slice(0, 4))
    if (fromY > currentYear || toY > currentYear) {
      error(400, 'Krankmeldungen für ein Folgejahr sind nicht zulässig.')
    }
  }
  // Belt-and-Braces: Server prüft Konflikte selbst nach. Ohne
  // Bestätigung blockieren wir den Insert mit 409, damit der Client
  // den Modal nachholen kann (z.B. bei direkten API-Aufrufen).
  const conflicts = await findVacationSickConflicts({
    employeeId: data.employeeId,
    type: data.type,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo
  })
  if (conflicts.length > 0) {
    if (!data.replaceConflicting) {
      error(
        409,
        'Konflikt mit bestehender Abwesenheit. Bitte im Konflikt-Dialog bestätigen.'
      )
    }
    await deleteAbsencesByIds(conflicts.map((c) => c.id))
  }
  const created = await createAbsence({
    employeeId: data.employeeId,
    type: data.type,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    halfDay: data.halfDay ?? false,
    notes: data.notes ?? null,
    status: data.status ?? 'approved',
    attachmentMime: data.attachmentMime ?? null,
    attachmentName: data.attachmentName ?? null,
    attachmentData: data.attachmentData ?? null
  })
  await listAbsencesRemote({ employeeId: data.employeeId }).refresh()
  return created
})

/**
 * Sucht Urlaub/Krankheit-Konflikte für eine geplante neue Abwesenheit.
 * Der Client ruft diese Query vor dem `createAbsenceRemote` und zeigt
 * bei Treffern den Bestätigungs-Modal.
 *
 * @group integration
 * @module employees
 */
export const getAbsenceConflictsRemote = query(
  object({
    employeeId: idSchema,
    type: picklist(['vacation', 'sick', 'other']),
    dateFrom: pipe(string(), trim(), maxLength(10)),
    dateTo: pipe(string(), trim(), maxLength(10)),
    excludeId: optional(idSchema)
  }),
  async (params) => {
    requirePermission('employees')
    return findVacationSickConflicts(params)
  }
)

/**
 * Update status / dates / notes of an existing absence.
 *
 * @group integration
 * @module employees
 */
export const updateAbsenceRemote = command(
  object({
    id: idSchema,
    values: object({
      type: optional(picklist(['vacation', 'sick', 'other'])),
      dateFrom: optional(pipe(string(), trim(), maxLength(10))),
      dateTo: optional(pipe(string(), trim(), maxLength(10))),
      halfDay: optional(boolean()),
      notes: optional(notesSchema),
      status: optional(picklist(['planned', 'approved', 'cancelled']))
    })
  }),
  async ({ id, values }) => {
    requirePermission('employees')
    // Folgejahr-Krankmeldung auch beim Update verhindern (z.B. wenn der
    // Typ auf 'sick' geändert oder die Daten verschoben werden).
    if (values.type === 'sick' || values.dateFrom || values.dateTo) {
      const existing = await getAbsence(id)
      if (existing) {
        const effectiveType = values.type ?? existing.type
        if (effectiveType === 'sick') {
          const currentYear = new Date().getFullYear()
          const fromY = Number(
            (values.dateFrom ?? existing.dateFrom).slice(0, 4)
          )
          const toY = Number((values.dateTo ?? existing.dateTo).slice(0, 4))
          if (fromY > currentYear || toY > currentYear) {
            error(400, 'Krankmeldungen für ein Folgejahr sind nicht zulässig.')
          }
        }
      }
    }
    const row = await updateAbsence(id, values)
    await listAbsencesRemote({ employeeId: row.employeeId }).refresh()
    return row
  }
)

/**
 * Delete an absence row.
 *
 * @group integration
 * @module employees
 */
export const deleteAbsenceRemote = command(
  object({ id: idSchema, employeeId: idSchema }),
  async ({ id, employeeId }) => {
    requirePermission('employees')
    await deleteAbsence(id)
    await listAbsencesRemote({ employeeId }).refresh()
  }
)
