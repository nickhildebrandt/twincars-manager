/**
 * Tire-change reminder service.
 *
 * The workshop stores tires for customers between seasons. Twice a
 * year — mid-March (Sommerräder rauf) and mid-October (Winterräder
 * rauf) — every customer whose tires are still stored gets a
 * friendly mail nudging them to book a swap appointment.
 *
 * The job is idempotent: a row in `tire_reminder_log` per
 * `(customerId, season, year)` prevents a second invocation from
 * mailing the same customer twice in the same season.
 */
import { db } from '$lib/server/db/client'
import {
  customers,
  tireReminderLog,
  tireStorage,
  type Customer,
  type TireReminderSeason
} from '$lib/server/db/schema'
import { and, asc, eq, isNull, notInArray, sql } from 'drizzle-orm'
import { sendDocumentEmail } from './mail-service'

/**
 * Number of sample customers returned by the preview helper. The
 * settings card surfaces just enough names to give the operator a
 * sanity check before clicking "Jetzt senden".
 */
const PREVIEW_SAMPLE_SIZE = 5

export type TireReminderSendResult = {
  sent: number
  failed: Array<{ customerId: string; reason: string }>
}

export type TireReminderPreview = { count: number; sampleNames: string[] }

/**
 * Resolve the calendar year a season-change run belongs to. Defaults to
 * the current year when no explicit `asOf` is given.
 */
const yearFor = (asOf?: Date): number => (asOf ?? new Date()).getUTCFullYear()

/**
 * Build the human-readable label the preview list shows. Mirrors the
 * customer-list naming priority: company first, otherwise full name,
 * otherwise customer number.
 */
const displayName = (
  c: Pick<Customer, 'company' | 'firstName' | 'lastName' | 'customerNumber'>
): string =>
  c.company ||
  `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
  c.customerNumber

/**
 * Return every customer eligible for a tire-reminder mail in the given
 * season/year:
 *
 *  - `wants_tire_reminders = true`
 *  - not archived
 *  - has at least one tire-storage row with `retrieved_at IS NULL`
 *  - has an email address on file
 *  - no `tire_reminder_log` entry exists yet for the current
 *    `(season, year)` tuple — guarantees the second run is a no-op.
 */
export async function findTireReminderCandidates(
  season: TireReminderSeason,
  asOf?: Date
): Promise<Customer[]> {
  const year = yearFor(asOf)

  const alreadyNotified = db
    .select({ id: tireReminderLog.customerId })
    .from(tireReminderLog)
    .where(
      and(eq(tireReminderLog.season, season), eq(tireReminderLog.year, year))
    )

  // Distinct customers with at least one active tire-storage row.
  const withActiveStorage = db
    .selectDistinct({ id: tireStorage.customerId })
    .from(tireStorage)
    .where(isNull(tireStorage.retrievedAt))

  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.archived, false),
        eq(customers.wantsTireReminders, true),
        sql`${customers.email} IS NOT NULL AND ${customers.email} <> ''`,
        sql`${customers.id} IN ${withActiveStorage}`,
        notInArray(customers.id, alreadyNotified)
      )
    )
    .orderBy(asc(customers.lastName), asc(customers.firstName))

  return rows
}

/**
 * Lightweight preview for the settings UI: how many candidates would
 * be mailed, plus up to {@link PREVIEW_SAMPLE_SIZE} sample names so
 * the operator can confirm the list looks right before triggering the
 * actual send.
 */
export async function previewTireReminderCandidates(
  season: TireReminderSeason,
  asOf?: Date
): Promise<TireReminderPreview> {
  const all = await findTireReminderCandidates(season, asOf)
  return {
    count: all.length,
    sampleNames: all.slice(0, PREVIEW_SAMPLE_SIZE).map(displayName)
  }
}

/**
 * Send a tire-reminder mail to every candidate for the given season.
 *
 * Returns a `{ sent, failed }` tuple. Each mail that goes out
 * successfully gets a corresponding `tire_reminder_log` row so the
 * next invocation skips that customer; mails that fail are NOT
 * logged, which lets a follow-up run retry them.
 */
export async function sendTireReminders(
  season: TireReminderSeason,
  asOf?: Date
): Promise<TireReminderSendResult> {
  const year = yearFor(asOf)
  const candidates = await findTireReminderCandidates(season, asOf)

  const failed: Array<{ customerId: string; reason: string }> = []
  let sent = 0

  for (const c of candidates) {
    if (!c.email) {
      failed.push({
        customerId: c.id,
        reason: 'Keine E-Mail-Adresse hinterlegt.'
      })
      continue
    }

    const recipientName = displayName(c)

    try {
      const result = await sendDocumentEmail({
        documentId: null,
        documentType: 'tire_reminder',
        to: { email: c.email, name: recipientName },
        context: {
          customer: {
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            salutation: c.salutation
          }
        }
      })

      if (!result.ok) {
        failed.push({ customerId: c.id, reason: result.error })
        continue
      }

      // Only log AFTER a successful send so a failed mail can be
      // retried on the next run without violating the unique index.
      await db
        .insert(tireReminderLog)
        .values({ customerId: c.id, season, year })
        .onConflictDoNothing({
          target: [
            tireReminderLog.customerId,
            tireReminderLog.season,
            tireReminderLog.year
          ]
        })
      sent += 1
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unbekannter Fehler.'
      failed.push({ customerId: c.id, reason })
    }
  }

  return { sent, failed }
}
