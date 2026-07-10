// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Guard + validation + happy-path tests for the absence remotes
 * (`listAbsencesRemote`, `createAbsenceRemote`, `updateAbsenceRemote`,
 * `deleteAbsenceRemote`, `getAbsenceConflictsRemote`). The employee
 * CRUD remotes are covered indirectly by the employee-service tests;
 * this file focuses on the absence surface: permissions, curated
 * German 400/404/409s, the overlap semantics, the hard vacation-budget
 * gate and the year-scoped balance.
 *
 * Pattern mirrors `customers.remote.test.ts`: `$app/server` is
 * replaced with thin `query`/`command` wrappers that run the Valibot
 * schema and a controllable `getRequestEvent()`.
 *
 * @group integration
 * @module employees
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string; email: string } | null,
    session: null as unknown,
    permissions: new Set<string>()
  }
}

vi.mock('$app/server', async () => {
  const valibot = await import('valibot')
  type Fn = (input?: unknown) => Promise<unknown>
  type Schema = Parameters<typeof valibot.parse>[0]

  const validate = (schema: Schema | undefined, input: unknown) => {
    if (!schema) return input
    return valibot.parse(schema, input)
  }

  const callQuery = (schema: Schema | undefined, impl: Fn, input?: unknown) => {
    const promise = (async () => impl(validate(schema, input)))()
    return Object.assign(promise, { refresh: () => Promise.resolve() })
  }
  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) => callQuery(schema, impl, input)
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  const makeCommand = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, { __: { type: 'command' as const } })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schema: unknown, fn: Fn) => makeCommand(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import { employeeAbsences, employees } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import {
  createAbsenceRemote,
  deleteAbsenceRemote,
  getAbsenceConflictsRemote,
  listAbsencesRemote,
  updateAbsenceRemote
} from './employees.remote'

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'

async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number,
  messagePattern?: RegExp
): Promise<void> {
  let caught: unknown = null
  try {
    await fn()
  } catch (err) {
    caught = err
  }
  if (caught === null) {
    throw new Error('expected the call to throw, but it resolved')
  }
  const err = caught as { status?: number; body?: { message?: string } }
  expect(err.status).toBe(status)
  if (messagePattern) {
    expect(err.body?.message ?? '').toMatch(messagePattern)
  }
}

function authAs(opts: { permissions?: string[] } = {}) {
  mockRequestEvent.locals.user = {
    id: 'caller-id',
    name: 'Tester',
    email: 'tester@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(opts.permissions ?? [])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

async function seedEmployee(
  vacationDaysPerYear: number | null = 30
): Promise<string> {
  const [row] = await db
    .insert(employees)
    .values({
      personnelNumber: `P-${Math.random().toString(36).slice(2, 8)}`,
      firstName: 'Anna',
      lastName: 'Mustermann',
      vacationDaysPerYear
    })
    .returning()
  return row.id
}

async function seedAbsence(input: {
  employeeId: string
  type: 'vacation' | 'sick' | 'other'
  dateFrom: string
  dateTo: string
  halfDay?: boolean
  status?: 'planned' | 'approved' | 'cancelled'
}): Promise<string> {
  const [row] = await db
    .insert(employeeAbsences)
    .values({ halfDay: false, status: 'approved', ...input })
    .returning()
  return row.id
}

describe('absence remotes', () => {
  beforeEach(async () => {
    await db.delete(employeeAbsences)
    await db.delete(employees)
    anonymous()
  })

  describe('guards', () => {
    it('rejects anonymous callers with 401 on every absence remote', async () => {
      await expectHttpError(
        () => listAbsencesRemote({ employeeId: UNKNOWN_ID }),
        401
      )
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId: UNKNOWN_ID,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-01'
          }),
        401
      )
      await expectHttpError(
        () => updateAbsenceRemote({ id: UNKNOWN_ID, values: {} }),
        401
      )
      await expectHttpError(
        () => deleteAbsenceRemote({ id: UNKNOWN_ID, employeeId: UNKNOWN_ID }),
        401
      )
      await expectHttpError(
        () =>
          getAbsenceConflictsRemote({
            employeeId: UNKNOWN_ID,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-01'
          }),
        401
      )
    })

    it('rejects callers without the employees permission with 403', async () => {
      authAs({ permissions: ['vehicles', 'hours:write_own'] })
      await expectHttpError(
        () => listAbsencesRemote({ employeeId: UNKNOWN_ID }),
        403
      )
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId: UNKNOWN_ID,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-01'
          }),
        403
      )
    })

    it('accepts the wildcard permission', async () => {
      authAs({ permissions: ['*'] })
      const employeeId = await seedEmployee()
      const result = await listAbsencesRemote({ employeeId, year: 2026 })
      expect(result.absences).toEqual([])
    })
  })

  describe('listAbsencesRemote', () => {
    it('returns workday-enriched rows and the balance of the requested year', async () => {
      authAs({ permissions: ['employees'] })
      const employeeId = await seedEmployee(30)
      // Cross-year vacation: 2026-12-28 (Mon) .. 2027-01-05 (Tue).
      // Federal fallback: 4 workdays in 2026, 2 in 2027 (Neujahr off).
      await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-12-28',
        dateTo: '2027-01-05'
      })
      const y2026 = await listAbsencesRemote({ employeeId, year: 2026 })
      expect(y2026.absences).toHaveLength(1)
      expect(y2026.absences[0].workdays).toBe(6)
      expect(y2026.absences[0].workdaysInYear).toBe(4)
      expect(y2026.balance).toMatchObject({
        year: 2026,
        entitled: 30,
        used: 4,
        remaining: 26
      })
      const y2027 = await listAbsencesRemote({ employeeId, year: 2027 })
      expect(y2027.absences[0].workdaysInYear).toBe(2)
      expect(y2027.balance).toMatchObject({ year: 2027, used: 2 })
      // A year the absence doesn't touch: empty list, untouched budget.
      const y2028 = await listAbsencesRemote({ employeeId, year: 2028 })
      expect(y2028.absences).toEqual([])
      expect(y2028.balance).toMatchObject({ year: 2028, used: 0 })
    })

    it('defaults the balance to the current year without a year filter', async () => {
      authAs({ permissions: ['employees'] })
      const employeeId = await seedEmployee(30)
      const result = await listAbsencesRemote({ employeeId })
      expect(result.balance.year).toBe(new Date().getFullYear())
    })
  })

  describe('createAbsenceRemote', () => {
    beforeEach(() => authAs({ permissions: ['employees'] }))

    it('creates a vacation with default status approved', async () => {
      const employeeId = await seedEmployee(30)
      const created = await createAbsenceRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(created.status).toBe('approved')
      const rows = await db
        .select()
        .from(employeeAbsences)
        .where(eq(employeeAbsences.employeeId, employeeId))
      expect(rows).toHaveLength(1)
    })

    it('rejects a malformed date with the German schema message', async () => {
      const employeeId = await seedEmployee()
      await expect(
        createAbsenceRemote({
          employeeId,
          type: 'vacation',
          dateFrom: 'banana',
          dateTo: '2026-06-05'
        })
      ).rejects.toThrowError(/gültiges Datum/)
    })

    it('rejects dateTo before dateFrom with a curated 400', async () => {
      const employeeId = await seedEmployee()
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'vacation',
            dateFrom: '2026-06-10',
            dateTo: '2026-06-01'
          }),
        400,
        /Bis-Datum darf nicht vor dem Von-Datum liegen/
      )
    })

    it('rejects an absurd span (> 1 year) with a curated 400', async () => {
      const employeeId = await seedEmployee(null)
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'other',
            dateFrom: '2026-01-01',
            dateTo: '2027-06-01'
          }),
        400,
        /Zeitraum ist zu lang/
      )
    })

    it('rejects a multi-day half-day entry with a curated 400', async () => {
      const employeeId = await seedEmployee()
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-02',
            halfDay: true
          }),
        400,
        /halber Tag ist nur bei eintägigen/
      )
    })

    it('rejects a sick note dated into a future year', async () => {
      const employeeId = await seedEmployee()
      const nextYear = new Date().getFullYear() + 1
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'sick',
            dateFrom: `${nextYear}-03-02`,
            dateTo: `${nextYear}-03-03`
          }),
        400,
        /Folgejahr/
      )
    })

    it('rejects a same-type overlap with a curated 400', async () => {
      const employeeId = await seedEmployee(30)
      await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10'
      })
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'vacation',
            dateFrom: '2026-06-10',
            dateTo: '2026-06-12'
          }),
        400,
        /gleicher Art \(01\.06\.2026 - 10\.06\.2026\)/
      )
    })

    it('answers a cross-type conflict with 409 until confirmed, then replaces', async () => {
      const employeeId = await seedEmployee(30)
      const sickId = await seedAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-03',
        dateTo: '2026-06-04'
      })
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-05'
          }),
        409,
        /Konflikt/
      )
      const created = await createAbsenceRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        replaceConflicting: true
      })
      expect(created.type).toBe('vacation')
      const remaining = await db
        .select()
        .from(employeeAbsences)
        .where(eq(employeeAbsences.employeeId, employeeId))
      expect(remaining.map((r) => r.id)).toEqual([created.id])
      expect(remaining.find((r) => r.id === sickId)).toBeUndefined()
    })

    it('lets type=other coexist with vacation (documented exemption)', async () => {
      const employeeId = await seedEmployee(30)
      await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      const created = await createAbsenceRemote({
        employeeId,
        type: 'other',
        dateFrom: '2026-06-03',
        dateTo: '2026-06-03'
      })
      expect(created.type).toBe('other')
    })

    it('hard-blocks vacation beyond the remaining allowance', async () => {
      const employeeId = await seedEmployee(3)
      await expectHttpError(
        () =>
          createAbsenceRemote({
            employeeId,
            type: 'vacation',
            dateFrom: '2026-06-01',
            dateTo: '2026-06-05'
          }),
        400,
        /Nur noch 3 Urlaubstage im Jahr 2026 verfügbar \(angefragt: 5\)/
      )
    })

    it('does not limit vacation when no entitlement is configured', async () => {
      const employeeId = await seedEmployee(null)
      const created = await createAbsenceRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(created.id).toBeTruthy()
    })

    it('does not count sick days against the vacation allowance', async () => {
      const employeeId = await seedEmployee(5)
      await seedAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-05-04',
        dateTo: '2026-05-08'
      })
      // Allowance untouched by the sick week — 5 vacation days fit.
      const created = await createAbsenceRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(created.id).toBeTruthy()
      const balance = (await listAbsencesRemote({ employeeId, year: 2026 }))
        .balance
      expect(balance.used).toBe(5)
      expect(balance.remaining).toBe(0)
    })

    it('creates a single-day half-day entry that counts 0.5', async () => {
      const employeeId = await seedEmployee(30)
      const created = await createAbsenceRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-02',
        dateTo: '2026-06-02',
        halfDay: true
      })
      expect(created.halfDay).toBe(true)
      const { balance, absences } = await listAbsencesRemote({
        employeeId,
        year: 2026
      })
      expect(absences[0].workdaysInYear).toBe(0.5)
      expect(balance.used).toBe(0.5)
      expect(balance.remaining).toBe(29.5)
    })
  })

  describe('updateAbsenceRemote', () => {
    beforeEach(() => authAs({ permissions: ['employees'] }))

    it('404s for an unknown id', async () => {
      await expectHttpError(
        () =>
          updateAbsenceRemote({
            id: UNKNOWN_ID,
            values: { status: 'cancelled' }
          }),
        404,
        /Abwesenheit nicht gefunden/
      )
    })

    it('flips the status', async () => {
      const employeeId = await seedEmployee(30)
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      const row = await updateAbsenceRemote({
        id,
        values: { status: 'cancelled' }
      })
      expect(row.status).toBe('cancelled')
      // Cancelled rows stop counting against the allowance.
      const { balance } = await listAbsencesRemote({ employeeId, year: 2026 })
      expect(balance.used).toBe(0)
    })

    it('rejects a merged range with dateTo before dateFrom', async () => {
      const employeeId = await seedEmployee(30)
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      await expectHttpError(
        () => updateAbsenceRemote({ id, values: { dateFrom: '2026-06-10' } }),
        400,
        /Bis-Datum darf nicht vor dem Von-Datum liegen/
      )
    })

    it('rejects moving dates onto a same-type overlap', async () => {
      const employeeId = await seedEmployee(30)
      await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-07-06',
        dateTo: '2026-07-10'
      })
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      await expectHttpError(
        () =>
          updateAbsenceRemote({
            id,
            values: { dateFrom: '2026-07-08', dateTo: '2026-07-09' }
          }),
        400,
        /gleicher Art/
      )
    })

    it('allows shifting a row within its own former range (excludeId)', async () => {
      const employeeId = await seedEmployee(30)
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      const row = await updateAbsenceRemote({
        id,
        values: { dateFrom: '2026-06-02', dateTo: '2026-06-04' }
      })
      expect(row.dateFrom).toBe('2026-06-02')
    })

    it('rejects moving dates onto a cross-type conflict with 409', async () => {
      const employeeId = await seedEmployee(30)
      await seedAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-07-06',
        dateTo: '2026-07-10'
      })
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      await expectHttpError(
        () =>
          updateAbsenceRemote({
            id,
            values: { dateFrom: '2026-07-08', dateTo: '2026-07-09' }
          }),
        409,
        /Konflikt/
      )
    })

    it('applies the vacation budget to extensions, excluding own days', async () => {
      const employeeId = await seedEmployee(5)
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      // Same 5-workday volume elsewhere: fits because the row's own
      // days are excluded from "used".
      const moved = await updateAbsenceRemote({
        id,
        values: { dateFrom: '2026-07-06', dateTo: '2026-07-10' }
      })
      expect(moved.dateFrom).toBe('2026-07-06')
      // Extending to 6 workdays blows the budget of 5.
      await expectHttpError(
        () => updateAbsenceRemote({ id, values: { dateTo: '2026-07-13' } }),
        400,
        /Nur noch/
      )
    })

    it('rejects re-dating a sick note into a future year', async () => {
      const employeeId = await seedEmployee(30)
      const currentYear = new Date().getFullYear()
      const id = await seedAbsence({
        employeeId,
        type: 'sick',
        dateFrom: `${currentYear}-03-02`,
        dateTo: `${currentYear}-03-03`
      })
      await expectHttpError(
        () =>
          updateAbsenceRemote({
            id,
            values: {
              dateFrom: `${currentYear + 1}-03-02`,
              dateTo: `${currentYear + 1}-03-03`
            }
          }),
        400,
        /Folgejahr/
      )
    })

    it('skips overlap and budget checks when cancelling', async () => {
      const employeeId = await seedEmployee(0)
      const id = await seedAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      const row = await updateAbsenceRemote({
        id,
        values: { status: 'cancelled' }
      })
      expect(row.status).toBe('cancelled')
    })
  })

  describe('deleteAbsenceRemote', () => {
    it('requires the employees permission', async () => {
      authAs({ permissions: ['hours'] })
      await expectHttpError(
        () => deleteAbsenceRemote({ id: UNKNOWN_ID, employeeId: UNKNOWN_ID }),
        403
      )
    })

    it('hard-deletes the row', async () => {
      authAs({ permissions: ['employees'] })
      const employeeId = await seedEmployee(30)
      const id = await seedAbsence({
        employeeId,
        type: 'other',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-01'
      })
      await deleteAbsenceRemote({ id, employeeId })
      const rows = await db
        .select()
        .from(employeeAbsences)
        .where(eq(employeeAbsences.id, id))
      expect(rows).toEqual([])
    })
  })

  describe('getAbsenceConflictsRemote', () => {
    it('reports cross-type conflicts for the picker/modal flow', async () => {
      authAs({ permissions: ['employees'] })
      const employeeId = await seedEmployee(30)
      const sickId = await seedAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-03',
        dateTo: '2026-06-04'
      })
      const hits = await getAbsenceConflictsRemote({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(hits.map((h) => h.id)).toEqual([sickId])
    })
  })
})
