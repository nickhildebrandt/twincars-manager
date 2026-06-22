/**
 * Zahlungserinnerung service — recurring single-template payment
 * reminder.
 *
 * Business rule:
 * Es gibt keine Mahn-Stufen, keine Mahngebühren und keine
 * Verzugszinsen. Wir versenden EINE freundliche Zahlungserinnerung,
 * und solange die Rechnung nicht bezahlt ist, verschicken wir genau
 * diese eine Vorlage in regelmäßigen Abständen erneut. Das Intervall
 * ist über die Einstellungen konfigurierbar (Standard: 14 Tage).
 *
 * Implementation notes:
 * - `reminders.level` is a sequential counter (1, 2, 3, …). Each new
 *   send increments by one. The `(invoiceId, level)` unique index
 *   still acts as a safety net against accidentally writing the same
 *   counter value twice for the same invoice.
 * - `documents.reminderLevel` mirrors the highest counter sent so far
 *   — a plain "how many Zahlungserinnerungen went out" tally.
 * - `companySettings.reminderDays1` is the wait time before the FIRST
 *   Zahlungserinnerung (days after the invoice's due date).
 * - `companySettings.reminderRecurEveryDays` is the gap between
 *   successive Zahlungserinnerungen. After the first one is sent,
 *   the next eligibility date is
 *   `lastSentAt + reminderRecurEveryDays`.
 */

import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  reminders,
  type Reminder
} from '$lib/server/db/schema'
import { getSettings } from './settings-service'
import { nextDocumentNumber } from './document-service'
import { renderAndPersistReminderPdf } from './pdf-service'
import { sendDocumentEmail } from './mail-service'

const addDays = (yyyymmdd: string, days: number): string => {
  const d = new Date(yyyymmdd)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const diffDays = (fromIso: string, toIso: string): number =>
  Math.floor(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) /
      (24 * 60 * 60 * 1000)
  )

export type SendPaymentReminderOptions = {
  /** Override the new due date. Falls back to today + reminderDays1. */
  dueDate?: string
  notes?: string
  /** Today's date in YYYY-MM-DD; injectable for tests/job scheduling. */
  asOf?: string
}

/**
 * Send the (next) Zahlungserinnerung for an invoice.
 *
 * Always inserts a new `reminders` row with `level = previous + 1`,
 * regardless of how many Zahlungserinnerungen went out before. The
 * same friendly `reminder_1` template is used every time — there is
 * no escalation, no fee, no interest.
 *
 * Side effects:
 * - inserts a `reminders` row with the incremented counter,
 * - bumps `documents.reminderLevel` to that counter,
 * - renders + persists the reminder PDF,
 * - sends the mail using the `reminder_1` template if the customer
 *   has an email and SMTP is configured (best-effort; failures are
 *   swallowed and surfaced via `sent_messages`).
 *
 * Refuses if:
 * - the document is not an invoice;
 * - the invoice is already `paid` or `cancelled`.
 */
export const sendPaymentReminder = async (
  invoiceId: string,
  opts: SendPaymentReminderOptions = {}
): Promise<Reminder> => {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, invoiceId))
    .limit(1)
  if (!doc) {
    throw new Error('Rechnung nicht gefunden.')
  }
  if (doc.type !== 'invoice') {
    throw new Error(
      'Zahlungserinnerungen können nur zu Rechnungen erzeugt werden.'
    )
  }
  if (doc.status === 'paid' || doc.status === 'cancelled') {
    throw new Error(
      'Zahlungserinnerungen sind nur für offene, nicht stornierte Rechnungen möglich.'
    )
  }

  const settings = await getSettings()
  const today = opts.asOf ?? new Date().toISOString().slice(0, 10)
  // For the new due date on the Zahlungserinnerung itself we keep
  // using `reminderDays1` as a sensible default — "pay within N days
  // from today". The operator can override per call.
  const dueDate = opts.dueDate ?? addDays(today, settings.reminderDays1)

  const nextCounter = (doc.reminderLevel ?? 0) + 1
  const documentNumber = await nextDocumentNumber('reminder')
  const [row] = await db
    .insert(reminders)
    .values({
      documentNumber,
      invoiceId,
      level: nextCounter,
      issueDate: today,
      dueDate,
      status: 'open',
      notes: opts.notes ?? null
    })
    .returning()

  await db
    .update(documents)
    .set({ reminderLevel: nextCounter, updatedAt: new Date() })
    .where(eq(documents.id, invoiceId))

  // Best-effort PDF render + mail send. Failures must not abort the
  // creation — the operator can re-render / re-send from the detail
  // view. `sent_messages` keeps the audit trail on the mail side.
  try {
    await renderAndPersistReminderPdf(row.id)
  } catch (err) {
    console.error('[reminder] PDF render failed', err)
  }

  await trySendReminderEmail(row, doc).catch((err) => {
    console.error('[reminder] mail send failed', err)
  })

  return row
}

/**
 * @deprecated Use {@link sendPaymentReminder} instead. Kept as a thin
 * alias because the previous public name suggested idempotent
 * "create-once" semantics, which is no longer how the flow works.
 */
export const createPaymentReminder = sendPaymentReminder

/**
 * Try to send the Zahlungserinnerung email. Looks up the customer by
 * the invoice and uses the `reminder_1` template. Silently no-ops if
 * there is no customer or no email on file — the operator can still
 * send manually from the detail view.
 */
const trySendReminderEmail = async (
  reminder: Reminder,
  invoice: typeof documents.$inferSelect
): Promise<void> => {
  if (!invoice.customerId) return
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, invoice.customerId))
    .limit(1)
  if (!customer?.email) return

  const today = new Date().toISOString().slice(0, 10)
  const overdueDays = invoice.dueDate
    ? Math.max(0, diffDays(invoice.dueDate, today))
    : 0

  // Reference the row so future template extensions can include the
  // Zahlungserinnerungs-Nummer / Folge-Nr.; the current `reminder_1`
  // body does not yet substitute these.
  void reminder

  await sendDocumentEmail({
    documentId: invoice.id,
    documentType: 'reminder_1',
    to: { email: customer.email, name: customer.company ?? customer.lastName },
    context: {
      document: invoice,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        company: customer.company,
        salutation: customer.salutation
      },
      extra: { verzugstage: String(overdueDays) }
    }
  })
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
      status: reminders.status,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      grossTotal: documents.grossTotal
    })
    .from(reminders)
    .innerJoin(documents, eq(documents.id, reminders.invoiceId))
    .leftJoin(customers, eq(customers.id, documents.customerId))
    .where(and(eq(reminders.status, 'open')))
    .orderBy(desc(reminders.issueDate))
  return rows.map(({ customerCompany, customerLastName, ...rest }) => ({
    ...rest,
    customerName: customerCompany ?? customerLastName ?? null
  }))
}

/**
 * Find unpaid invoices that are due for a (next) Zahlungserinnerung
 * as of `asOf`. Two eligibility cases:
 *
 * 1. First-time candidates: `reminderLevel = 0` and
 *    `dueDate + reminderDays1 <= asOf`.
 * 2. Recurring candidates: `reminderLevel >= 1` and the latest
 *    Zahlungserinnerung's
 *    `issueDate + reminderRecurEveryDays <= asOf`.
 *
 * Excludes `paid`, `cancelled`, `draft` and `converted` invoices.
 * Used by {@link autoSendDuePaymentReminders}.
 */
export const listDuePaymentReminderCandidates = async (
  asOf: Date = new Date()
) => {
  const today = asOf.toISOString().slice(0, 10)
  const settings = await getSettings()
  const firstDays = settings.reminderDays1
  const recurDays = settings.reminderRecurEveryDays

  // Latest reminder per invoice (issueDate). A correlated max() in a
  // single statement keeps the read deterministic.
  const lastReminderDate = sql<string | null>`(
    SELECT MAX(${reminders.issueDate})
    FROM ${reminders}
    WHERE ${reminders.invoiceId} = ${documents.id}
  )`.as('last_reminder_date')

  const rows = await db
    .select({
      id: documents.id,
      number: documents.documentNumber,
      dueDate: documents.dueDate,
      reminderLevel: documents.reminderLevel,
      lastReminderDate
    })
    .from(documents)
    .where(
      and(
        eq(documents.type, 'invoice'),
        sql`${documents.status} not in ('paid','cancelled','draft','converted')`,
        isNotNull(documents.dueDate)
      )
    )
    .orderBy(asc(documents.dueDate))

  return rows.filter((r) => {
    if (!r.dueDate) return false
    if ((r.reminderLevel ?? 0) === 0) {
      // First Zahlungserinnerung: dueDate + firstDays <= today
      return addDays(r.dueDate, firstDays) <= today
    }
    // Recurring Zahlungserinnerung: lastReminderDate + recurDays <= today.
    if (!r.lastReminderDate) return false
    return addDays(r.lastReminderDate, recurDays) <= today
  })
}

/**
 * @deprecated Pre-refactor name. Use
 * {@link listDuePaymentReminderCandidates}.
 */
export const listOverduePaymentReminderCandidates =
  listDuePaymentReminderCandidates

/**
 * Iterate {@link listDuePaymentReminderCandidates} and send one
 * Zahlungserinnerung per invoice. Idempotent within a single cycle:
 * a candidate that has been sent at `today` cannot be eligible again
 * until `today + reminderRecurEveryDays`.
 */
export const autoSendDuePaymentReminders = async (
  asOf: Date = new Date()
): Promise<{ created: number; failed: number }> => {
  const candidates = await listDuePaymentReminderCandidates(asOf)
  const today = asOf.toISOString().slice(0, 10)
  let created = 0
  let failed = 0
  for (const c of candidates) {
    try {
      await sendPaymentReminder(c.id, { asOf: today })
      created += 1
    } catch (err) {
      failed += 1
      console.error('[reminder] auto-send failed for', c.id, err)
    }
  }
  return { created, failed }
}

/**
 * @deprecated Phase 4 simplification — auto-send candidate finder
 * across all dunning stages. Use
 * {@link listDuePaymentReminderCandidates} instead.
 */
export const findInvoicesNeedingReminder = listDuePaymentReminderCandidates

export type CreateReminderInput = {
  invoiceId: string
  /** @deprecated Ignored — the new flow auto-counts the level. */
  level?: number
  /** Override the new due date (YYYY-MM-DD). Falls back to today + N days. */
  dueDate?: string
  notes?: string
}

/**
 * @deprecated Pre-refactor multi-stage entry point. Use
 * {@link sendPaymentReminder}. The `level` argument is ignored.
 */
export const createReminderForInvoice = async (
  input: CreateReminderInput
): Promise<Reminder> => {
  return sendPaymentReminder(input.invoiceId, {
    dueDate: input.dueDate,
    notes: input.notes
  })
}

export type ReminderListRow = Awaited<
  ReturnType<typeof listOpenReminders>
>[number]
export type ReminderRow = Reminder

/** Get a single Zahlungserinnerung joined with its invoice + customer for detail views. */
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

/** All Zahlungserinnerungen for a given invoice, oldest first. */
export const listRemindersForInvoice = async (invoiceId: string) => {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.invoiceId, invoiceId))
    .orderBy(asc(reminders.level))
}
