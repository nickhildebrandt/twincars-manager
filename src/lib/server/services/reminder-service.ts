/**
 * Dunning service.
 *
 * Maps the high-level "remind a customer about an unpaid invoice" flow
 * onto the `reminders` table and the `documents.reminderLevel` mirror.
 *
 * Rules of the road:
 * - There can be at most one reminder per (invoice, level) — enforced by
 *   the unique index `reminders_invoice_level_idx`.
 * - Reminders escalate sequentially: you can only create level N+1
 *   after level N exists. The service computes the next allowed level.
 * - Each reminder carries its own `dueDate`, fee, default-interest
 *   amount and status. The fee/interest defaults come from the company
 *   settings; the caller can override them at creation time.
 */

import { and, asc, eq, isNull, lt, notInArray } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  reminders,
  type CompanySettings,
  type Reminder
} from '$lib/server/db/schema'
import { getSettings } from './settings-service'
import { nextDocumentNumber } from './document-service'

const round2 = (v: number): number => Math.round(v * 100) / 100

const addDays = (yyyymmdd: string, days: number): string => {
  const d = new Date(yyyymmdd)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Extract the per-level configuration from `company_settings`. */
const levelConfig = (settings: CompanySettings, level: 1 | 2 | 3 | 4) => {
  const [days, fee] =
    level === 1
      ? [settings.reminderDays1, settings.reminderFee1]
      : level === 2
        ? [settings.reminderDays2, settings.reminderFee2]
        : level === 3
          ? [settings.reminderDays3, settings.reminderFee3]
          : [settings.reminderDays4, settings.reminderFee4]
  return { days, fee: Number(fee) }
}

export type CreateReminderInput = {
  invoiceId: string
  /** Force a specific level (otherwise: existing level + 1, default 1). */
  level?: 1 | 2 | 3 | 4
  /** Override the fee. Falls back to the configured default. */
  fee?: number
  /** Override the new due date (YYYY-MM-DD). Falls back to today + N days. */
  dueDate?: string
  notes?: string
}

/**
 * Create a reminder for an invoice. Refuses if:
 * - the document is not an invoice;
 * - the invoice is already `paid` or `cancelled`;
 * - a reminder for the requested level already exists;
 * - the requested level skips a step (e.g. asking for level 3 when only
 *   level 1 exists).
 */
export const createReminderForInvoice = async (
  input: CreateReminderInput
): Promise<Reminder> => {
  const { invoiceId } = input
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, invoiceId))
    .limit(1)
  if (!doc) {
    throw new Error('Rechnung nicht gefunden.')
  }
  if (doc.type !== 'invoice') {
    throw new Error('Mahnungen können nur zu Rechnungen erzeugt werden.')
  }
  if (doc.status === 'paid' || doc.status === 'cancelled') {
    throw new Error(
      'Mahnungen sind nur für offene, nicht stornierte Rechnungen möglich.'
    )
  }

  const settings = await getSettings()

  // Determine next allowed level.
  const existing = await db
    .select({ level: reminders.level })
    .from(reminders)
    .where(eq(reminders.invoiceId, invoiceId))
    .orderBy(asc(reminders.level))
  const highest = existing.length ? existing[existing.length - 1].level : 0
  const target = (input.level ?? Math.min(highest + 1, 4)) as 1 | 2 | 3 | 4
  if (target < 1 || target > 4) {
    throw new Error('Ungültige Mahnstufe.')
  }
  if (existing.some((r) => r.level === target)) {
    throw new Error('Diese Mahnstufe wurde bereits erzeugt.')
  }
  if (target > highest + 1) {
    throw new Error(
      'Mahnstufen müssen aufeinanderfolgend erzeugt werden (z. B. erst 1. dann 2. Mahnung).'
    )
  }

  const { days, fee: defaultFee } = levelConfig(settings, target)
  const fee = input.fee != null ? round2(input.fee) : defaultFee
  const today = new Date().toISOString().slice(0, 10)
  const issueDate = today
  const dueDate = input.dueDate ?? addDays(today, days)

  // Default-interest amount: gross × interest-rate × overdue-days / 365.
  // We compute it from the original due date if available; otherwise 0.
  let interest = 0
  if (doc.dueDate) {
    const overdueDays = Math.max(
      0,
      Math.floor(
        (new Date(today).getTime() - new Date(doc.dueDate).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    )
    const rate = Number(settings.reminderInterestRate)
    interest = round2(
      (Number(doc.grossTotal) * (rate / 100) * overdueDays) / 365
    )
  }

  const documentNumber = await nextDocumentNumber('reminder')
  const [row] = await db
    .insert(reminders)
    .values({
      documentNumber,
      invoiceId,
      level: target,
      issueDate,
      dueDate,
      fee: String(fee),
      interest: String(interest),
      status: 'open',
      notes: input.notes ?? null
    })
    .returning()

  // Mirror level on the invoice for fast list queries.
  await db
    .update(documents)
    .set({ reminderLevel: target, updatedAt: new Date() })
    .where(eq(documents.id, invoiceId))

  return row
}

export const listOpenReminders = async () => {
  const rows = await db
    .select({
      id: reminders.id,
      documentNumber: reminders.documentNumber,
      invoiceId: reminders.invoiceId,
      invoiceNumber: documents.documentNumber,
      level: reminders.level,
      issueDate: reminders.issueDate,
      dueDate: reminders.dueDate,
      fee: reminders.fee,
      interest: reminders.interest,
      status: reminders.status,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      grossTotal: documents.grossTotal
    })
    .from(reminders)
    .innerJoin(documents, eq(documents.id, reminders.invoiceId))
    .leftJoin(customers, eq(customers.id, documents.customerId))
    .where(and(eq(reminders.status, 'open')))
    .orderBy(asc(reminders.dueDate))
  return rows.map(({ customerCompany, customerLastName, ...rest }) => ({
    ...rest,
    customerName: customerCompany ?? customerLastName ?? null
  }))
}

/**
 * Find invoices that are overdue and have not yet had every reminder
 * level created. Used by a future scheduler to auto-generate the next
 * reminder when `settings.reminderAutoEnabled` is true.
 */
export const findInvoicesNeedingReminder = async () => {
  const today = new Date().toISOString().slice(0, 10)
  return db
    .select({
      id: documents.id,
      number: documents.documentNumber,
      dueDate: documents.dueDate,
      reminderLevel: documents.reminderLevel
    })
    .from(documents)
    .where(
      and(
        eq(documents.type, 'invoice'),
        notInArray(documents.status, [
          'paid',
          'cancelled',
          'draft',
          'created',
          'converted'
        ]),
        lt(documents.dueDate, today),
        lt(documents.reminderLevel, 4)
      )
    )
    .orderBy(asc(documents.dueDate))
}

export type ReminderListRow = Awaited<
  ReturnType<typeof listOpenReminders>
>[number]
export type ReminderRow = Reminder

/** Get a single reminder joined with its invoice + customer for detail views. */
export const getReminderById = async (id: string) => {
  const [row] = await db
    .select({
      reminder: reminders,
      invoiceNumber: documents.documentNumber,
      invoiceGross: documents.grossTotal,
      invoiceDueDate: documents.dueDate,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      customerCity: customers.city
    })
    .from(reminders)
    .innerJoin(documents, eq(documents.id, reminders.invoiceId))
    .leftJoin(customers, eq(customers.id, documents.customerId))
    .where(eq(reminders.id, id))
    .limit(1)
  if (!row) return null
  const { customerCompany, customerLastName, ...rest } = row
  return { ...rest, customerName: customerCompany ?? customerLastName ?? null }
}

/** All reminders for a given invoice, oldest first. */
export const listRemindersForInvoice = async (invoiceId: string) => {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.invoiceId, invoiceId))
    .orderBy(asc(reminders.level))
}
