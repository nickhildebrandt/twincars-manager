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
  bicSchema,
  dateStringSchema,
  ibanSchema,
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
  checkVacationBudget,
  createAbsence,
  deleteAbsence,
  deleteAbsencesByIds,
  findSameTypeOverlaps,
  findVacationSickConflicts,
  getAbsence,
  listAbsencesWithWorkdays,
  remainingVacationDays,
  updateAbsence
} from '$lib/server/services/absence-service'
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
  bankIban: optional(ibanSchema),
  bankBic: optional(bicSchema),
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

const absenceTypeSchema = picklist(
  ['vacation', 'sick', 'other'],
  'Bitte einen gültigen Abwesenheitstyp wählen.'
)
const absenceStatusSchema = picklist(
  ['planned', 'approved', 'cancelled'],
  'Bitte einen gültigen Status wählen.'
)

const absenceInputSchema = object({
  employeeId: idSchema,
  type: absenceTypeSchema,
  /** YYYY-MM-DD. */
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  halfDay: optional(boolean()),
  notes: optional(notesSchema),
  status: optional(absenceStatusSchema),
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

/** Longest span a single absence entry may cover (inclusive days). */
const MAX_ABSENCE_SPAN_DAYS = 366

const DAY_MS = 24 * 60 * 60 * 1000

const formatGermanDate = (iso: string): string =>
  `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

const formatDays = (n: number): string => n.toLocaleString('de-DE')

/**
 * Cross-field range checks shared by create and update — curated
 * German 400s (valibot already guaranteed both dates are well-formed).
 */
const assertValidAbsenceRange = (values: {
  dateFrom: string
  dateTo: string
  halfDay?: boolean
}): void => {
  if (values.dateTo < values.dateFrom) {
    error(400, 'Bis-Datum darf nicht vor dem Von-Datum liegen.')
  }
  const spanDays =
    Math.round(
      (Date.parse(`${values.dateTo}T00:00:00Z`) -
        Date.parse(`${values.dateFrom}T00:00:00Z`)) /
        DAY_MS
    ) + 1
  if (spanDays > MAX_ABSENCE_SPAN_DAYS) {
    error(
      400,
      'Der Zeitraum ist zu lang - bitte höchstens ein Jahr je Eintrag erfassen.'
    )
  }
  if (values.halfDay && values.dateFrom !== values.dateTo) {
    error(400, 'Ein halber Tag ist nur bei eintägigen Abwesenheiten möglich.')
  }
}

/** Sick notes must not be pre-dated into a future year. */
const assertNoFutureSick = (values: {
  type: string
  dateFrom: string
  dateTo: string
}): void => {
  if (values.type !== 'sick') return
  const currentYear = new Date().getFullYear()
  const fromY = Number(values.dateFrom.slice(0, 4))
  const toY = Number(values.dateTo.slice(0, 4))
  if (fromY > currentYear || toY > currentYear) {
    error(400, 'Krankmeldungen für ein Folgejahr sind nicht zulässig.')
  }
}

/**
 * Same-type overlaps are always a hard 400 — they would double-count
 * the period (vacation days drawn twice, duplicated sick days).
 * Cross-type vacation↔sick conflicts keep their separate 409 +
 * replace-confirmation flow.
 */
const assertNoSameTypeOverlap = async (params: {
  employeeId: string
  type: 'vacation' | 'sick' | 'other'
  dateFrom: string
  dateTo: string
  excludeId?: string
}): Promise<void> => {
  const overlaps = await findSameTypeOverlaps(params)
  if (overlaps.length > 0) {
    const first = overlaps[0]
    error(
      400,
      `Der Zeitraum überschneidet sich mit einer bestehenden Abwesenheit gleicher Art (${formatGermanDate(
        first.dateFrom
      )} - ${formatGermanDate(first.dateTo)}).`
    )
  }
}

/**
 * Hard vacation-budget gate (spec: "harte Sperre"): a vacation entry
 * must fit into the remaining allowance of every calendar year it
 * touches. Employees without a configured entitlement have no limit.
 */
const assertVacationBudget = async (params: {
  employeeId: string
  type: string
  status: string
  dateFrom: string
  dateTo: string
  halfDay?: boolean
  excludeId?: string
}): Promise<void> => {
  if (params.type !== 'vacation' || params.status === 'cancelled') return
  const violation = await checkVacationBudget(params)
  if (violation) {
    error(
      400,
      `Nur noch ${formatDays(violation.remaining)} Urlaubstage im Jahr ${
        violation.year
      } verfügbar (angefragt: ${formatDays(violation.requested)}).`
    )
  }
}

/**
 * List absences for an employee plus the Resturlaub balance of the
 * requested year (default: current year). Filters by `year` if
 * provided — an absence overlaps a year if its range intersects
 * `year-01-01..year-12-31`. Rows carry server-computed workday counts
 * (weekends + public holidays skipped), both for the full range and
 * clamped to the filter year.
 *
 * @group integration
 * @module employees
 */
export const listAbsencesRemote = query(
  object({ employeeId: idSchema, year: optional(number()) }),
  async ({ employeeId, year }) => {
    requirePermission('employees')
    const balanceYear = year ?? new Date().getFullYear()
    const [absences, balance] = await Promise.all([
      listAbsencesWithWorkdays(employeeId, { year: year ?? null }),
      remainingVacationDays(employeeId, balanceYear)
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
  assertValidAbsenceRange(data)
  assertNoFutureSick(data)
  await assertNoSameTypeOverlap({
    employeeId: data.employeeId,
    type: data.type,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo
  })
  await assertVacationBudget({
    employeeId: data.employeeId,
    type: data.type,
    status: data.status ?? 'approved',
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    halfDay: data.halfDay ?? false
  })
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
  // Refresh every subscribed key — the detail page queries with an
  // additional `year` arg, so an exact-args refresh would miss it.
  await requested(listAbsencesRemote, 4).refreshAll()
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
    type: absenceTypeSchema,
    dateFrom: dateStringSchema,
    dateTo: dateStringSchema,
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
      type: optional(absenceTypeSchema),
      dateFrom: optional(dateStringSchema),
      dateTo: optional(dateStringSchema),
      halfDay: optional(boolean()),
      notes: optional(notesSchema),
      status: optional(absenceStatusSchema)
    })
  }),
  async ({ id, values }) => {
    requirePermission('employees')
    const existing = await getAbsence(id)
    if (!existing) error(404, 'Abwesenheit nicht gefunden.')
    // Alle Prüfungen laufen gegen den effektiven (gemergten) Zustand —
    // z.B. wenn nur der Typ auf 'sick' geändert oder ein Datum
    // verschoben wird.
    const next = {
      employeeId: existing.employeeId,
      type: values.type ?? (existing.type as 'vacation' | 'sick' | 'other'),
      dateFrom: values.dateFrom ?? existing.dateFrom,
      dateTo: values.dateTo ?? existing.dateTo,
      halfDay: values.halfDay ?? existing.halfDay,
      status: values.status ?? existing.status
    }
    assertValidAbsenceRange(next)
    assertNoFutureSick(next)
    if (next.status !== 'cancelled') {
      await assertNoSameTypeOverlap({
        employeeId: next.employeeId,
        type: next.type,
        dateFrom: next.dateFrom,
        dateTo: next.dateTo,
        excludeId: id
      })
      // Kein Ersetzen-Flow beim Update — ein Kreuz-Konflikt (Urlaub↔
      // Krankheit) wird mit kuratierter Meldung abgelehnt; der Nutzer
      // passt zuerst den bestehenden Eintrag an.
      const conflicts = await findVacationSickConflicts({
        employeeId: next.employeeId,
        type: next.type,
        dateFrom: next.dateFrom,
        dateTo: next.dateTo,
        excludeId: id
      })
      if (conflicts.length > 0) {
        error(
          409,
          'Konflikt mit bestehender Abwesenheit (Urlaub/Krankheit) im gleichen Zeitraum. Bitte zuerst den bestehenden Eintrag anpassen.'
        )
      }
      await assertVacationBudget({ ...next, excludeId: id })
    }
    const row = await updateAbsence(id, values)
    await requested(listAbsencesRemote, 4).refreshAll()
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
    await requested(listAbsencesRemote, 4).refreshAll()
  }
)
