import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the tire-reminder service. The mail-service
 * is stubbed out so we can observe sends, simulate failures and keep
 * the test database deterministic.
 *
 * @group integration
 * @module tire-reminder-service
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const { sendDocumentEmailMock } = vi.hoisted(() => ({
  sendDocumentEmailMock:
    vi.fn<
      (
        input: unknown
      ) => Promise<
        { ok: true; messageId: string | null } | { ok: false; error: string }
      >
    >()
}))
vi.mock('./mail-service', () => ({ sendDocumentEmail: sendDocumentEmailMock }))

import { db } from '$lib/server/db/client'
import { customers, tireReminderLog, tireStorage } from '$lib/server/db/schema'
import {
  findTireReminderCandidates,
  previewTireReminderCandidates,
  sendTireReminders
} from './tire-reminder-service'

const SAMPLE_DATE = new Date('2026-03-15T12:00:00.000Z')

type CustomerSeed = {
  customerNumber: string
  firstName?: string
  lastName?: string
  company?: string
  email?: string | null
  wantsTireReminders?: boolean
  archived?: boolean
}

async function insertCustomer(seed: CustomerSeed): Promise<string> {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: seed.customerNumber,
      firstName: seed.firstName,
      lastName: seed.lastName,
      company: seed.company,
      email:
        seed.email === undefined
          ? `${seed.customerNumber}@example.test`
          : (seed.email ?? null),
      kind: 'regular',
      wantsTireReminders: seed.wantsTireReminders ?? true,
      archived: seed.archived ?? false
    })
    .returning({ id: customers.id })
  return row.id
}

async function insertStorage(customerId: string, retrieved = false) {
  await db
    .insert(tireStorage)
    .values({
      storageNumber: `L-${customerId.slice(0, 6)}`,
      customerId,
      storedAt: '2025-10-01',
      retrievedAt: retrieved ? '2025-12-15' : null,
      quantity: 4
    })
}

async function resetDb() {
  await db.delete(tireReminderLog)
  await db.delete(tireStorage)
  await db.delete(customers)
}

describe('tire-reminder-service', () => {
  beforeEach(async () => {
    await resetDb()
    sendDocumentEmailMock.mockReset()
    sendDocumentEmailMock.mockResolvedValue({ ok: true, messageId: 'm-1' })
  })

  describe('findTireReminderCandidates', () => {
    it('returns customers with opt-in, active storage and an email', async () => {
      const a = await insertCustomer({
        customerNumber: 'K-100',
        firstName: 'Anna',
        lastName: 'Aurum'
      })
      await insertStorage(a)
      const b = await insertCustomer({
        customerNumber: 'K-101',
        firstName: 'Berta',
        lastName: 'Becker'
      })
      await insertStorage(b)

      const rows = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(rows.map((r) => r.customerNumber).sort()).toEqual([
        'K-100',
        'K-101'
      ])
    })

    it('excludes opted-out customers even if they have stored tires', async () => {
      const optedIn = await insertCustomer({
        customerNumber: 'K-200',
        lastName: 'Yes',
        wantsTireReminders: true
      })
      await insertStorage(optedIn)
      const optedOut = await insertCustomer({
        customerNumber: 'K-201',
        lastName: 'No',
        wantsTireReminders: false
      })
      await insertStorage(optedOut)

      const rows = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(rows.map((r) => r.customerNumber)).toEqual(['K-200'])
    })

    it('excludes customers without any active tire-storage row', async () => {
      const withStorage = await insertCustomer({
        customerNumber: 'K-300',
        lastName: 'WithTires'
      })
      await insertStorage(withStorage)

      const withoutStorage = await insertCustomer({
        customerNumber: 'K-301',
        lastName: 'NoTires'
      })

      const onlyRetrieved = await insertCustomer({
        customerNumber: 'K-302',
        lastName: 'AlreadyPickedUp'
      })
      await insertStorage(onlyRetrieved, true)

      const rows = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(rows.map((r) => r.customerNumber)).toEqual(['K-300'])
    })

    it('excludes archived customers', async () => {
      const archived = await insertCustomer({
        customerNumber: 'K-400',
        lastName: 'Archived',
        archived: true
      })
      await insertStorage(archived)

      const rows = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(rows).toEqual([])
    })

    it('excludes customers without an email address', async () => {
      const noMail = await insertCustomer({
        customerNumber: 'K-500',
        lastName: 'NoMail',
        email: null
      })
      await insertStorage(noMail)

      const rows = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(rows).toEqual([])
    })

    it('excludes customers already logged for the same season + year', async () => {
      const c = await insertCustomer({
        customerNumber: 'K-600',
        lastName: 'AlreadyDone'
      })
      await insertStorage(c)
      await db
        .insert(tireReminderLog)
        .values({ customerId: c, season: 'spring', year: 2026 })

      const spring = await findTireReminderCandidates('spring', SAMPLE_DATE)
      expect(spring).toEqual([])

      // A run in autumn of the same year should still pick the
      // customer up — the log row is scoped to spring/2026.
      const autumn = await findTireReminderCandidates('autumn', SAMPLE_DATE)
      expect(autumn).toHaveLength(1)
    })
  })

  describe('previewTireReminderCandidates', () => {
    it('returns count + up to five sample names', async () => {
      for (let i = 0; i < 7; i++) {
        const id = await insertCustomer({
          customerNumber: `K-7${i.toString().padStart(2, '0')}`,
          lastName: `Mustermann${i}`
        })
        await insertStorage(id)
      }
      const preview = await previewTireReminderCandidates('spring', SAMPLE_DATE)
      expect(preview.count).toBe(7)
      expect(preview.sampleNames).toHaveLength(5)
    })

    it('returns zero count + empty sample when no candidates exist', async () => {
      const preview = await previewTireReminderCandidates('spring', SAMPLE_DATE)
      expect(preview).toEqual({ count: 0, sampleNames: [] })
    })
  })

  describe('sendTireReminders', () => {
    it('mails every candidate and writes a log row for each success', async () => {
      const a = await insertCustomer({
        customerNumber: 'K-800',
        lastName: 'Adler'
      })
      await insertStorage(a)
      const b = await insertCustomer({
        customerNumber: 'K-801',
        lastName: 'Bremer'
      })
      await insertStorage(b)

      const result = await sendTireReminders('spring', SAMPLE_DATE)
      expect(result.sent).toBe(2)
      expect(result.failed).toEqual([])
      expect(sendDocumentEmailMock).toHaveBeenCalledTimes(2)

      const logs = await db.select().from(tireReminderLog)
      expect(logs).toHaveLength(2)
      expect(new Set(logs.map((r) => r.season))).toEqual(new Set(['spring']))
      expect(new Set(logs.map((r) => r.year))).toEqual(new Set([2026]))
    })

    it('is idempotent — a second call in the same season is a no-op', async () => {
      const a = await insertCustomer({
        customerNumber: 'K-900',
        lastName: 'Adler'
      })
      await insertStorage(a)

      const first = await sendTireReminders('spring', SAMPLE_DATE)
      expect(first.sent).toBe(1)

      sendDocumentEmailMock.mockClear()
      const second = await sendTireReminders('spring', SAMPLE_DATE)
      expect(second.sent).toBe(0)
      expect(second.failed).toEqual([])
      expect(sendDocumentEmailMock).not.toHaveBeenCalled()
    })

    it('does NOT log a customer whose mail send failed', async () => {
      const a = await insertCustomer({
        customerNumber: 'K-A00',
        lastName: 'Fehler'
      })
      await insertStorage(a)

      sendDocumentEmailMock.mockResolvedValueOnce({
        ok: false,
        error: 'SMTP-Verbindung fehlgeschlagen.'
      })

      const result = await sendTireReminders('spring', SAMPLE_DATE)
      expect(result.sent).toBe(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].customerId).toBe(a)

      const logs = await db.select().from(tireReminderLog)
      expect(logs).toEqual([])
    })

    it('separates spring and autumn runs in the same year', async () => {
      const c = await insertCustomer({
        customerNumber: 'K-B00',
        lastName: 'Sommerwinter'
      })
      await insertStorage(c)

      const spring = await sendTireReminders('spring', SAMPLE_DATE)
      expect(spring.sent).toBe(1)
      const autumn = await sendTireReminders(
        'autumn',
        new Date('2026-10-15T12:00:00.000Z')
      )
      expect(autumn.sent).toBe(1)

      const logs = await db.select().from(tireReminderLog)
      expect(logs.map((r) => r.season).sort()).toEqual(['autumn', 'spring'])
    })
  })
})
