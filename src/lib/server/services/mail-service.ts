/**
 * SMTP send pipeline: pull settings, render the matching mail
 * template, hand the result to nodemailer, and record the outcome
 * (success or failure) in `sent_messages`.
 *
 * Templates use `{platzhalter}` syntax. Unknown placeholders are
 * passed through untouched so a mistyped key in the template doesn't
 * silently empty out the message — easier to spot during review.
 *
 * `sendDocumentEmail` is the single entry point both
 * `sendInvoiceRemote` and `sendOfferRemote` go through. PDF
 * attachments are not wired in this iteration; the body carries the
 * full message text and the user can re-print the PDF on demand.
 */

import nodemailer, { type Transporter } from 'nodemailer'
import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  customers as customersTable,
  customerInquiries,
  items,
  itemPriceVersions,
  mailTemplates,
  sentMessages,
  smtpSettings,
  tirePriceVersions,
  tires,
  vehicleListings,
  vehicles,
  type Document,
  type Customer
} from '$lib/server/db/schema'
import { getOrRenderDocumentPdf } from '$lib/server/services/pdf-service'
import { listCustomersForBroadcast } from '$lib/server/services/customer-service'
import { getEffectiveLicensePlate } from '$lib/server/services/vehicle-service'

export type DocumentMailKind =
  | 'invoice'
  | 'offer'
  | 'cost_estimate'
  | 'order_confirmation'
  | 'reminder_1'
  | 'reminder_2'
  | 'reminder_3'
  | 'mailing'
  | 'tire_reminder'
  | 'appointment_confirmation'

export type MailContext = {
  document?: Document
  customer?: Pick<Customer, 'firstName' | 'lastName' | 'company' | 'salutation'>
  vehicle?: {
    licensePlate?: string | null
    make?: string | null
    model?: string | null
  }
  /** Pre-baked template variables that override anything derived above. */
  extra?: Record<string, string>
}

export type SendDocumentInput = {
  documentId: string | null
  documentType: DocumentMailKind
  to: { email: string; name?: string | null }
  context: MailContext
}

export type SendDocumentResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string }

const formatEur = (n: number | string | null | undefined): string => {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0)
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(v ?? 0)
}

const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Build the placeholder map. Keys mirror the German tokens used in
 * `seed-defaults.ts`. Anything missing falls back to an empty string.
 */
const buildVars = async (ctx: MailContext): Promise<Record<string, string>> => {
  const [company] = await db.select().from(companySettings).limit(1)
  const c = company ?? null

  const customer = ctx.customer
  const customerName = customer
    ? customer.company ||
      `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
    : ''
  const salutationLine = customer
    ? c?.salutationStyle === 'Du'
      ? `Hallo ${customer.firstName ?? customerName},`
      : customer.company
        ? `Sehr geehrte Damen und Herren,`
        : `Sehr geehrte/r ${customer.salutation ?? ''} ${customer.lastName ?? ''}`.trim() +
          ','
    : 'Sehr geehrte Damen und Herren,'

  const doc = ctx.document
  const vars: Record<string, string> = {
    firma: c?.companyName ?? '',
    firmaIban: c?.iban ?? '',
    firmaBic: c?.bic ?? '',
    firmaBank: c?.bankName ?? '',
    firmaTelefon: c?.phone ?? '',
    firmaMail: c?.email ?? '',
    kundeAnredeName: salutationLine,
    kundeName: customerName,
    kundeVorname: customer?.firstName ?? customerName,
    fahrzeugKennzeichen: ctx.vehicle?.licensePlate ?? '',
    fahrzeugTyp: [ctx.vehicle?.make, ctx.vehicle?.model]
      .filter(Boolean)
      .join(' '),
    rechnungNummer: doc?.type === 'invoice' ? doc.documentNumber : '',
    rechnungDatum: doc?.type === 'invoice' ? formatDate(doc.issueDate) : '',
    rechnungBetragBrutto:
      doc?.type === 'invoice' ? formatEur(doc.grossTotal) : '',
    rechnungOffenerBetrag:
      doc?.type === 'invoice' ? formatEur(doc.grossTotal) : '',
    fälligkeitsDatum: doc ? formatDate(doc.dueDate) : '',
    angebotNummer: doc && doc.type !== 'invoice' ? doc.documentNumber : '',
    angebotGültigBis:
      doc && doc.type !== 'invoice' ? formatDate(doc.dueDate) : '',
    ...(ctx.extra ?? {})
  }

  return vars
}

/**
 * Render `{key}` placeholders in a string against the given map.
 * Unknown keys pass through unchanged — a missing variable is loud,
 * not silent.
 */
const render = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{([^{}]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  )

/**
 * Best-effort plain-text fallback for an HTML body. Turns block-level
 * tags into newlines, strips the rest, and decodes the handful of
 * entities we emit. Good enough for the `text` alternative that
 * accompanies every HTML mail (so non-HTML clients still get readable
 * content) — not a full HTML renderer.
 */
const htmlToPlainText = (html: string): string =>
  html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * Broadcast opt-out footer (Abbestellen). The unsubscribe flow is a
 * mailto reply — the operator flips `wantsBroadcast` when a customer
 * answers with "Abbestellen"; the next send already filters them out
 * via `listCustomersForBroadcast()`. Both a plain-text and an HTML
 * variant are produced so the footer matches the body's format.
 */
const UNSUBSCRIBE_TEXT =
  '\n\n—\nKeine weiteren Informationen gewünscht? Antworten Sie auf diese ' +
  'E-Mail mit dem Betreff „Abbestellen".'

const UNSUBSCRIBE_HTML =
  '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px">' +
  '<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666;margin:0">' +
  'Keine weiteren Informationen gewünscht? Antworten Sie auf diese E-Mail mit dem ' +
  'Betreff „Abbestellen".</p>'

const buildTransport = async (): Promise<Transporter> => {
  const [s] = await db.select().from(smtpSettings).limit(1)
  if (!s || !s.host || !s.fromAddress) {
    throw new Error(
      'SMTP ist nicht konfiguriert. Bitte tragen Sie Host, Absender und Zugangsdaten in den Einstellungen ein.'
    )
  }
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure === 'TLS',
    requireTLS: s.secure === 'STARTTLS',
    auth: s.username
      ? { user: s.username, pass: s.password || undefined }
      : undefined
  })
}

/**
 * Look up a template by its key. The mail-templates table is seeded
 * with German defaults at first setup; users can override them in
 * /settings.
 */
const loadTemplate = async (
  key: DocumentMailKind
): Promise<{ subject: string; body: string }> => {
  const [row] = await db
    .select({ subject: mailTemplates.subject, body: mailTemplates.body })
    .from(mailTemplates)
    .where(eq(mailTemplates.key, key))
    .limit(1)
  if (!row) {
    throw new Error(`Mailvorlage „${key}" nicht gefunden.`)
  }
  return row
}

export const sendDocumentEmail = async (
  input: SendDocumentInput
): Promise<SendDocumentResult> => {
  const tpl = await loadTemplate(input.documentType)
  const vars = await buildVars(input.context)
  const subject = render(tpl.subject, vars)
  const body = render(tpl.body, vars)

  const [smtp] = await db.select().from(smtpSettings).limit(1)
  const fromAddress = smtp?.fromAddress ?? ''
  const fromName = smtp?.fromName ?? ''
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress
  const replyTo = smtp?.replyTo ?? undefined

  // PDF attachment: Document-typed mails (invoice / KV / Angebot / AB)
  // hängen ihre Belegs-PDF an. Reminder mails würden eigenes Rendering
  // brauchen — sind weiterhin body-only.
  const pdfAttachable: ReadonlyArray<DocumentMailKind> = [
    'invoice',
    'offer',
    'cost_estimate',
    'order_confirmation'
  ]
  let attachment: {
    filename: string
    content: Buffer
    contentType: string
  } | null = null
  if (input.documentId && pdfAttachable.includes(input.documentType)) {
    try {
      const pdf = await getOrRenderDocumentPdf(input.documentId)
      attachment = {
        filename: pdf.filename,
        content: Buffer.from(pdf.data),
        contentType: pdf.mime ?? 'application/pdf'
      }
    } catch {
      attachment = null
    }
  }

  // Insert the row first as `pending` so a crash mid-send doesn't lose
  // the audit trail. The status flips to `sent` or `failed` afterwards.
  const [pending] = await db
    .insert(sentMessages)
    .values({
      documentId: input.documentId,
      documentType: input.documentType,
      recipientEmail: input.to.email,
      recipientName: input.to.name ?? null,
      subject,
      bodyText: body,
      attachmentMeta: attachment
        ? [{ name: attachment.filename, size: attachment.content.length }]
        : [],
      status: 'pending'
    })
    .returning()

  try {
    const transport = await buildTransport()
    const info = await transport.sendMail({
      from,
      to: input.to.name
        ? `${input.to.name} <${input.to.email}>`
        : input.to.email,
      replyTo,
      subject,
      text: body,
      attachments: attachment ? [attachment] : undefined
    })

    await db
      .update(sentMessages)
      .set({ status: 'sent', smtpMessageId: info.messageId ?? null })
      .where(eq(sentMessages.id, pending.id))

    return { ok: true, messageId: info.messageId ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
    await db
      .update(sentMessages)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(sentMessages.id, pending.id))
    return { ok: false, error: message }
  }
}

/**
 * Generic file attachment payload accepted by the ad-hoc and broadcast
 * email paths. `base64Data` is the raw, header-less base64 string
 * (i.e. no `data:` prefix); the service converts it to a `Buffer`
 * before handing it to nodemailer.
 */
export type AdHocAttachment = {
  filename: string
  mime: string
  base64Data: string
}

/**
 * Decode a base64 string into a Buffer. Strips an optional `data:`
 * prefix so callers can pass either the full Data-URL the browser
 * emits or the bare base64 body.
 */
const decodeAttachment = (
  att: AdHocAttachment
): { filename: string; content: Buffer; contentType: string } => {
  const raw = att.base64Data.includes(',')
    ? att.base64Data.slice(att.base64Data.indexOf(',') + 1)
    : att.base64Data
  return {
    filename: att.filename,
    content: Buffer.from(raw, 'base64'),
    contentType: att.mime || 'application/octet-stream'
  }
}

export type AdHocCustomerEmailInput = {
  customerId: string
  subject: string
  body: string
  /** When true, `body` is HTML source — sent as `html` with a derived
   * plain-text fallback. When false/absent, `body` is plain text. */
  asHtml?: boolean
  attachments: AdHocAttachment[]
}

/**
 * Send a free-form email to a single customer. Re-uses the standard
 * SMTP transport and `sent_messages` audit trail (`documentType` is
 * fixed to `mailing` so the existing Sent-Messages page surfaces the
 * row under "Serienbrief / Mailing").
 *
 * Attachment bytes are passed in as base64 — the browser already has
 * them in that shape after `FileReader.readAsDataURL`, so we avoid an
 * extra round-trip.
 */
export const sendAdHocCustomerEmail = async (
  input: AdHocCustomerEmailInput
): Promise<SendDocumentResult> => {
  const [cust] = await db
    .select({
      id: customersTable.id,
      firstName: customersTable.firstName,
      lastName: customersTable.lastName,
      company: customersTable.company,
      email: customersTable.email
    })
    .from(customersTable)
    .where(eq(customersTable.id, input.customerId))
    .limit(1)
  if (!cust) {
    throw new Error('Kunde nicht gefunden.')
  }
  if (!cust.email) {
    throw new Error('Der Kunde hat keine hinterlegte E-Mail-Adresse.')
  }

  const recipientName =
    cust.company || `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim()

  const attachments = input.attachments.map(decodeAttachment)

  // HTML vs. plain text: when `asHtml`, the body is HTML source — send
  // it as `html` and derive a readable `text` fallback. The audit row
  // always stores the plain-text version.
  const htmlBody = input.asHtml ? input.body : undefined
  const textBody = input.asHtml ? htmlToPlainText(input.body) : input.body

  const [smtp] = await db.select().from(smtpSettings).limit(1)
  const fromAddress = smtp?.fromAddress ?? ''
  const fromName = smtp?.fromName ?? ''
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress
  const replyTo = smtp?.replyTo ?? undefined

  const [pending] = await db
    .insert(sentMessages)
    .values({
      documentId: null,
      documentType: 'mailing',
      recipientEmail: cust.email,
      recipientName: recipientName || null,
      subject: input.subject,
      bodyText: textBody,
      attachmentMeta: attachments.map((a) => ({
        name: a.filename,
        size: a.content.length
      })),
      status: 'pending'
    })
    .returning()

  try {
    const transport = await buildTransport()
    const info = await transport.sendMail({
      from,
      to: recipientName ? `${recipientName} <${cust.email}>` : cust.email,
      replyTo,
      subject: input.subject,
      text: textBody,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined
    })
    await db
      .update(sentMessages)
      .set({ status: 'sent', smtpMessageId: info.messageId ?? null })
      .where(eq(sentMessages.id, pending.id))
    return { ok: true, messageId: info.messageId ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
    await db
      .update(sentMessages)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(sentMessages.id, pending.id))
    return { ok: false, error: message }
  }
}

export type BroadcastEmailInput = {
  subject: string
  body: string
  /** When true, `body` is HTML source — sent as `html` with a derived
   * plain-text fallback. When false/absent, `body` is plain text. */
  asHtml?: boolean
  attachments: AdHocAttachment[]
}

export type BroadcastSendResult = {
  sent: number
  failed: Array<{ customerId: string; reason: string }>
}

/**
 * BCC batch size for broadcast sends. Small enough to keep individual
 * SMTP envelopes well within typical relay limits and to let one bad
 * address fail a small batch instead of the whole job.
 */
const BROADCAST_BCC_BATCH = 50

/**
 * Send a broadcast / newsletter to every customer that opted in.
 *
 * - Recipient list comes from `listCustomersForBroadcast()` — customers
 *   with `wantsBroadcast = true` and an `email` set.
 * - Addresses are placed in `bcc` (not `to`) so recipients never see
 *   each other.
 * - Sends are chunked into small bcc batches. A failure inside one
 *   batch is recorded per-customer and does NOT abort the remaining
 *   batches.
 * - One `sent_messages` row is persisted per customer (`documentType`
 *   = `mailing`) so the broadcast history surfaces individual delivery
 *   status, not a single aggregate row.
 */
export const sendBroadcastEmail = async (
  input: BroadcastEmailInput
): Promise<BroadcastSendResult> => {
  const recipients = await listCustomersForBroadcast()
  const targets = recipients.filter(
    (c): c is Customer & { email: string } => !!c.email
  )

  if (targets.length === 0) {
    return { sent: 0, failed: [] }
  }

  const attachments = input.attachments.map(decodeAttachment)

  const [smtp] = await db.select().from(smtpSettings).limit(1)
  const fromAddress = smtp?.fromAddress ?? ''
  const fromName = smtp?.fromName ?? ''
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress
  const replyTo = smtp?.replyTo ?? undefined

  // Append the Abbestellen (opt-out) footer and add a List-Unsubscribe
  // header pointing at a mailto so compliant clients surface a native
  // "unsubscribe" affordance. The reply lands at the company address
  // (falling back to the SMTP reply-to / from) where the operator can
  // flip `wantsBroadcast`.
  const [company] = await db.select().from(companySettings).limit(1)
  const unsubscribeAddress = company?.email || replyTo || fromAddress

  const htmlBody = input.asHtml ? `${input.body}${UNSUBSCRIBE_HTML}` : undefined
  const textBody = input.asHtml
    ? `${htmlToPlainText(input.body)}${UNSUBSCRIBE_TEXT}`
    : `${input.body}${UNSUBSCRIBE_TEXT}`

  const headers: Record<string, string> | undefined = unsubscribeAddress
    ? {
        'List-Unsubscribe': `<mailto:${unsubscribeAddress}?subject=Abbestellen>`
      }
    : undefined

  // Build the transport once and reuse it across batches — the
  // `buildTransport` helper throws a curated German error when SMTP
  // isn't set up, which propagates as-is.
  const transport = await buildTransport()

  const failed: Array<{ customerId: string; reason: string }> = []
  let sent = 0

  for (let i = 0; i < targets.length; i += BROADCAST_BCC_BATCH) {
    const batch = targets.slice(i, i + BROADCAST_BCC_BATCH)
    const bcc = batch.map((c) => c.email)

    // Persist one `pending` row per customer up front so a crash mid-
    // batch keeps the audit trail honest. The status flips below.
    const pendingIds: string[] = []
    for (const c of batch) {
      const recipientName =
        c.company || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
      const [row] = await db
        .insert(sentMessages)
        .values({
          documentId: null,
          documentType: 'mailing',
          recipientEmail: c.email,
          recipientName: recipientName || null,
          subject: input.subject,
          bodyText: textBody,
          attachmentMeta: attachments.map((a) => ({
            name: a.filename,
            size: a.content.length
          })),
          status: 'pending'
        })
        .returning({ id: sentMessages.id })
      pendingIds.push(row.id)
    }

    try {
      await transport.sendMail({
        from,
        to: fromAddress, // SMTP envelope needs a To; loop it back to ourselves
        bcc,
        replyTo,
        subject: input.subject,
        text: textBody,
        html: htmlBody,
        headers,
        attachments: attachments.length > 0 ? attachments : undefined
      })
      for (let j = 0; j < batch.length; j++) {
        await db
          .update(sentMessages)
          .set({ status: 'sent' })
          .where(eq(sentMessages.id, pendingIds[j]))
        sent += 1
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
      for (let j = 0; j < batch.length; j++) {
        await db
          .update(sentMessages)
          .set({ status: 'failed', errorMessage: message })
          .where(eq(sentMessages.id, pendingIds[j]))
        failed.push({ customerId: batch[j].id, reason: message })
      }
      // Continue with the next batch — one bad recipient set must not
      // block the rest of the broadcast.
    }
  }

  return { sent, failed }
}

/* ──────────────────────────────────────────────────────────────────────
 * Public-booking confirmation
 * ────────────────────────────────────────────────────────────────────── */

export type SendAppointmentConfirmationInput = {
  appointmentId: string
  customerEmail: string
  customerName?: string | null
  startsAt: Date
  durationMinutes: number
  serviceTitle?: string | null
  confirmationToken: string
}

/**
 * Format a UTC `Date` as a German calendar date (DD.MM.YYYY) in
 * Europe/Berlin. `Intl.DateTimeFormat` handles DST and locale rules so
 * we don't have to.
 */
const formatBerlinDate = (d: Date): string =>
  new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin'
  }).format(d)

/**
 * Format a UTC `Date` as HH:MM (24-hour) in Europe/Berlin. The mail
 * template adds the literal " Uhr" suffix, so we only emit the digits
 * here.
 */
const formatBerlinTime = (d: Date): string =>
  new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin'
  }).format(d)

/**
 * Send the post-booking confirmation mail. The booking endpoint calls
 * this best-effort — any failure (template missing, SMTP down, network
 * glitch) is logged and swallowed so the public-API still returns 200
 * to the customer. The `sent_messages` row records the outcome either
 * way so the operator can audit deliveries from the existing UI.
 *
 * Placeholders supplied (in addition to the standard `firma*` set):
 *   - `kundeVorname`     first name (or full name if no space)
 *   - `terminDatum`      DD.MM.YYYY in Europe/Berlin
 *   - `terminUhrzeit`    HH:MM in Europe/Berlin (the " Uhr" suffix is
 *                        baked into the seeded template)
 *   - `terminDauer`      duration in minutes (string)
 *   - `leistung`         "Leistung: <title>" line — empty string when
 *                        no service was selected, so the template line
 *                        cleanly collapses
 *   - `bestaetigungsCode` the confirmation UUID
 */
export const sendAppointmentConfirmation = async (
  input: SendAppointmentConfirmationInput
): Promise<SendDocumentResult> => {
  const trimmedName = (input.customerName ?? '').trim()
  const space = trimmedName.indexOf(' ')
  const firstName = space >= 0 ? trimmedName.slice(0, space) : trimmedName
  const customer = trimmedName
    ? {
        firstName: firstName || null,
        lastName: space >= 0 ? trimmedName.slice(space + 1) : null,
        company: null,
        salutation: null
      }
    : undefined

  const leistung = input.serviceTitle?.trim()
    ? `Leistung:    ${input.serviceTitle.trim()}\n`
    : ''

  const extra: Record<string, string> = {
    terminDatum: formatBerlinDate(input.startsAt),
    terminUhrzeit: formatBerlinTime(input.startsAt),
    terminDauer: String(input.durationMinutes),
    leistung,
    bestaetigungsCode: input.confirmationToken
  }

  let tpl: { subject: string; body: string }
  try {
    tpl = await loadTemplate('appointment_confirmation')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
    console.error('[appointment-confirmation] template load failed:', message)
    return { ok: false, error: message }
  }
  const vars = await buildVars({ customer, extra })
  const subject = render(tpl.subject, vars)
  const body = render(tpl.body, vars)

  const [smtp] = await db.select().from(smtpSettings).limit(1)
  const fromAddress = smtp?.fromAddress ?? ''
  const fromName = smtp?.fromName ?? ''
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress
  const replyTo = smtp?.replyTo ?? undefined

  const recipientName = trimmedName || null
  const [pending] = await db
    .insert(sentMessages)
    .values({
      documentId: null,
      documentType: 'appointment_confirmation',
      recipientEmail: input.customerEmail,
      recipientName,
      subject,
      bodyText: body,
      attachmentMeta: [],
      status: 'pending'
    })
    .returning()

  try {
    const transport = await buildTransport()
    const info = await transport.sendMail({
      from,
      to: recipientName
        ? `${recipientName} <${input.customerEmail}>`
        : input.customerEmail,
      replyTo,
      subject,
      text: body
    })
    await db
      .update(sentMessages)
      .set({ status: 'sent', smtpMessageId: info.messageId ?? null })
      .where(eq(sentMessages.id, pending.id))
    return { ok: true, messageId: info.messageId ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
    console.error(
      `[appointment-confirmation] send failed for ${input.appointmentId}:`,
      message
    )
    await db
      .update(sentMessages)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(sentMessages.id, pending.id))
    return { ok: false, error: message }
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Contact-form notification
 * ──────────────────────────────────────────────────────────────────── */

export type ContactNotificationInput = {
  inquiryId: string
  customerEmail: string
  customerName: string
  customerPhone?: string | null
  subject: string
  message: string
  referenceType?: 'used-car' | 'article' | 'tire' | 'general' | null
  referenceId?: string | null
}

/**
 * `customer_inquiries.notification_status` value space. `pending` is
 * the initial state set by the migration default; `sent` and `failed`
 * are written by the public-API endpoint and the admin retry endpoint
 * based on `sendContactNotification`'s return value.
 */
export type InquiryNotificationStatus = 'pending' | 'sent' | 'failed'

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR'
})

const formatTimestampDe = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/**
 * Resolve the referenced entity into a human-readable block plus an
 * internal URL. Returns `null` when the reference can't be resolved —
 * the caller logs a warning and sends the mail without the block so
 * the operator still receives the message.
 */
const resolveReference = async (
  referenceType: ContactNotificationInput['referenceType'],
  referenceId: string | null | undefined
): Promise<{ block: string[]; url: string | null } | null> => {
  if (!referenceType || !referenceId) return null
  if (referenceType === 'general') return null
  if (!isUuid(referenceId)) {
    console.warn(
      `[mail-service] contact notification: referenceId "${referenceId}" is not a UUID — skipping resolution.`
    )
    return null
  }

  if (referenceType === 'used-car') {
    const [v] = await db
      .select({
        id: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        firstRegistration: vehicles.firstRegistration
      })
      .from(vehicles)
      .where(eq(vehicles.id, referenceId))
      .limit(1)
    if (!v) {
      console.warn(
        `[mail-service] contact notification: vehicle ${referenceId} not found.`
      )
      return null
    }
    const plate = await getEffectiveLicensePlate(v.id)
    const [listing] = await db
      .select({ salesPriceGross: vehicleListings.salesPriceGross })
      .from(vehicleListings)
      .where(eq(vehicleListings.vehicleId, v.id))
      .limit(1)
    const block: string[] = []
    block.push(`Fahrzeug: ${[v.make, v.model].filter(Boolean).join(' ')}`)
    if (v.firstRegistration) {
      block.push(`Erstzulassung: ${v.firstRegistration}`)
    }
    if (plate?.licensePlate) {
      block.push(`Kennzeichen: ${plate.licensePlate}`)
    }
    if (listing?.salesPriceGross) {
      block.push(
        `Preis (brutto): ${EUR.format(Number(listing.salesPriceGross))}`
      )
    }
    return { block, url: `/vehicles/${v.id}` }
  }

  if (referenceType === 'tire') {
    const [t] = await db
      .select({
        id: tires.id,
        articleNumber: tires.articleNumber,
        brand: tires.brand,
        model: tires.model,
        width: tires.width,
        aspectRatio: tires.aspectRatio,
        diameterInch: tires.diameterInch,
        construction: tires.construction,
        season: tires.season
      })
      .from(tires)
      .where(eq(tires.id, referenceId))
      .limit(1)
    if (!t) {
      console.warn(
        `[mail-service] contact notification: tire ${referenceId} not found.`
      )
      return null
    }
    const [price] = await db
      .select({ unitPriceNet: tirePriceVersions.unitPriceNet })
      .from(tirePriceVersions)
      .where(
        and(
          eq(tirePriceVersions.tireId, t.id),
          lte(
            tirePriceVersions.validFrom,
            new Date().toISOString().slice(0, 10)
          )
        )
      )
      .orderBy(desc(tirePriceVersions.validFrom))
      .limit(1)
    const size = `${t.width}/${t.aspectRatio} ${t.construction}${t.diameterInch}`
    const block: string[] = []
    block.push(`Reifen: ${t.brand} ${t.model}`)
    block.push(`Größe: ${size}`)
    block.push(`Saison: ${t.season}`)
    block.push(`Artikel-Nr.: ${t.articleNumber}`)
    if (price?.unitPriceNet) {
      block.push(`Preis (netto): ${EUR.format(Number(price.unitPriceNet))}`)
    }
    return { block, url: `/tires/${t.id}` }
  }

  // `article` resolves through the `items` table (services / labour).
  if (referenceType === 'article') {
    const [it] = await db
      .select({
        id: items.id,
        articleNumber: items.articleNumber,
        description: items.description,
        kind: items.kind
      })
      .from(items)
      .where(eq(items.id, referenceId))
      .limit(1)
    if (!it) {
      console.warn(
        `[mail-service] contact notification: item ${referenceId} not found.`
      )
      return null
    }
    const [price] = await db
      .select({ unitPriceNet: itemPriceVersions.unitPriceNet })
      .from(itemPriceVersions)
      .where(
        and(
          eq(itemPriceVersions.itemId, it.id),
          lte(
            itemPriceVersions.validFrom,
            new Date().toISOString().slice(0, 10)
          )
        )
      )
      .orderBy(desc(itemPriceVersions.validFrom))
      .limit(1)
    const block: string[] = []
    block.push(`Artikel-Nr.: ${it.articleNumber}`)
    block.push(`Beschreibung: ${it.description}`)
    if (price?.unitPriceNet) {
      block.push(`Preis (netto): ${EUR.format(Number(price.unitPriceNet))}`)
    }
    return { block, url: `/items/${it.id}` }
  }

  return null
}

/**
 * Render the workshop-internal notification body for an inquiry.
 *
 * Sections: Anfrage von / Betreff / Nachricht / optional "Bezogen
 * auf" with the resolved entity + internal URL / Anfrage-ID /
 * Eingegangen am.
 */
const buildContactBody = (
  input: ContactNotificationInput,
  receivedAt: Date,
  resolved: { block: string[]; url: string | null } | null
): string => {
  const lines: string[] = []
  lines.push('Eine neue Anfrage über das Kontaktformular ist eingegangen.')
  lines.push('')
  lines.push('Anfrage von:')
  lines.push(`  Name:    ${input.customerName}`)
  lines.push(`  E-Mail:  ${input.customerEmail}`)
  if (input.customerPhone) {
    lines.push(`  Telefon: ${input.customerPhone}`)
  }
  lines.push('')
  lines.push(`Betreff: ${input.subject}`)
  lines.push('')
  lines.push('Nachricht:')
  for (const messageLine of input.message.split('\n')) {
    lines.push(`  ${messageLine}`)
  }
  if (resolved && resolved.block.length > 0) {
    lines.push('')
    lines.push('Bezogen auf:')
    for (const b of resolved.block) {
      lines.push(`  ${b}`)
    }
    if (resolved.url) {
      lines.push(`  Detailseite: ${resolved.url}`)
    }
  }
  lines.push('')
  lines.push(`Anfrage-ID:     ${input.inquiryId}`)
  lines.push(`Eingegangen am: ${formatTimestampDe(receivedAt)}`)
  return lines.join('\n')
}

/**
 * Send a workshop-internal notification mail for an inbound public
 * contact-form inquiry. The recipient is `companySettings.email`;
 * the customer's address is set as `Reply-To` so the operator can
 * hit Reply and land in a real conversation.
 *
 * Returns the same `SendDocumentResult` shape every other mail-
 * service entry point uses so callers can switch on `ok`.
 *
 * Failures are logged in `sent_messages` (`documentType='mailing'`)
 * with `status='failed'` and the underlying error, mirroring the
 * audit behaviour of `sendDocumentEmail` and `sendAdHocCustomerEmail`.
 */
export const sendContactNotification = async (
  input: ContactNotificationInput
): Promise<SendDocumentResult> => {
  const [company] = await db.select().from(companySettings).limit(1)
  const destination = company?.email ?? ''
  if (!destination) {
    const message =
      'Keine Empfänger-Adresse hinterlegt — bitte „E-Mail" in den Firmen-Einstellungen ausfüllen.'
    return { ok: false, error: message }
  }

  const resolved = await resolveReference(
    input.referenceType ?? null,
    input.referenceId ?? null
  )

  const receivedAt = new Date()
  const subjectRaw = `[Anfrage] ${input.subject}`
  const subject = subjectRaw.slice(0, 200)
  const body = buildContactBody(input, receivedAt, resolved)

  const [smtp] = await db.select().from(smtpSettings).limit(1)
  const fromAddress = smtp?.fromAddress ?? ''
  const fromName = smtp?.fromName ?? ''
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress

  const [pending] = await db
    .insert(sentMessages)
    .values({
      documentId: null,
      documentType: 'mailing',
      recipientEmail: destination,
      recipientName: company?.companyName ?? null,
      subject,
      bodyText: body,
      status: 'pending'
    })
    .returning()

  try {
    const transport = await buildTransport()
    const info = await transport.sendMail({
      from,
      to: destination,
      replyTo: input.customerEmail,
      subject,
      text: body
    })
    await db
      .update(sentMessages)
      .set({ status: 'sent', smtpMessageId: info.messageId ?? null })
      .where(eq(sentMessages.id, pending.id))
    return { ok: true, messageId: info.messageId ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler.'
    await db
      .update(sentMessages)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(sentMessages.id, pending.id))
    return { ok: false, error: message }
  }
}

/**
 * Flip the notification-tracking columns on `customer_inquiries`
 * after `sendContactNotification` runs. Keeps the contact endpoint
 * and the admin retry endpoint out of schema details.
 */
export const recordInquiryNotificationResult = async (
  inquiryId: string,
  result: SendDocumentResult
): Promise<void> => {
  if (result.ok) {
    await db
      .update(customerInquiries)
      .set({
        notificationStatus: 'sent',
        notificationSentAt: new Date(),
        notificationError: null
      })
      .where(eq(customerInquiries.id, inquiryId))
  } else {
    await db
      .update(customerInquiries)
      .set({ notificationStatus: 'failed', notificationError: result.error })
      .where(eq(customerInquiries.id, inquiryId))
  }
}
