// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security-focused integration tests for the time-tracking remote
 * layer. Exercises:
 *
 *   - anonymous rejection on every exported remote;
 *   - the `:write_own` ownership rules (callers without `hours:read`
 *     may only read/update/delete their own rows, and may not log
 *     time against another employee);
 *   - happy paths for managers (wildcard / `hours:read` + `:write`).
 *
 * `$app/server` is replaced with passthrough `query`/`command` wrappers
 * and a controllable `getRequestEvent()` (see also
 * `src/routes/settings/users/users.remote.test.ts` for the same
 * pattern).
 *
 * @group integration
 * @module hours
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
import {
  customers,
  documents,
  employees,
  timeEntries
} from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import {
  createTimeEntryRemote,
  deleteTimeEntryRemote,
  getTimeEntryRemote,
  listTimeEntriesRemote,
  monthlyReportRemote,
  updateTimeEntryRemote,
  utilizationSummaryRemote
} from './hours.remote'

async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number
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
  const err = caught as { status?: number }
  expect(err.status).toBe(status)
}

async function resetDb() {
  await db.delete(timeEntries)
  await db.delete(documents)
  await db.delete(customers)
  await db.delete(employees)
}

function authAs(
  opts: { permissions?: string[]; userId?: string; email?: string } = {}
) {
  mockRequestEvent.locals.user = {
    id: opts.userId ?? 'caller-id',
    name: 'Caller',
    email: opts.email ?? 'caller@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(opts.permissions ?? [])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

describe('hours.remote', () => {
  let employeeId: string
  let otherEmployeeId: string

  beforeEach(async () => {
    await resetDb()
    anonymous()

    // Seed two employees. The caller (caller@twincars.local) is wired
    // to the first via `privateEmail` so the `:write_own` rules can
    // resolve "me".
    const [e1] = await db
      .insert(employees)
      .values({
        personnelNumber: 'MA-0001',
        firstName: 'Anna',
        lastName: 'Mustermann',
        privateEmail: 'caller@twincars.local'
      })
      .returning()
    const [e2] = await db
      .insert(employees)
      .values({
        personnelNumber: 'MA-0002',
        firstName: 'Bert',
        lastName: 'Beispiel',
        privateEmail: 'someone-else@twincars.local'
      })
      .returning()
    employeeId = e1.id
    otherEmployeeId = e2.id
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Anonymous rejection (401-equivalent)                             */
  /* ──────────────────────────────────────────────────────────────── */

  describe('rejects anonymous callers', () => {
    it('listTimeEntriesRemote throws when not logged in', async () => {
      await expectHttpError(
        () => listTimeEntriesRemote({ page: 1, size: 25 }),
        401
      )
    })

    it('getTimeEntryRemote throws when not logged in', async () => {
      await expectHttpError(
        () =>
          getTimeEntryRemote({ id: '00000000-0000-0000-0000-000000000000' }),
        401
      )
    })

    it('createTimeEntryRemote throws when not logged in', async () => {
      await expectHttpError(
        () =>
          createTimeEntryRemote({ employeeId, date: '2026-05-10', hours: 1 }),
        401
      )
    })

    it('updateTimeEntryRemote throws when not logged in', async () => {
      await expectHttpError(
        () =>
          updateTimeEntryRemote({
            id: '00000000-0000-0000-0000-000000000000',
            values: { employeeId, date: '2026-05-10', hours: 1 }
          }),
        401
      )
    })

    it('deleteTimeEntryRemote throws when not logged in', async () => {
      await expectHttpError(
        () =>
          deleteTimeEntryRemote({ id: '00000000-0000-0000-0000-000000000000' }),
        401
      )
    })

    it('utilizationSummaryRemote throws when not logged in', async () => {
      await expectHttpError(
        () =>
          utilizationSummaryRemote({ from: '2026-05-01', to: '2026-05-31' }),
        401
      )
    })

    it('monthlyReportRemote throws when not logged in', async () => {
      await expectHttpError(
        () => monthlyReportRemote({ year: 2026, month: 5 }),
        401
      )
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Permission gates                                                 */
  /* ──────────────────────────────────────────────────────────────── */

  describe('permission gates', () => {
    it('utilizationSummary refuses callers with only :write_own', async () => {
      authAs({ permissions: ['hours:write_own'] })
      await expectHttpError(
        () =>
          utilizationSummaryRemote({ from: '2026-05-01', to: '2026-05-31' }),
        403
      )
    })

    it('monthlyReport refuses callers with only :write_own', async () => {
      authAs({ permissions: ['hours:write_own'] })
      await expectHttpError(
        () => monthlyReportRemote({ year: 2026, month: 5 }),
        403
      )
    })

    it('list/get refuse callers with no hours permission at all', async () => {
      authAs({ permissions: ['vehicles'] })
      await expectHttpError(
        () => listTimeEntriesRemote({ page: 1, size: 25 }),
        403
      )
    })

    it('create/update/delete refuse callers without any hours permission', async () => {
      authAs({ permissions: ['customers'] })
      await expectHttpError(
        () =>
          createTimeEntryRemote({
            employeeId,
            date: '2026-05-10',
            hours: 1,
            task: 'x'
          }),
        403
      )
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* `:write_own` ownership rules                                     */
  /* ──────────────────────────────────────────────────────────────── */

  describe('hours:write_own ownership', () => {
    beforeEach(() => {
      authAs({
        permissions: ['hours:write_own'],
        email: 'caller@twincars.local'
      })
    })

    it("list returns ONLY the caller's own entries when scope=all is forced down", async () => {
      // Seed one entry per employee.
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-05-10', hours: '1.00', task: 'mine' },
        { employeeId: otherEmployeeId, date: '2026-05-10', hours: '2.00' }
      ])

      // Even when the caller asks for "all", the remote ignores it
      // and serves only their own.
      const res = await listTimeEntriesRemote({
        page: 1,
        size: 25,
        scope: 'all'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].employeeId).toBe(employeeId)
    })

    it('list returns empty when caller has no employee row mapped', async () => {
      authAs({
        permissions: ['hours:write_own'],
        email: 'no-such-employee@twincars.local'
      })
      const res = await listTimeEntriesRemote({ page: 1, size: 25 })
      expect(res.items).toEqual([])
      expect(res.total).toBe(0)
    })

    it("create succeeds against the caller's own employee id", async () => {
      const created = await createTimeEntryRemote({
        employeeId,
        date: '2026-05-10',
        hours: 1.5,
        task: 'own work'
      })
      expect(created.employeeId).toBe(employeeId)
    })

    it('create with another employee id rejects with 403', async () => {
      await expectHttpError(
        () =>
          createTimeEntryRemote({
            employeeId: otherEmployeeId,
            date: '2026-05-10',
            hours: 1,
            task: 'sneaky'
          }),
        403
      )
    })

    it("get against another employee's entry rejects with 403", async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({
          employeeId: otherEmployeeId,
          date: '2026-05-10',
          hours: '1.00'
        })
        .returning()
      await expectHttpError(() => getTimeEntryRemote({ id: row.id }), 403)
    })

    it("update against another employee's entry rejects with 403", async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({
          employeeId: otherEmployeeId,
          date: '2026-05-10',
          hours: '1.00'
        })
        .returning()
      await expectHttpError(
        () =>
          updateTimeEntryRemote({
            id: row.id,
            values: {
              employeeId: otherEmployeeId,
              date: '2026-05-11',
              hours: 2,
              task: 'tamper'
            }
          }),
        403
      )
    })

    it('update of own row succeeds', async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({ employeeId, date: '2026-05-10', hours: '1.00' })
        .returning()
      const updated = await updateTimeEntryRemote({
        id: row.id,
        values: { employeeId, date: '2026-05-11', hours: 2, task: 'updated' }
      })
      expect(updated.task).toBe('updated')
      expect(Number(updated.hours)).toBe(2)
    })

    it('update of own row but changing employeeId to someone else rejects with 403', async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({ employeeId, date: '2026-05-10', hours: '1.00' })
        .returning()
      await expectHttpError(
        () =>
          updateTimeEntryRemote({
            id: row.id,
            values: {
              employeeId: otherEmployeeId,
              date: '2026-05-10',
              hours: 1,
              task: 'reassign attempt'
            }
          }),
        403
      )
    })

    it("delete of another employee's entry rejects with 403", async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({
          employeeId: otherEmployeeId,
          date: '2026-05-10',
          hours: '1.00'
        })
        .returning()
      await expectHttpError(() => deleteTimeEntryRemote({ id: row.id }), 403)
      // Row must still exist.
      const remaining = await db.select().from(timeEntries)
      expect(remaining.find((t) => t.id === row.id)).toBeTruthy()
    })

    it('delete of own row succeeds', async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({ employeeId, date: '2026-05-10', hours: '1.00' })
        .returning()
      await deleteTimeEntryRemote({ id: row.id })
      const remaining = await db.select().from(timeEntries)
      expect(remaining.find((t) => t.id === row.id)).toBeUndefined()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Manager (wildcard) happy paths                                   */
  /* ──────────────────────────────────────────────────────────────── */

  describe('happy paths with full permissions', () => {
    beforeEach(() => {
      authAs({ permissions: [WILDCARD_PERMISSION] })
    })

    it('list returns ALL entries by default', async () => {
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-05-10', hours: '1.00' },
        { employeeId: otherEmployeeId, date: '2026-05-10', hours: '2.00' }
      ])
      const res = await listTimeEntriesRemote({ page: 1, size: 25 })
      expect(res.total).toBe(2)
    })

    it("list scope=own filters to the caller's employee row", async () => {
      authAs({
        permissions: [WILDCARD_PERMISSION],
        email: 'caller@twincars.local'
      })
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-05-10', hours: '1.00' },
        { employeeId: otherEmployeeId, date: '2026-05-10', hours: '2.00' }
      ])
      const res = await listTimeEntriesRemote({
        page: 1,
        size: 25,
        scope: 'own'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].employeeId).toBe(employeeId)
    })

    it('create against any employee succeeds', async () => {
      const created = await createTimeEntryRemote({
        employeeId: otherEmployeeId,
        date: '2026-05-10',
        hours: 3,
        task: 'manager logged for someone else'
      })
      expect(created.employeeId).toBe(otherEmployeeId)
    })

    it("update of another employee's entry succeeds", async () => {
      const [row] = await db
        .insert(timeEntries)
        .values({
          employeeId: otherEmployeeId,
          date: '2026-05-10',
          hours: '1.00'
        })
        .returning()
      const updated = await updateTimeEntryRemote({
        id: row.id,
        values: {
          employeeId: otherEmployeeId,
          date: '2026-05-12',
          hours: 4,
          task: 'manager fix'
        }
      })
      expect(Number(updated.hours)).toBe(4)
    })

    it('utilizationSummary returns the aggregate', async () => {
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-05-10', hours: '2.00' },
        { employeeId, date: '2026-05-11', hours: '3.00' }
      ])
      const res = await utilizationSummaryRemote({
        from: '2026-05-01',
        to: '2026-05-31'
      })
      expect(res.totals.totalHours).toBe(5)
    })

    it('monthlyReport returns per-employee aggregation', async () => {
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-05-10', hours: '2.00' },
        { employeeId, date: '2026-05-11', hours: '3.00' }
      ])
      const res = await monthlyReportRemote({ year: 2026, month: 5 })
      expect(res).toHaveLength(1)
      expect(res[0].totalHours).toBe(5)
      expect(res[0].daysLogged).toBe(2)
      expect(res[0].avgHoursPerDay).toBe(2.5)
    })
  })
})
