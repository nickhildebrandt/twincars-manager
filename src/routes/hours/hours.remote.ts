import { command, query, requested, getRequestEvent } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  maxLength,
  maxValue,
  minValue,
  nullable,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { employees } from '$lib/server/db/schema'
import {
  dateStringSchema,
  idSchema,
  notesSchema
} from '$lib/server/db/validation'
import {
  requireAnyPermission,
  requirePermission,
  requireUser
} from '$lib/server/auth-guards'
import { hasPermission } from '$lib/server/auth-permissions'
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
  listTimeEntries,
  monthlyReport,
  updateTimeEntry,
  utilizationSummary
} from '$lib/server/services/time-entry-service'

/* ───────────────────────────────────────────────────────────────────── */
/* Helpers                                                              */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Resolve the employee row that belongs to the currently signed-in
 * user via `employees.privateEmail === users.email`. The auth `users`
 * table doesn't store an employeeId reference, so the email is the
 * only canonical bridge.
 *
 * Returns `null` when no employee row matches — the caller decides
 * whether to treat that as "empty result" (list page) or "forbidden"
 * (mutation).
 */
async function resolveCurrentEmployeeId(): Promise<string | null> {
  const event = getRequestEvent()
  const userEmail = event.locals.user?.email
  if (!userEmail) return null
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(eq(employees.privateEmail, userEmail), eq(employees.archived, false))
    )
    .limit(1)
  return row?.id ?? null
}

/**
 * `true` when the caller holds the full `hours` module grant (or the
 * wildcard). Callers with only `hours:write_own` get `false` and are
 * scoped to their own time entries.
 */
function callerCanReadAll(): boolean {
  const event = getRequestEvent()
  return hasPermission(event.locals.permissions, 'hours')
}

/* ───────────────────────────────────────────────────────────────────── */
/* Schemas                                                              */
/* ───────────────────────────────────────────────────────────────────── */

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  employeeId: optional(idSchema),
  dateFrom: optional(dateStringSchema),
  dateTo: optional(dateStringSchema),
  customerId: optional(idSchema),
  documentId: optional(idSchema),
  /** When true, the result is restricted to the caller's own entries. */
  scope: optional(picklist(['own', 'all']))
})

const hoursValueSchema = pipe(
  number('Bitte eine Stundenzahl eingeben.'),
  minValue(0.01, 'Stunden müssen positiv sein.'),
  maxValue(24, 'Maximal 24 Stunden pro Eintrag.')
)

const timeEntryInputSchema = object({
  employeeId: idSchema,
  date: dateStringSchema,
  hours: hoursValueSchema,
  documentId: optional(nullable(idSchema)),
  customerId: optional(nullable(idSchema)),
  task: optional(pipe(string(), trim(), maxLength(200))),
  note: optional(notesSchema)
})

const dateRangeSchema = object({
  from: dateStringSchema,
  to: dateStringSchema,
  employeeId: optional(idSchema)
})

const monthSchema = object({
  year: pipe(number(), minValue(2000), maxValue(2100)),
  month: pipe(number(), minValue(1), maxValue(12))
})

/* ───────────────────────────────────────────────────────────────────── */
/* Remotes                                                              */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Paginated time-entry list. Visible to anyone with the full `hours`
 * module or `hours:write_own`. Callers that only hold `hours:write_own`
 * get a list scoped to their own employee row.
 *
 * @group integration
 * @module hours
 */
export const listTimeEntriesRemote = query(listSchema, async (params) => {
  requireAnyPermission('hours', 'hours:write_own')
  const canReadAll = callerCanReadAll()

  // Decide whether this call is scoped to the caller's own entries.
  // If only `:write_own` is held, we always force `own`. Otherwise we
  // honour the explicit `scope` argument (the UI's tab switcher).
  const ownOnly = !canReadAll || params.scope === 'own'

  let employeeFilter = params.employeeId
  if (ownOnly) {
    const me = await resolveCurrentEmployeeId()
    if (!me) {
      return {
        items: [],
        total: 0,
        page: params.page,
        size: params.size,
        pageCount: 1
      }
    }
    employeeFilter = me
  }

  return listTimeEntries({
    page: params.page,
    size: params.size,
    q: params.q,
    employeeId: employeeFilter,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    customerId: params.customerId,
    documentId: params.documentId
  })
})

/**
 * Load a single time entry. `:write_own`-only callers may only read
 * their own rows.
 *
 * @group integration
 * @module hours
 */
export const getTimeEntryRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requireAnyPermission('hours', 'hours:write_own')
    const row = await getTimeEntry(id)
    if (!row) error(404, 'Stundeneintrag nicht gefunden.')
    if (!callerCanReadAll()) {
      const me = await resolveCurrentEmployeeId()
      if (!me || me !== row.employeeId) {
        error(403, 'Keine Berechtigung für diese Aktion.')
      }
    }
    return row
  }
)

/**
 * Create a time entry. `:write_own`-only callers must log against
 * their own employee row; a mismatched `employeeId` raises 403.
 *
 * @group integration
 * @module hours
 */
export const createTimeEntryRemote = command(
  timeEntryInputSchema,
  async (values) => {
    requireAnyPermission('hours', 'hours:write_own')
    if (!callerCanReadAll()) {
      const me = await resolveCurrentEmployeeId()
      if (!me) error(403, 'Kein Mitarbeiterprofil verknüpft.')
      if (values.employeeId !== me) {
        error(403, 'Keine Berechtigung für diese Aktion.')
      }
    }
    const data = await createTimeEntry({
      employeeId: values.employeeId,
      date: values.date,
      hours: values.hours.toFixed(2),
      documentId: values.documentId ?? null,
      customerId: values.customerId ?? null,
      task: values.task ?? null,
      note: values.note ?? null
    })
    await requested(listTimeEntriesRemote, 4).refreshAll()
    return data
  }
)

/**
 * Update a time entry. `:write_own`-only callers must own the row
 * AND keep the `employeeId` pointed at themselves.
 *
 * @group integration
 * @module hours
 */
export const updateTimeEntryRemote = command(
  object({ id: idSchema, values: timeEntryInputSchema }),
  async ({ id, values }) => {
    requireAnyPermission('hours', 'hours:write_own')
    const existing = await getTimeEntry(id)
    if (!existing) error(404, 'Stundeneintrag nicht gefunden.')
    if (!callerCanReadAll()) {
      const me = await resolveCurrentEmployeeId()
      if (!me || me !== existing.employeeId || values.employeeId !== me) {
        error(403, 'Keine Berechtigung für diese Aktion.')
      }
    }
    const data = await updateTimeEntry(id, {
      employeeId: values.employeeId,
      date: values.date,
      hours: values.hours.toFixed(2),
      documentId: values.documentId ?? null,
      customerId: values.customerId ?? null,
      task: values.task ?? null,
      note: values.note ?? null
    })
    await Promise.all([
      getTimeEntryRemote({ id }).refresh(),
      requested(listTimeEntriesRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete a time entry. `:write_own`-only callers may only delete
 * their own rows.
 *
 * @group integration
 * @module hours
 */
export const deleteTimeEntryRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requireAnyPermission('hours', 'hours:write_own')
    const existing = await getTimeEntry(id)
    if (!existing) error(404, 'Stundeneintrag nicht gefunden.')
    if (!callerCanReadAll()) {
      const me = await resolveCurrentEmployeeId()
      if (!me || me !== existing.employeeId) {
        error(403, 'Keine Berechtigung für diese Aktion.')
      }
    }
    await deleteTimeEntry(id)
    await requested(listTimeEntriesRemote, 4).refreshAll()
  }
)

/**
 * Auslastungs-Report (Stunden je Mitarbeiter über einen Datumsbereich).
 * Nur für Manager (volle `hours`-Berechtigung) — Mitarbeiter mit
 * `hours:write_own` sehen keine Aggregate.
 *
 * @group integration
 * @module hours
 */
export const utilizationSummaryRemote = query(
  dateRangeSchema,
  async ({ from, to, employeeId }) => {
    requirePermission('hours')
    return utilizationSummary({ from, to, employeeId })
  }
)

/**
 * Monatsauswertung (Stunden je Mitarbeiter im gewählten Monat).
 *
 * @group integration
 * @module hours
 */
export const monthlyReportRemote = query(
  monthSchema,
  async ({ year, month }) => {
    requirePermission('hours')
    return monthlyReport({ year, month })
  }
)

/**
 * Stammdaten-Helfer für die UI: liefert die zum aktuellen User
 * verknüpfte Mitarbeiterzeile (oder `null`), damit das Formular im
 * `:write_own`-Modus den eigenen Namen anzeigen und die ID submitten
 * kann, ohne dass der Picker geöffnet werden müsste.
 *
 * @group integration
 * @module hours
 */
export const currentEmployeeRemote = query(async () => {
  requireUser()
  const id = await resolveCurrentEmployeeId()
  if (!id) return null
  const [row] = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      personnelNumber: employees.personnelNumber
    })
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1)
  return row ?? null
})

/**
 * Internal helper exposed for callers that want a runtime gate
 * matching the remote: `true` when the current request would be
 * served the unfiltered list.
 *
 * @group integration
 * @module hours
 */
export const canReadAllHoursRemote = query(async () => {
  requireUser()
  return callerCanReadAll()
})
