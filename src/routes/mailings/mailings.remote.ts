import { command, query } from '$app/server'
import {
  array,
  boolean,
  maxLength,
  minLength,
  object,
  optional,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { sentMessages } from '$lib/server/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { requirePermission } from '$lib/server/auth-guards'
import {
  sendBroadcastEmail,
  type BroadcastSendResult
} from '$lib/server/services/mail-service'
import { listCustomersForBroadcast } from '$lib/server/services/customer-service'

/**
 * Per-attachment cap for broadcast emails. ~10 MB raw encodes to
 * ~13.5 MB base64; 14 MB gives a small buffer without letting a
 * malicious payload exhaust server memory.
 */
const ATTACHMENT_BASE64_MAX = 14_000_000

const attachmentSchema = object({
  filename: pipe(
    string('Bitte einen Dateinamen angeben.'),
    trim(),
    minLength(1, 'Dateiname darf nicht leer sein.'),
    maxLength(255, 'Dateiname darf maximal 255 Zeichen lang sein.')
  ),
  mime: pipe(
    string(),
    trim(),
    maxLength(100, 'MIME-Typ darf maximal 100 Zeichen lang sein.')
  ),
  base64Data: pipe(
    string('Anhang-Daten fehlen.'),
    minLength(1, 'Anhang-Daten dürfen nicht leer sein.'),
    maxLength(
      ATTACHMENT_BASE64_MAX,
      'Der Anhang ist zu groß (maximal 10 MB pro Datei).'
    )
  )
})

const broadcastSchema = object({
  subject: pipe(
    string('Bitte einen Betreff eingeben.'),
    trim(),
    minLength(1, 'Der Betreff darf nicht leer sein.'),
    maxLength(200, 'Der Betreff darf maximal 200 Zeichen lang sein.')
  ),
  body: pipe(
    string('Bitte einen Nachrichtentext eingeben.'),
    minLength(1, 'Die Nachricht darf nicht leer sein.'),
    maxLength(50_000, 'Die Nachricht darf maximal 50.000 Zeichen lang sein.')
  ),
  asHtml: optional(boolean()),
  attachments: array(attachmentSchema)
})

/**
 * Recipient-count preview for the broadcast composer. Returns the
 * total number of opted-in customers, how many of those have an
 * actual email address on file, and a short sample of names so the
 * user can sanity-check the audience before sending.
 *
 * @group integration
 * @module mailings
 */
export const previewBroadcastRecipientsRemote = query(async () => {
  requirePermission('mailings')
  const all = await listCustomersForBroadcast()
  const withEmail = all.filter((c) => !!c.email)
  const sampleNames = withEmail.slice(0, 5).map((c) => {
    const name = c.company || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    return name || (c.email ?? c.customerNumber)
  })
  return {
    totalOptIn: all.length,
    totalWithEmail: withEmail.length,
    sampleNames
  }
})

/**
 * Send a broadcast / newsletter to every opted-in customer with an
 * email address. Returns `{ sent, failed }` so the UI can show a
 * success/failure breakdown after the job completes.
 *
 * Single-flight: refreshes the recipient preview + the history list
 * before returning.
 *
 * @group integration
 * @module mailings
 */
export const sendBroadcastEmailRemote = command(
  broadcastSchema,
  async (input): Promise<BroadcastSendResult> => {
    requirePermission('mailings')
    const result = await sendBroadcastEmail(input)
    await Promise.all([
      previewBroadcastRecipientsRemote().refresh(),
      listBroadcastHistoryRemote().refresh()
    ])
    return result
  }
)

/**
 * Recent broadcast history. Returns the last 10 `mailing`-typed
 * `sent_messages` rows, newest first.
 *
 * Grouped purely by `sentAt` because broadcasts persist one row per
 * recipient — showing the most recent N gives the user a feel for
 * "what did we ship lately" without paginating.
 *
 * @group integration
 * @module mailings
 */
export const listBroadcastHistoryRemote = query(async () => {
  requirePermission('mailings')
  const rows = await db
    .select({
      id: sentMessages.id,
      sentAt: sentMessages.sentAt,
      subject: sentMessages.subject,
      recipientEmail: sentMessages.recipientEmail,
      recipientName: sentMessages.recipientName,
      status: sentMessages.status
    })
    .from(sentMessages)
    .where(eq(sentMessages.documentType, 'mailing'))
    .orderBy(desc(sentMessages.sentAt))
    .limit(10)
  return rows
})

/**
 * Total count of broadcast-typed sent rows. Kept tiny and separate so
 * the history card can show "X Versandvorgänge insgesamt" without
 * reading the full table. Currently unused by the UI but cheap to
 * keep alongside the history query.
 */
export const countBroadcastsRemote = query(async () => {
  requirePermission('mailings')
  const [row] = await db
    .select({ value: count() })
    .from(sentMessages)
    .where(
      and(
        eq(sentMessages.documentType, 'mailing'),
        eq(sentMessages.status, 'sent')
      )
    )
  return Number(row?.value ?? 0)
})
