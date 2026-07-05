// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the dashboard KPI remote.
 *
 * - Anonymous callers get a curated 401.
 * - Entity counters ignore archived rows.
 * - Ledger sums are restricted to the current month.
 * - Open invoices count only `type='invoice'` + `status='sent'`.
 * - Open Zahlungserinnerungen count only `reminders.status='open'`.
 * - Today's appointments count only non-cancelled `appointment`
 *   entries starting within the current UTC day.
 *
 * The `$app/server` shim is the same pattern used by every other
 * remote test in this repo (see e.g. `search.remote.test.ts`).
 *
 * @group integration
 * @module dashboard
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string } | null,
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
  calendarEntries,
  customers,
  documents,
  ledgerEntries,
  reminders,
  vehicles
} from '$lib/server/db/schema'
import { getDashboardKpis } from './dashboard.remote'

async function resetDb() {
  await db.delete(reminders)
  await db.delete(calendarEntries)
  await db.delete(ledgerEntries)
  await db.delete(documents)
  await db.delete(vehicles)
  await db.delete(customers)
}

function authAs() {
  mockRequestEvent.locals.user = { id: 'u-1', name: 'Caller' }
  mockRequestEvent.locals.permissions = new Set(['*'])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

/** Current UTC day as ISO date string (matches the remote's math). */
const todayIso = new Date().toISOString().slice(0, 10)
const todayStart = new Date(`${todayIso}T00:00:00Z`)
const dayMs = 24 * 60 * 60 * 1000

/** A date string safely inside the current UTC month. */
const inCurrentMonth = `${todayIso.slice(0, 7)}-15`

async function insertInvoice(number: string, status: string, type = 'invoice') {
  const [row] = await db
    .insert(documents)
    .values({ documentNumber: number, type, status, issueDate: inCurrentMonth })
    .returning({ id: documents.id })
  return row.id
}

describe('getDashboardKpis', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
  })

  it('rejects anonymous callers with 401', async () => {
    let caught: unknown = null
    try {
      await getDashboardKpis()
    } catch (err) {
      caught = err
    }
    expect(caught).not.toBeNull()
    expect((caught as { status?: number }).status).toBe(401)
  })

  it('returns all-zero KPIs on an empty database', async () => {
    authAs()
    const kpis = await getDashboardKpis()
    expect(kpis).toEqual({
      customers: 0,
      vehicles: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyBalance: 0,
      openInvoices: 0,
      openReminders: 0,
      appointmentsToday: 0
    })
  })

  it('counts only non-archived customers and vehicles', async () => {
    authAs()
    await db.insert(customers).values([
      { customerNumber: 'K-1', lastName: 'Aktiv', archived: false },
      { customerNumber: 'K-2', lastName: 'Archiv', archived: true }
    ])
    await db.insert(vehicles).values([
      { make: 'VW', model: 'Golf', archived: false },
      { make: 'Opel', model: 'Corsa', archived: false },
      { make: 'Ford', model: 'Ka', archived: true }
    ])
    const kpis = await getDashboardKpis()
    expect(kpis.customers).toBe(1)
    expect(kpis.vehicles).toBe(2)
  })

  it('sums current-month ledger entries and derives the balance', async () => {
    authAs()
    await db.insert(ledgerEntries).values([
      {
        direction: 'income',
        entryDate: inCurrentMonth,
        amountGross: '100.00',
        amountNet: '84.03',
        description: 'Einnahme'
      },
      {
        direction: 'income',
        entryDate: inCurrentMonth,
        amountGross: '50.00',
        amountNet: '42.02',
        description: 'Einnahme 2'
      },
      {
        direction: 'expense',
        entryDate: inCurrentMonth,
        amountGross: '30.00',
        amountNet: '25.21',
        description: 'Ausgabe'
      },
      {
        // Outside the current month: must not count.
        direction: 'income',
        entryDate: '2020-01-15',
        amountGross: '999.00',
        amountNet: '839.50',
        description: 'Alt'
      }
    ])
    const kpis = await getDashboardKpis()
    expect(kpis.monthlyIncome).toBe(150)
    expect(kpis.monthlyExpense).toBe(30)
    expect(kpis.monthlyBalance).toBe(120)
  })

  it('counts only invoices with status sent as open invoices', async () => {
    authAs()
    await insertInvoice('RE-1', 'sent')
    await insertInvoice('RE-2', 'sent')
    await insertInvoice('RE-3', 'paid')
    await insertInvoice('RE-4', 'created')
    await insertInvoice('RE-5', 'cancelled')
    // An offer with status 'sent' is not an open invoice.
    await insertInvoice('KV-1', 'sent', 'offer')
    const kpis = await getDashboardKpis()
    expect(kpis.openInvoices).toBe(2)
  })

  it('counts only reminders with status open', async () => {
    authAs()
    const invoiceId = await insertInvoice('RE-10', 'sent')
    await db.insert(reminders).values([
      {
        documentNumber: 'ZE-1',
        invoiceId,
        level: 1,
        issueDate: inCurrentMonth,
        dueDate: inCurrentMonth,
        status: 'open'
      },
      {
        documentNumber: 'ZE-2',
        invoiceId,
        level: 2,
        issueDate: inCurrentMonth,
        dueDate: inCurrentMonth,
        status: 'sent'
      },
      {
        documentNumber: 'ZE-3',
        invoiceId,
        level: 3,
        issueDate: inCurrentMonth,
        dueDate: inCurrentMonth,
        status: 'paid'
      }
    ])
    const kpis = await getDashboardKpis()
    expect(kpis.openReminders).toBe(1)
  })

  it('counts today appointments, excluding cancelled, other days and closures', async () => {
    authAs()
    await db.insert(calendarEntries).values([
      {
        kind: 'appointment',
        title: 'Heute früh',
        startsAt: new Date(todayStart.getTime() + 8 * 60 * 60 * 1000),
        endsAt: new Date(todayStart.getTime() + 9 * 60 * 60 * 1000),
        status: 'scheduled',
        allDay: false
      },
      {
        kind: 'appointment',
        title: 'Heute spät',
        startsAt: new Date(todayStart.getTime() + 20 * 60 * 60 * 1000),
        endsAt: new Date(todayStart.getTime() + 21 * 60 * 60 * 1000),
        status: 'completed',
        allDay: false
      },
      {
        kind: 'appointment',
        title: 'Heute storniert',
        startsAt: new Date(todayStart.getTime() + 10 * 60 * 60 * 1000),
        endsAt: new Date(todayStart.getTime() + 11 * 60 * 60 * 1000),
        status: 'cancelled',
        allDay: false
      },
      {
        kind: 'appointment',
        title: 'Gestern',
        startsAt: new Date(todayStart.getTime() - 2 * 60 * 60 * 1000),
        endsAt: new Date(todayStart.getTime() - 1 * 60 * 60 * 1000),
        status: 'scheduled',
        allDay: false
      },
      {
        kind: 'appointment',
        title: 'Morgen',
        startsAt: new Date(todayStart.getTime() + dayMs + 60 * 60 * 1000),
        endsAt: new Date(todayStart.getTime() + dayMs + 2 * 60 * 60 * 1000),
        status: 'scheduled',
        allDay: false
      },
      {
        // Closure today: wrong kind, must not count.
        kind: 'closure',
        title: 'Betriebsurlaub',
        startsAt: new Date(todayStart.getTime()),
        endsAt: new Date(todayStart.getTime() + dayMs - 1),
        allDay: true
      }
    ])
    const kpis = await getDashboardKpis()
    expect(kpis.appointmentsToday).toBe(2)
  })
})
