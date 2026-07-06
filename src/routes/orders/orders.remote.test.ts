// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the work-order remote functions — guard
 * behaviour (anonymous → 401, missing permission → 403), the Kanban
 * board shape after a create, the status-move validation (done is not
 * reachable via move) and the completion flow returning the invoice
 * id + number. Runs against pg-mem via the shared `$app/server` mock
 * pattern (see `setup.remote.test.ts`).
 *
 * @group integration
 * @module orders
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// PDF rendering is best-effort inside createDocument; stub it so the
// completion path neither pulls in pdf-lib nor spams console.error.
vi.mock('$lib/server/services/pdf-service', () => ({
  renderAndPersistDocumentPdf: vi.fn().mockResolvedValue(undefined),
  getOrRenderDocumentPdf: vi.fn()
}))

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
    command: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeCommand(undefined, schemaOrFn as Fn)
      }
      return makeCommand(schemaOrFn as Schema, fn as Fn)
    },
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  companySettings,
  customers,
  documentItems,
  documents,
  employees,
  itemPriceVersions,
  items,
  numberRanges,
  timeEntries,
  vehicleLicensePlateVersions,
  vehicles,
  workOrderAssignees,
  workOrderItems,
  workOrders
} from '$lib/server/db/schema'
import {
  addWorkOrderItemRemote,
  completeWorkOrderRemote,
  createWorkOrderFromAppointmentRemote,
  createWorkOrderRemote,
  deleteWorkOrderRemote,
  getLaborRateRemote,
  getWorkOrderIdForAppointmentRemote,
  getWorkOrderRemote,
  kanbanBoardRemote,
  listWorkOrdersRemote,
  moveWorkOrderStatusRemote,
  updateWorkOrderRemote
} from './orders.remote'

const YEAR = new Date().getFullYear()

const asAnonymous = () => {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

const asUserWithoutOrders = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['customers'])
}

const asOrdersUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['orders'])
}

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

async function resetDb() {
  await db.delete(timeEntries)
  await db.delete(workOrderItems)
  await db.delete(workOrderAssignees)
  await db.delete(workOrders)
  await db.delete(documentItems)
  await db.delete(documents)
  await db.delete(calendarEntries)
  await db.delete(itemPriceVersions)
  await db.delete(items)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(vehicles)
  await db.delete(customers)
  await db.delete(employees)
  await db.delete(numberRanges)
  await db.delete(companySettings)
  await db.insert(numberRanges).values([
    { kind: 'work_order', formatTemplate: 'AU-{YYYY}-{NNNN}', nextValue: 1 },
    { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 1 }
  ])
  await db
    .insert(companySettings)
    .values({
      setupCompleted: true,
      defaultVatRate: '19.00',
      defaultPaymentTermDays: 14
    })
}

const seedCustomer = async (): Promise<string> => {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: `KU-${Math.random().toString().slice(2, 8)}`,
      company: 'Mustermann GmbH'
    })
    .returning({ id: customers.id })
  return row.id
}

const seedAppointment = async (): Promise<string> => {
  const [row] = await db
    .insert(calendarEntries)
    .values({
      kind: 'appointment',
      title: 'HU-Vorbereitung',
      startsAt: new Date('2026-07-10T08:00:00Z'),
      endsAt: new Date('2026-07-10T10:00:00Z'),
      status: 'scheduled'
    })
    .returning({ id: calendarEntries.id })
  return row.id
}

describe('orders.remote — guards', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('rejects anonymous callers with 401', async () => {
    asAnonymous()
    await expectHttpError(() => kanbanBoardRemote({}), 401)
    await expectHttpError(() => getLaborRateRemote(), 401)
    await expectHttpError(
      () => createWorkOrderRemote({ title: 'Bremsen' }),
      401
    )
    await expectHttpError(
      () => listWorkOrdersRemote({ page: 1, size: 25 }),
      401
    )
  })

  it('rejects users without the orders permission with 403', async () => {
    asUserWithoutOrders()
    await expectHttpError(() => kanbanBoardRemote({}), 403)
    await expectHttpError(
      () => createWorkOrderRemote({ title: 'Bremsen' }),
      403
    )
    await expectHttpError(
      () =>
        deleteWorkOrderRemote({ id: '00000000-0000-0000-0000-000000000000' }),
      403
    )
    await expectHttpError(
      () =>
        getWorkOrderIdForAppointmentRemote({
          appointmentId: '00000000-0000-0000-0000-000000000000'
        }),
      403
    )
  })
})

describe('orders.remote — board & CRUD', () => {
  beforeEach(async () => {
    await resetDb()
    asOrdersUser()
  })

  it('create lands on the open Kanban column with the expected card shape', async () => {
    const customerId = await seedCustomer()
    const created = await createWorkOrderRemote({
      title: 'Bremsen erneuern',
      customerId
    })
    expect(created.orderNumber).toBe(`AU-${YEAR}-0001`)

    const board = await kanbanBoardRemote({})
    expect(board.in_progress).toEqual([])
    expect(board.done).toEqual([])
    expect(board.open).toHaveLength(1)
    expect(board.open[0]).toMatchObject({
      id: created.id,
      orderNumber: `AU-${YEAR}-0001`,
      title: 'Bremsen erneuern',
      status: 'open',
      customerLabel: 'Mustermann GmbH',
      invoiceId: null,
      invoiceNumber: null
    })
    expect(board.open[0].assignees).toEqual([])
  })

  it('getWorkOrderRemote 404s with a German message for unknown ids', async () => {
    await expectHttpError(
      () => getWorkOrderRemote({ id: '00000000-0000-0000-0000-000000000000' }),
      404,
      /Auftrag nicht gefunden/
    )
  })

  it('getLaborRateRemote returns null while no labor item is configured', async () => {
    expect(await getLaborRateRemote()).toBeNull()
  })

  it('rejects orders without customer AND vehicle with a curated 400', async () => {
    await expectHttpError(
      () => createWorkOrderRemote({ title: 'Ohne Zuordnung' }),
      400,
      /Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen/
    )
  })

  it('rejects an update clearing both customer and vehicle with 400', async () => {
    const customerId = await seedCustomer()
    const order = await createWorkOrderRemote({ title: 'Job', customerId })
    await expectHttpError(
      () =>
        updateWorkOrderRemote({
          id: order.id,
          values: { customerId: null, vehicleId: null }
        }),
      400,
      /Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen/
    )
    // Clearing the only remaining link is refused by the service too.
    await expectHttpError(
      () =>
        updateWorkOrderRemote({ id: order.id, values: { customerId: null } }),
      400,
      /Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen/
    )
  })

  it('listWorkOrdersRemote filters by status', async () => {
    const customerId = await seedCustomer()
    const a = await createWorkOrderRemote({ title: 'Offen bleibt', customerId })
    const b = await createWorkOrderRemote({
      title: 'Geht in Arbeit',
      customerId
    })
    await moveWorkOrderStatusRemote({ id: b.id, status: 'in_progress' })

    const open = await listWorkOrdersRemote({
      page: 1,
      size: 25,
      status: 'open'
    })
    expect(open.total).toBe(1)
    expect(open.items[0].id).toBe(a.id)

    const all = await listWorkOrdersRemote({ page: 1, size: 25 })
    expect(all.total).toBe(2)
  })
})

describe('orders.remote — status moves', () => {
  beforeEach(async () => {
    await resetDb()
    asOrdersUser()
  })

  it('moves open -> in_progress and back', async () => {
    const order = await createWorkOrderRemote({
      title: 'Job',
      customerId: await seedCustomer()
    })
    const moved = await moveWorkOrderStatusRemote({
      id: order.id,
      status: 'in_progress'
    })
    expect(moved.status).toBe('in_progress')
    const board = await kanbanBoardRemote({})
    expect(board.open).toEqual([])
    expect(board.in_progress.map((c) => c.id)).toEqual([order.id])
  })

  it('rejects "done" at the schema level — completion is a separate flow', async () => {
    const order = await createWorkOrderRemote({
      title: 'Job',
      customerId: await seedCustomer()
    })
    await expect(
      moveWorkOrderStatusRemote({
        id: order.id,
        status: 'done' as unknown as 'open'
      })
    ).rejects.toThrow('Bitte einen gültigen Status wählen.')
  })

  it('404s when moving an unknown order', async () => {
    await expectHttpError(
      () =>
        moveWorkOrderStatusRemote({
          id: '00000000-0000-0000-0000-000000000000',
          status: 'in_progress'
        }),
      404,
      /Auftrag nicht gefunden/
    )
  })
})

describe('orders.remote — appointment integration', () => {
  beforeEach(async () => {
    await resetDb()
    asOrdersUser()
  })

  it('returns null before and {id} after creating the order from a Termin', async () => {
    const appointmentId = await seedAppointment()
    expect(
      await getWorkOrderIdForAppointmentRemote({ appointmentId })
    ).toBeNull()

    const created = await createWorkOrderFromAppointmentRemote({
      appointmentId
    })
    expect(created).toEqual({ id: expect.any(String) })

    const linked = await getWorkOrderIdForAppointmentRemote({ appointmentId })
    expect(linked).toEqual({ id: created.id })
  })

  it('409s when the Termin already has an order', async () => {
    const appointmentId = await seedAppointment()
    await createWorkOrderFromAppointmentRemote({ appointmentId })
    await expectHttpError(
      () => createWorkOrderFromAppointmentRemote({ appointmentId }),
      409,
      /bereits ein Auftrag/
    )
  })
})

describe('orders.remote — items & completion', () => {
  beforeEach(async () => {
    await resetDb()
    asOrdersUser()
  })

  it('adds an item and completes into an invoice (returns id + number)', async () => {
    const customerId = await seedCustomer()
    const order = await createWorkOrderRemote({
      title: 'Bremsen komplett',
      customerId
    })
    const item = await addWorkOrderItemRemote({
      workOrderId: order.id,
      values: {
        kind: 'material',
        description: 'Bremsscheibe',
        quantity: 2,
        unit: 'Stk',
        unitPriceNet: 45,
        doneAt: '2026-07-06'
      }
    })
    expect(item.position).toBe(1)

    const result = await completeWorkOrderRemote({
      id: order.id,
      issueDate: '2026-07-06',
      paymentMethod: 'Bar'
    })
    expect(result.invoiceId).toEqual(expect.any(String))
    expect(result.invoiceNumber).toBe(`RE-${YEAR}-0001`)

    const detail = await getWorkOrderRemote({ id: order.id })
    expect(detail.order.status).toBe('done')
    expect(detail.order.invoiceId).toBe(result.invoiceId)
    expect(detail.invoiceNumber).toBe(result.invoiceNumber)

    // The done Kanban card carries the invoice link.
    const board = await kanbanBoardRemote({})
    expect(board.done).toHaveLength(1)
    expect(board.done[0].invoiceId).toBe(result.invoiceId)
    expect(board.done[0].invoiceNumber).toBe(result.invoiceNumber)
  })

  it('rejects an empty item description with the German message', async () => {
    const order = await createWorkOrderRemote({
      title: 'Job',
      customerId: await seedCustomer()
    })
    await expect(
      addWorkOrderItemRemote({
        workOrderId: order.id,
        values: {
          kind: 'material',
          description: '   ',
          quantity: 1,
          unitPriceNet: 10,
          doneAt: '2026-07-06'
        }
      })
    ).rejects.toThrow('Die Beschreibung darf nicht leer sein.')
  })

  it('409s when completing an order without items', async () => {
    const order = await createWorkOrderRemote({
      title: 'Leer',
      customerId: await seedCustomer()
    })
    await expectHttpError(
      () => completeWorkOrderRemote({ id: order.id, issueDate: '2026-07-06' }),
      409,
      /keine Positionen/
    )
  })
})
