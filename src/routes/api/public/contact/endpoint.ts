/**
 * Handler implementation for `POST /api/public/contact`.
 *
 * Persists a free-form inquiry submitted via the public website. The
 * request body carries the visitor's contact data plus an optional
 * reference back to whatever page they were on (a used-car listing,
 * a tire detail, an article). The persisted row is the source of
 * truth — a transient SMTP failure must not lose the inquiry.
 *
 * After the row lands we fire an internal notification mail through
 * the canonical `mail-service.sendContactNotification` and flip
 * `customer_inquiries.notification_status` to `sent` or `failed`
 * accordingly. The API still returns 200 so the visitor never sees
 * a backend hiccup; ops can spot the failed deliveries on the
 * `/settings/inquiries` page and retry from there.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import {
  maxLength,
  minLength,
  object,
  optional,
  parse,
  picklist,
  pipe,
  string,
  trim,
  ValiError
} from 'valibot'
import { db } from '$lib/server/db/client'
import { customerInquiries } from '$lib/server/db/schema'
import { fail, ok } from '$lib/server/public-api'
import {
  emailSchema,
  longTextSchema,
  nameSchema,
  phoneSchema,
  subjectSchema
} from '$lib/server/db/validation'
import {
  recordInquiryNotificationResult,
  sendContactNotification
} from '$lib/server/services/mail-service'

const referenceIdSchema = pipe(
  string(),
  trim(),
  minLength(1, 'referenceId may not be empty.'),
  maxLength(64, 'referenceId is too long.')
)

const referenceTypeSchema = picklist(
  ['used-car', 'article', 'tire', 'general'],
  'referenceType must be one of "used-car", "article", "tire", "general".'
)

const bodySchema = object({
  customerEmail: emailSchema,
  customerName: nameSchema,
  customerPhone: optional(phoneSchema),
  subject: subjectSchema,
  message: longTextSchema,
  referenceId: optional(referenceIdSchema),
  referenceType: optional(referenceTypeSchema)
})

type ContactInput = {
  customerEmail: string
  customerName: string
  customerPhone?: string
  subject: string
  message: string
  referenceId?: string
  referenceType?: 'used-car' | 'article' | 'tire' | 'general'
}

export async function handleContactInquiry(
  event: RequestEvent
): Promise<Response> {
  let raw: unknown
  try {
    raw = await event.request.json()
  } catch {
    fail(400, 'Request body must be valid JSON.')
  }

  let input: ContactInput
  try {
    input = parse(bodySchema, raw) as ContactInput
  } catch (err) {
    if (err instanceof ValiError) {
      const first = err.issues[0]
      const path =
        first.path?.map((p: { key: unknown }) => String(p.key)).join('.') ??
        'body'
      fail(400, `Invalid "${path}": ${first.message}`)
    }
    throw err
  }

  // Persist the inquiry FIRST — this row is the durable source of
  // truth. Even if the notification mail fails (SMTP down, template
  // missing, …) we keep the customer's submission.
  const [row] = await db
    .insert(customerInquiries)
    .values({
      customerId: null,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      subject: input.subject,
      message: input.message,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null
    })
    .returning({
      id: customerInquiries.id,
      createdAt: customerInquiries.createdAt
    })

  // Best-effort internal notification — re-uses the canonical SMTP
  // pipeline so we get sent-messages logging + a single config source.
  // Any failure is recorded on the row so ops can retry from
  // `/settings/inquiries`.
  try {
    const result = await sendContactNotification({
      inquiryId: row.id,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      subject: input.subject,
      message: input.message,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null
    })
    await recordInquiryNotificationResult(row.id, result)
    if (!result.ok) {
      console.warn(
        `[public-api/contact] notification mail failed for inquiry ${row.id}: ${result.error}`
      )
    }
  } catch (err) {
    // `sendContactNotification` itself shouldn't throw — it returns
    // {ok:false,...} — but defend against unexpected runtime errors
    // so the customer always gets a 200.
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.'
    console.warn(
      `[public-api/contact] notification mail threw for inquiry ${row.id}:`,
      message
    )
    await recordInquiryNotificationResult(row.id, { ok: false, error: message })
  }

  return ok({ inquiryId: row.id, receivedAt: row.createdAt.toISOString() })
}
