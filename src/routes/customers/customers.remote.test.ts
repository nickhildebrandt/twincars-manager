// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path tests for the customer-facing remote
 * functions added in Phase 6 — focused on
 * `sendAdHocCustomerEmailRemote` (anonymous → 401, missing perm
 * → 403, success). The rest of the customer remotes (list / get /
 * create / update / delete) are covered indirectly by the customer
 * service tests; here we exercise the new ad-hoc email surface.
 *
 * Pattern mirrors `hours.remote.test.ts` /
 * `settings/users/users.remote.test.ts`:
 *   - `$app/server` is replaced with thin `query`/`command` wrappers
 *     that run the Valibot schema and a controllable
 *     `getRequestEvent()`.
 *   - The mail-service is stubbed so we observe the call without
 *     spinning up a real nodemailer transport.
 *
 * @group integration
 * @module customers
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

// Stub out the mail service: we are testing the remote-layer guards
// and shaping, not the real SMTP / nodemailer plumbing. The mock fn
// has to be created inside `vi.hoisted` so the `vi.mock` factory can
// reference it (mock factories run at hoist time, before module-level
// `const` initializers).
const { sendAdHocCustomerEmailMock } = vi.hoisted(() => ({
  sendAdHocCustomerEmailMock:
    vi.fn<
      (
        input: unknown
      ) => Promise<
        { ok: true; messageId: string | null } | { ok: false; error: string }
      >
    >()
}))
vi.mock('$lib/server/services/mail-service', () => ({
  sendAdHocCustomerEmail: sendAdHocCustomerEmailMock
}))

import { db } from '$lib/server/db/client'
import { customers } from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import { sendAdHocCustomerEmailRemote } from './customers.remote'

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
  await db.delete(customers)
}

function authAs(opts: { permissions?: string[] } = {}) {
  mockRequestEvent.locals.user = {
    id: 'caller-id',
    name: 'Caller',
    email: 'caller@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(opts.permissions ?? [])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

describe('customers.remote — sendAdHocCustomerEmailRemote', () => {
  let customerId: string

  beforeEach(async () => {
    await resetDb()
    anonymous()
    sendAdHocCustomerEmailMock.mockReset()
    sendAdHocCustomerEmailMock.mockResolvedValue({
      ok: true,
      messageId: '<test-id>'
    })

    const [row] = await db
      .insert(customers)
      .values({
        customerNumber: 'KU-00001',
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com'
      })
      .returning({ id: customers.id })
    customerId = row.id
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(
      () =>
        sendAdHocCustomerEmailRemote({
          customerId,
          subject: 'Hi',
          body: 'Body',
          attachments: []
        }),
      401
    )
    expect(sendAdHocCustomerEmailMock).not.toHaveBeenCalled()
  })

  it('rejects callers without the customers module with 403', async () => {
    authAs({ permissions: ['vehicles'] })
    await expectHttpError(
      () =>
        sendAdHocCustomerEmailRemote({
          customerId,
          subject: 'Hi',
          body: 'Body',
          attachments: []
        }),
      403
    )
    expect(sendAdHocCustomerEmailMock).not.toHaveBeenCalled()
  })

  it('hands the payload through and returns the message id on success', async () => {
    authAs({ permissions: ['customers'] })
    const res = await sendAdHocCustomerEmailRemote({
      customerId,
      subject: 'Hi',
      body: 'Body',
      attachments: [
        {
          filename: 'attach.pdf',
          mime: 'application/pdf',
          base64Data: Buffer.from('x').toString('base64')
        }
      ]
    })
    expect(res).toEqual({ messageId: '<test-id>' })
    expect(sendAdHocCustomerEmailMock).toHaveBeenCalledTimes(1)
    const call = sendAdHocCustomerEmailMock.mock.calls[0][0] as {
      customerId: string
      subject: string
      body: string
      attachments: { filename: string }[]
    }
    expect(call.customerId).toBe(customerId)
    expect(call.subject).toBe('Hi')
    expect(call.body).toBe('Body')
    expect(call.attachments).toHaveLength(1)
    expect(call.attachments[0].filename).toBe('attach.pdf')
  })

  it('accepts callers with the wildcard permission', async () => {
    authAs({ permissions: [WILDCARD_PERMISSION] })
    const res = await sendAdHocCustomerEmailRemote({
      customerId,
      subject: 'Hi',
      body: 'Body',
      attachments: []
    })
    expect(res.messageId).toBe('<test-id>')
  })

  it('rejects empty subject via the Valibot schema', async () => {
    authAs({ permissions: ['customers'] })
    await expect(
      sendAdHocCustomerEmailRemote({
        customerId,
        subject: '   ',
        body: 'Body',
        attachments: []
      })
    ).rejects.toThrow()
    expect(sendAdHocCustomerEmailMock).not.toHaveBeenCalled()
  })

  it('rejects empty body via the Valibot schema', async () => {
    authAs({ permissions: ['customers'] })
    await expect(
      sendAdHocCustomerEmailRemote({
        customerId,
        subject: 'Hi',
        body: '',
        attachments: []
      })
    ).rejects.toThrow()
    expect(sendAdHocCustomerEmailMock).not.toHaveBeenCalled()
  })

  it('rejects attachments that exceed the size cap', async () => {
    authAs({ permissions: ['customers'] })
    const huge = 'a'.repeat(14_000_001)
    await expect(
      sendAdHocCustomerEmailRemote({
        customerId,
        subject: 'Hi',
        body: 'Body',
        attachments: [
          {
            filename: 'big.bin',
            mime: 'application/octet-stream',
            base64Data: huge
          }
        ]
      })
    ).rejects.toThrow()
    expect(sendAdHocCustomerEmailMock).not.toHaveBeenCalled()
  })

  it('surfaces a curated 400 when the mail service reports failure', async () => {
    authAs({ permissions: ['customers'] })
    sendAdHocCustomerEmailMock.mockResolvedValueOnce({
      ok: false,
      error: 'Connection refused'
    })
    await expectHttpError(
      () =>
        sendAdHocCustomerEmailRemote({
          customerId,
          subject: 'Hi',
          body: 'Body',
          attachments: []
        }),
      400
    )
  })
})
