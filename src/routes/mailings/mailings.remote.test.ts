// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path tests for the broadcast remote layer. Mirrors
 * the pattern of `hours.remote.test.ts` /
 * `customers.remote.test.ts`:
 *   - `$app/server` is faked with thin wrappers that run the Valibot
 *     schema and a controllable `getRequestEvent()`.
 *   - The mail-service is stubbed so the test observes the call
 *     without spinning up nodemailer.
 *
 * @group integration
 * @module mailings
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

const { sendBroadcastEmailMock } = vi.hoisted(() => ({
  sendBroadcastEmailMock:
    vi.fn<
      (
        input: unknown
      ) => Promise<{
        sent: number
        failed: Array<{ customerId: string; reason: string }>
      }>
    >()
}))
vi.mock('$lib/server/services/mail-service', () => ({
  sendBroadcastEmail: sendBroadcastEmailMock
}))

import { db } from '$lib/server/db/client'
import { customers, sentMessages } from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import {
  listBroadcastHistoryRemote,
  previewBroadcastRecipientsRemote,
  sendBroadcastEmailRemote
} from './mailings.remote'

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
  await db.delete(sentMessages)
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

async function seedOptInCustomer(
  email: string | null,
  overrides: Partial<typeof customers.$inferInsert> = {}
): Promise<void> {
  await db
    .insert(customers)
    .values({
      customerNumber: `KU-${Math.random().toString(36).slice(2, 8)}`,
      firstName: 'Anna',
      lastName: 'Empfänger',
      email,
      wantsBroadcast: true,
      ...overrides
    })
}

describe('mailings.remote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
    sendBroadcastEmailMock.mockReset()
    sendBroadcastEmailMock.mockResolvedValue({ sent: 0, failed: [] })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Anonymous rejection                                              */
  /* ──────────────────────────────────────────────────────────────── */

  describe('rejects anonymous callers', () => {
    it('previewBroadcastRecipientsRemote throws 401', async () => {
      await expectHttpError(() => previewBroadcastRecipientsRemote(), 401)
    })

    it('listBroadcastHistoryRemote throws 401', async () => {
      await expectHttpError(() => listBroadcastHistoryRemote(), 401)
    })

    it('sendBroadcastEmailRemote throws 401', async () => {
      await expectHttpError(
        () =>
          sendBroadcastEmailRemote({
            subject: 'Hi',
            body: 'Body',
            attachments: []
          }),
        401
      )
      expect(sendBroadcastEmailMock).not.toHaveBeenCalled()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Permission gates                                                 */
  /* ──────────────────────────────────────────────────────────────── */

  describe('permission gates', () => {
    it('preview refuses callers without mailings:read', async () => {
      authAs({ permissions: ['customers'] })
      await expectHttpError(() => previewBroadcastRecipientsRemote(), 403)
    })

    it('history refuses callers without mailings:read', async () => {
      authAs({ permissions: ['customers'] })
      await expectHttpError(() => listBroadcastHistoryRemote(), 403)
    })

    it('send refuses callers without the mailings module', async () => {
      authAs({ permissions: ['customers'] })
      await expectHttpError(
        () =>
          sendBroadcastEmailRemote({
            subject: 'Hi',
            body: 'Body',
            attachments: []
          }),
        403
      )
      expect(sendBroadcastEmailMock).not.toHaveBeenCalled()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Preview happy path                                               */
  /* ──────────────────────────────────────────────────────────────── */

  describe('previewBroadcastRecipientsRemote', () => {
    beforeEach(() => {
      authAs({ permissions: [WILDCARD_PERMISSION] })
    })

    it('returns zero when no customers opted in', async () => {
      const res = await previewBroadcastRecipientsRemote()
      expect(res.totalOptIn).toBe(0)
      expect(res.totalWithEmail).toBe(0)
      expect(res.sampleNames).toEqual([])
    })

    it('separates total opt-in from total-with-email', async () => {
      await seedOptInCustomer('a@example.com', {
        firstName: 'A',
        lastName: 'Eins'
      })
      await seedOptInCustomer('b@example.com', {
        firstName: 'B',
        lastName: 'Zwei'
      })
      await seedOptInCustomer(null, { firstName: 'C', lastName: 'Drei' }) // no email
      const res = await previewBroadcastRecipientsRemote()
      expect(res.totalOptIn).toBe(3)
      expect(res.totalWithEmail).toBe(2)
      // Sample names take the first few with emails, sorted by
      // customer-service ordering (lastName, firstName).
      expect(res.sampleNames.length).toBeGreaterThanOrEqual(1)
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Broadcast happy path                                             */
  /* ──────────────────────────────────────────────────────────────── */

  describe('sendBroadcastEmailRemote', () => {
    beforeEach(() => {
      authAs({ permissions: ['mailings', 'mailings'] })
    })

    it('forwards the payload to the mail service and returns its result', async () => {
      sendBroadcastEmailMock.mockResolvedValueOnce({
        sent: 12,
        failed: [{ customerId: 'cust-x', reason: 'bounce' }]
      })
      const res = await sendBroadcastEmailRemote({
        subject: 'Frühling',
        body: 'Hallo!',
        attachments: [
          {
            filename: 'flyer.pdf',
            mime: 'application/pdf',
            base64Data: Buffer.from('xx').toString('base64')
          }
        ]
      })
      expect(res).toEqual({
        sent: 12,
        failed: [{ customerId: 'cust-x', reason: 'bounce' }]
      })
      expect(sendBroadcastEmailMock).toHaveBeenCalledTimes(1)
      const call = sendBroadcastEmailMock.mock.calls[0][0] as {
        subject: string
        attachments: { filename: string }[]
      }
      expect(call.subject).toBe('Frühling')
      expect(call.attachments).toHaveLength(1)
      expect(call.attachments[0].filename).toBe('flyer.pdf')
    })

    it('rejects empty subject via the Valibot schema', async () => {
      await expect(
        sendBroadcastEmailRemote({
          subject: '   ',
          body: 'Body',
          attachments: []
        })
      ).rejects.toThrow()
      expect(sendBroadcastEmailMock).not.toHaveBeenCalled()
    })

    it('rejects attachments that exceed the 14 MB base64 cap', async () => {
      const huge = 'a'.repeat(14_000_001)
      await expect(
        sendBroadcastEmailRemote({
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
      expect(sendBroadcastEmailMock).not.toHaveBeenCalled()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* History happy path                                               */
  /* ──────────────────────────────────────────────────────────────── */

  describe('listBroadcastHistoryRemote', () => {
    beforeEach(() => {
      authAs({ permissions: ['mailings'] })
    })

    it('returns only mailing-typed rows, newest first', async () => {
      // Seed a mix of mailing + invoice rows; only mailing rows should
      // surface, ordered by sentAt DESC.
      await db.insert(sentMessages).values([
        {
          documentId: null,
          documentType: 'invoice',
          recipientEmail: 'a@example.com',
          subject: 'Rechnung',
          bodyText: 'body',
          status: 'sent',
          sentAt: new Date('2026-05-20T10:00:00Z')
        },
        {
          documentId: null,
          documentType: 'mailing',
          recipientEmail: 'b@example.com',
          subject: 'Newsletter Mai',
          bodyText: 'body',
          status: 'sent',
          sentAt: new Date('2026-05-22T10:00:00Z')
        },
        {
          documentId: null,
          documentType: 'mailing',
          recipientEmail: 'c@example.com',
          subject: 'Newsletter April',
          bodyText: 'body',
          status: 'sent',
          sentAt: new Date('2026-04-22T10:00:00Z')
        }
      ])
      const rows = await listBroadcastHistoryRemote()
      expect(rows.map((r) => r.recipientEmail)).toEqual([
        'b@example.com',
        'c@example.com'
      ])
    })

    it('caps the result at 10 rows', async () => {
      const now = Date.now()
      const values = Array.from({ length: 15 }).map((_, i) => ({
        documentId: null,
        documentType: 'mailing',
        recipientEmail: `r${i}@example.com`,
        subject: `Mailing ${i}`,
        bodyText: 'body',
        status: 'sent',
        sentAt: new Date(now - i * 1000)
      }))
      await db.insert(sentMessages).values(values)
      const rows = await listBroadcastHistoryRemote()
      expect(rows).toHaveLength(10)
    })
  })
})
