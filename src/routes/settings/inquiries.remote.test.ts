// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path tests for the public-contact inquiry admin
 * remote. Mirrors `mailings.remote.test.ts`:
 *   - `$app/server` is faked with thin wrappers that run the Valibot
 *     schema against a controllable `getRequestEvent()`.
 *   - `sendContactNotification` is stubbed so we observe how the
 *     remote feeds it the persisted row's fields, without spinning
 *     up nodemailer.
 *
 * @group integration
 * @module settings
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

const { sendContactNotificationMock } = vi.hoisted(() => ({
  sendContactNotificationMock:
    vi.fn<
      (
        input: unknown
      ) => Promise<
        { ok: true; messageId: string | null } | { ok: false; error: string }
      >
    >()
}))
vi.mock('$lib/server/services/mail-service', async () => {
  const actual = await vi.importActual<
    typeof import('$lib/server/services/mail-service')
  >('$lib/server/services/mail-service')
  return { ...actual, sendContactNotification: sendContactNotificationMock }
})

import { db } from '$lib/server/db/client'
import { customerInquiries } from '$lib/server/db/schema'
import {
  listInquiriesRemote,
  retryInquiryNotificationRemote
} from './inquiries.remote'

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
  await db.delete(customerInquiries)
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

async function seedInquiry(
  overrides: Partial<typeof customerInquiries.$inferInsert> = {}
): Promise<string> {
  const [row] = await db
    .insert(customerInquiries)
    .values({
      customerEmail: 'lead@example.com',
      customerName: 'Lead Person',
      subject: 'Frage',
      message: 'Inhalt',
      ...overrides
    })
    .returning({ id: customerInquiries.id })
  return row.id
}

describe('inquiries.remote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
    sendContactNotificationMock.mockReset()
    sendContactNotificationMock.mockResolvedValue({
      ok: true,
      messageId: '<retry>'
    })
  })

  describe('rejects anonymous callers', () => {
    it('listInquiriesRemote throws 401', async () => {
      await expectHttpError(
        () => listInquiriesRemote({ page: 1, size: 25 }),
        401
      )
    })

    it('retryInquiryNotificationRemote throws 401', async () => {
      await expectHttpError(
        () =>
          retryInquiryNotificationRemote({
            id: '11111111-1111-1111-1111-111111111111'
          }),
        401
      )
      expect(sendContactNotificationMock).not.toHaveBeenCalled()
    })
  })

  describe('permission gates', () => {
    it('list refuses callers without mailings:read', async () => {
      authAs({ permissions: ['customers'] })
      await expectHttpError(
        () => listInquiriesRemote({ page: 1, size: 25 }),
        403
      )
    })

    it('retry refuses callers without the mailings module', async () => {
      authAs({ permissions: ['customers'] })
      const id = await seedInquiry()
      await expectHttpError(() => retryInquiryNotificationRemote({ id }), 403)
      expect(sendContactNotificationMock).not.toHaveBeenCalled()
    })
  })

  describe('list', () => {
    it('returns the persisted inquiries newest-first with notification status', async () => {
      authAs({ permissions: ['mailings'] })
      const first = await seedInquiry({
        customerEmail: 'a@example.com',
        subject: 'A',
        message: 'm'
      })
      // Add a small delay so created_at differs.
      await new Promise((r) => setTimeout(r, 10))
      const second = await seedInquiry({
        customerEmail: 'b@example.com',
        subject: 'B',
        message: 'm'
      })
      const result = await listInquiriesRemote({ page: 1, size: 25 })
      expect(result.total).toBe(2)
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe(second)
      expect(result.items[1].id).toBe(first)
      expect(result.items[0].notificationStatus).toBe('pending')
    })

    it('filters by notification status', async () => {
      authAs({ permissions: ['mailings'] })
      await seedInquiry({
        customerEmail: 'sent@example.com',
        subject: 'S',
        message: 'm',
        notificationStatus: 'sent'
      })
      await seedInquiry({
        customerEmail: 'failed@example.com',
        subject: 'F',
        message: 'm',
        notificationStatus: 'failed'
      })
      const failed = await listInquiriesRemote({
        page: 1,
        size: 25,
        status: 'failed'
      })
      expect(failed.total).toBe(1)
      expect(failed.items[0].customerEmail).toBe('failed@example.com')
    })
  })

  describe('retry', () => {
    it('re-sends a previously-sent inquiry (we picked "re-sends")', async () => {
      authAs({ permissions: ['mailings', 'mailings'] })
      const id = await seedInquiry({
        notificationStatus: 'sent',
        notificationSentAt: new Date('2026-05-01T10:00:00Z')
      })
      const res = await retryInquiryNotificationRemote({ id })
      expect(res.ok).toBe(true)
      expect(sendContactNotificationMock).toHaveBeenCalledTimes(1)
      const all = await db.select().from(customerInquiries)
      const updated = all.find((r) => r.id === id)
      expect(updated?.notificationStatus).toBe('sent')
      expect(updated?.notificationError).toBeNull()
    })

    it('records a failed retry on the row and returns the error', async () => {
      authAs({ permissions: ['mailings', 'mailings'] })
      sendContactNotificationMock.mockResolvedValueOnce({
        ok: false,
        error: 'SMTP down'
      })
      const id = await seedInquiry()
      const res = await retryInquiryNotificationRemote({ id })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBe('SMTP down')
      const all = await db.select().from(customerInquiries)
      const updated = all.find((r) => r.id === id)
      expect(updated?.notificationStatus).toBe('failed')
      expect(updated?.notificationError).toBe('SMTP down')
    })

    it('returns 404 for an unknown inquiry id', async () => {
      authAs({ permissions: ['mailings'] })
      await expectHttpError(
        () =>
          retryInquiryNotificationRemote({
            id: '00000000-0000-0000-0000-000000000000'
          }),
        404
      )
      expect(sendContactNotificationMock).not.toHaveBeenCalled()
    })
  })
})
