/**
 * SMTP send pipeline: pull settings, decrypt the AES-GCM-encrypted
 * password, render the matching mail template, hand the result to
 * nodemailer, and record the outcome (success or failure) in
 * `sent_messages`.
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
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  mailTemplates,
  sentMessages,
  smtpSettings,
  type Document,
  type Customer
} from '$lib/server/db/schema'
import { decrypt } from '$lib/server/utils/crypto'
import {
  getOrRenderDocumentPdf,
  getOrRenderPayslipPdf
} from '$lib/server/services/pdf-service'

export type DocumentMailKind =
  | 'invoice'
  | 'offer'
  | 'cost_estimate'
  | 'order_confirmation'
  | 'reminder_1'
  | 'reminder_2'
  | 'reminder_3'
  | 'mailing'
  | 'payslip'

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

const buildTransport = async (): Promise<Transporter> => {
  const [s] = await db.select().from(smtpSettings).limit(1)
  if (!s || !s.host || !s.fromAddress) {
    throw new Error(
      'SMTP ist nicht konfiguriert. Bitte tragen Sie Host, Absender und Zugangsdaten in den Einstellungen ein.'
    )
  }
  const password = decrypt(s.passwordEncrypted)
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure === 'TLS',
    requireTLS: s.secure === 'STARTTLS',
    auth: s.username
      ? { user: s.username, pass: password || undefined }
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
  // hängen ihre Belegs-PDF an, Lohnzettel ihre Lohn-PDF.
  // Reminder mails würden eigenes Rendering brauchen — sind weiterhin
  // body-only.
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
  } else if (input.documentId && input.documentType === 'payslip') {
    try {
      const pdf = await getOrRenderPayslipPdf(input.documentId)
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
