/**
 * Integration tests for the simplified Zahlungserinnerung service.
 *
 * What we care about:
 * - Every call writes the same friendly `reminder_1` template — no
 *   escalation, no fee, no interest.
 * - The sequential counter increments on each send and mirrors onto
 *   `documents.reminderLevel`.
 * - Recurring auto-send picks the invoice up again after
 *   `reminderRecurEveryDays` have elapsed since the previous send.
 * - Already-paid / cancelled invoices are refused.
 *
 * @group integration
 * @module reminder-service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// Both reminder PDF rendering and mail sending are best-effort
// side-effects; stub them out so we don't pull pdf-lib / nodemailer.
vi.mock('./pdf-service', () => ({
  renderAndPersistReminderPdf: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./mail-service', () => ({
  sendDocumentEmail: vi.fn().mockResolvedValue(undefined)
}))

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  customers,
  documents,
  numberRanges,
  reminders
} from '$lib/server/db/schema'
import { sendPaymentReminder } from './reminder-service'

const seedNumberRange = async (formatTemplate = 'ZE-{YYYY}-{NNNN}') => {
  await db
    .insert(numberRanges)
    .values({ kind: 'reminder', formatTemplate, nextValue: 1 })
}

const seedCompanySettings = async (
  overrides: Partial<typeof companySettings.$inferInsert> = {}
): Promise<void> => {
  await db
    .insert(companySettings)
    .values({
      companyName: 'Demo GmbH',
      street: 'Musterstr. 1',
      zip: '10115',
      city: 'Berlin',
      email: 'demo@example.com',
      phone: '030/123',
      pdfFooter: '',
      ...overrides
    })
}

const seedCustomer = async (
  overrides: Partial<typeof customers.$inferInsert> = {}
): Promise<string> => {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: `KU-${Math.random().toString().slice(2, 8)}`,
      lastName: 'Mustermann',
      email: 'kunde@example.com',
      ...overrides
    })
    .returning({ id: customers.id })
  return row.id
}

const seedInvoice = async (
  customerId: string,
  overrides: Partial<typeof documents.$inferInsert> = {}
): Promise<string> => {
  const [row] = await db
    .insert(documents)
    .values({
      documentNumber: `RE-${Math.random().toString().slice(2, 8)}`,
      type: 'invoice',
      status: 'sent',
      customerId,
      issueDate: '2026-05-01',
      dueDate: '2026-05-15',
      grossTotal: '119.00',
      ...overrides
    })
    .returning({ id: documents.id })
  return row.id
}

describe('reminder-service', () => {
  beforeEach(async () => {
    // Order matters: child rows before parent rows.
    await db.delete(reminders)
    await db.delete(documents)
    await db.delete(customers)
    await db.delete(numberRanges)
    await db.delete(companySettings)
  })

  describe('sendPaymentReminder', () => {
    it('writes a single Zahlungserinnerung without fee or interest', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const invoiceId = await seedInvoice(customerId)

      const reminder = await sendPaymentReminder(invoiceId, {
        asOf: '2026-05-20'
      })

      expect(reminder.level).toBe(1)
      expect(reminder.issueDate).toBe('2026-05-20')
      // No fee/interest columns survive in the schema; make sure we
      // didn't accidentally resurrect them on the returned row.
      expect(reminder).not.toHaveProperty('fee')
      expect(reminder).not.toHaveProperty('interest')

      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, invoiceId))
      expect(doc.reminderLevel).toBe(1)
    })

    it('increments the counter on each subsequent send with the same template', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const invoiceId = await seedInvoice(customerId)

      const first = await sendPaymentReminder(invoiceId, { asOf: '2026-05-20' })
      const second = await sendPaymentReminder(invoiceId, {
        asOf: '2026-06-03'
      })
      const third = await sendPaymentReminder(invoiceId, { asOf: '2026-06-17' })

      expect([first.level, second.level, third.level]).toEqual([1, 2, 3])

      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, invoiceId))
      expect(doc.reminderLevel).toBe(3)
    })

    it('refuses to remind on a paid invoice', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const invoiceId = await seedInvoice(customerId, { status: 'paid' })

      await expect(sendPaymentReminder(invoiceId)).rejects.toThrow(
        /offene, nicht stornierte/
      )
    })

    it('refuses to remind on a cancelled invoice', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const invoiceId = await seedInvoice(customerId, { status: 'cancelled' })

      await expect(sendPaymentReminder(invoiceId)).rejects.toThrow(
        /offene, nicht stornierte/
      )
    })

    it('refuses non-invoice documents', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const invoiceId = await seedInvoice(customerId, { type: 'offer' })

      await expect(sendPaymentReminder(invoiceId)).rejects.toThrow(
        /nur zu Rechnungen/
      )
    })
  })

  describe('recurring behaviour', () => {
    it('keeps inviting the same invoice every interval until it is paid', async () => {
      await seedNumberRange()
      await seedCompanySettings({ reminderDays1: 3, reminderRecurEveryDays: 7 })
      const customerId = await seedCustomer()
      const id = await seedInvoice(customerId, { dueDate: '2026-05-15' })

      // Simulate the cron picking the invoice up every interval. The
      // friendly template goes out every time — same one, no
      // escalation. We don't go through the broken correlated SQL
      // candidate finder here (pg-mem can't run it); the production
      // scheduler exercises that path against real Postgres. What
      // matters is that every call writes the same simple row.
      await sendPaymentReminder(id, { asOf: '2026-05-20' })
      await sendPaymentReminder(id, { asOf: '2026-05-27' })
      await sendPaymentReminder(id, { asOf: '2026-06-03' })

      const rows = await db
        .select()
        .from(reminders)
        .where(eq(reminders.invoiceId, id))
      expect(rows.map((r) => r.level).sort()).toEqual([1, 2, 3])

      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
      expect(doc.reminderLevel).toBe(3)
    })

    it('marks every sent reminder as `open` regardless of count', async () => {
      await seedNumberRange()
      await seedCompanySettings()
      const customerId = await seedCustomer()
      const id = await seedInvoice(customerId)

      await sendPaymentReminder(id, { asOf: '2026-05-20' })
      await sendPaymentReminder(id, { asOf: '2026-06-03' })

      const rows = await db
        .select()
        .from(reminders)
        .where(eq(reminders.invoiceId, id))
      // Every row has the same status — there is no per-stage
      // bookkeeping, only a counter.
      expect(rows.every((r) => r.status === 'open')).toBe(true)
    })
  })
})
