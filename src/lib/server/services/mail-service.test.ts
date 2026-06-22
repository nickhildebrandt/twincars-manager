/**
 * Integration tests for the mail service: template loading + variable
 * substitution, attachment wiring, and SMTP-settings handling. Network
 * is mocked at the nodemailer boundary — no real SMTP traffic.
 *
 * @group integration
 * @module mail-service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// `vi.mock` factories are hoisted above all top-level statements, so
// shared spy refs have to live inside `vi.hoisted(...)` to be available
// to the factory at hoist time.
const { sendMailMock, createTransportMock, getOrRenderDocumentPdfMock } =
  vi.hoisted(() => {
    // `any` keeps the call-arg tuple permissive — we read off fields like
    // `opts.host`, `opts.attachments[0].filename` etc. without juggling
    // nodemailer's deep types in tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendMailMock = vi.fn<(opts: any) => Promise<any>>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createTransportMock = vi.fn<(opts: any) => any>(() => ({
      sendMail: sendMailMock
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getOrRenderDocumentPdfMock = vi.fn<(id: string) => Promise<any>>()
    return { sendMailMock, createTransportMock, getOrRenderDocumentPdfMock }
  })

// nodemailer is used as a default import inside mail-service:
//   import nodemailer, { type Transporter } from 'nodemailer'
// We mirror that shape and capture sendMail invocations.
vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock }
}))

// PDF attachment helpers — stubbed so we can both feed bytes back and
// simulate failures without pulling pdf-lib into the test.
vi.mock('$lib/server/services/pdf-service', () => ({
  getOrRenderDocumentPdf: getOrRenderDocumentPdfMock
}))

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  customers,
  customerInquiries,
  itemPriceVersions,
  items,
  mailTemplates,
  sentMessages,
  smtpSettings,
  tirePriceVersions,
  tires,
  vehicleListings,
  vehicles
} from '$lib/server/db/schema'
import {
  recordInquiryNotificationResult,
  sendAdHocCustomerEmail,
  sendAppointmentConfirmation,
  sendBroadcastEmail,
  sendContactNotification,
  sendDocumentEmail
} from './mail-service'
import { documents } from '$lib/server/db/schema'
import type { Document } from '$lib/server/db/schema'

let docCounter = 0
const seedDocument = async (type: string = 'invoice'): Promise<string> => {
  docCounter += 1
  const [row] = await db
    .insert(documents)
    .values({
      documentNumber: `TEST-${Date.now()}-${docCounter}`,
      type,
      issueDate: '2026-05-01'
    })
    .returning({ id: documents.id })
  return row.id
}

const seedSmtp = async (
  overrides: Partial<typeof smtpSettings.$inferInsert> = {}
) => {
  await db
    .insert(smtpSettings)
    .values({
      host: 'smtp.example.com',
      port: 587,
      secure: 'STARTTLS',
      username: 'user@example.com',
      password: 'plain-password',
      fromAddress: 'rechnung@example.com',
      fromName: 'TwinCars',
      replyTo: 'antwort@example.com',
      verified: true,
      ...overrides
    })
}

const seedTemplate = async (
  key: string,
  subject: string,
  body: string
): Promise<void> => {
  await db.insert(mailTemplates).values({ key, subject, body })
}

const seedCompany = async (
  overrides: Partial<typeof companySettings.$inferInsert> = {}
): Promise<void> => {
  await db
    .insert(companySettings)
    .values({
      companyName: 'TwinCars GmbH',
      iban: 'DE00 0000 0000 0000 0000 00',
      bic: 'BANKDEFFXXX',
      bankName: 'Beispielbank',
      phone: '030/123',
      email: 'kontakt@example.com',
      ...overrides
    })
}

const baseDoc = (overrides: Partial<Document> = {}): Document =>
  ({
    id: '11111111-1111-1111-1111-111111111111',
    documentNumber: 'RE-2026-0001',
    legacyDocumentNumber: null,
    type: 'invoice',
    status: 'sent',
    customerId: null,
    vehicleId: null,
    issueDate: '2026-05-01',
    serviceDate: '2026-05-01',
    dueDate: '2026-05-15',
    paymentMethod: 'Überweisung',
    taxRate: '19.00',
    netTotal: '100.00',
    taxTotal: '19.00',
    grossTotal: '119.00',
    discountTotal: '0.00',
    header: null,
    footer: null,
    notes: null,
    convertedToInvoiceId: null,
    reminderLevel: 0,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides
  }) as Document

describe('mail-service', () => {
  beforeEach(async () => {
    await db.delete(sentMessages)
    await db.delete(mailTemplates)
    await db.delete(smtpSettings)
    await db.delete(customerInquiries)
    await db.delete(tirePriceVersions)
    await db.delete(tires)
    await db.delete(itemPriceVersions)
    await db.delete(items)
    await db.delete(vehicleListings)
    await db.delete(vehicles)
    await db.delete(companySettings)
    await db.delete(documents)
    await db.delete(customers)
    sendMailMock.mockReset()
    sendMailMock.mockResolvedValue({ messageId: '<test-id>' })
    createTransportMock.mockClear()
    getOrRenderDocumentPdfMock.mockReset()
  })

  describe('template loading & rendering', () => {
    it('renders subject + body placeholders and records the send', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate(
        'invoice',
        'Rechnung {rechnungNummer} von {firma}',
        '{kundeAnredeName}\n\nIhre Rechnung über {rechnungBetragBrutto} ist fällig am {fälligkeitsDatum}.'
      )

      const result = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'kunde@example.com', name: 'Max Mustermann' },
        context: {
          document: baseDoc(),
          customer: {
            firstName: 'Max',
            lastName: 'Mustermann',
            company: null,
            salutation: 'Herr'
          }
        }
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.messageId).toBe('<test-id>')

      expect(sendMailMock).toHaveBeenCalledTimes(1)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.subject).toBe('Rechnung RE-2026-0001 von TwinCars GmbH')
      expect(call.text).toContain('Sehr geehrte/r Herr Mustermann,')
      expect(call.text).toContain('15.05.2026')
      // Currency format follows Intl de-DE rules.
      expect(call.text).toMatch(/119,00\s?€/)
      expect(call.to).toBe('Max Mustermann <kunde@example.com>')

      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('sent')
      expect(recorded.smtpMessageId).toBe('<test-id>')
      expect(recorded.subject).toBe('Rechnung RE-2026-0001 von TwinCars GmbH')
    })

    it('leaves unknown placeholders untouched so typos stay visible', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('offer', 'Hallo {unbekannterKey}', 'Body')
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'offer',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(true)
      expect(sendMailMock.mock.calls[0][0].subject).toBe(
        'Hallo {unbekannterKey}'
      )
    })

    it('honours the "Du" salutation style', async () => {
      await seedSmtp()
      await seedCompany({ salutationStyle: 'Du' })
      await seedTemplate('invoice', 'Hi', '{kundeAnredeName}')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {
          customer: {
            firstName: 'Anna',
            lastName: 'Beispiel',
            company: null,
            salutation: 'Frau'
          }
        }
      })
      expect(sendMailMock.mock.calls[0][0].text).toBe('Hallo Anna,')
    })

    it('greets companies with "Sehr geehrte Damen und Herren"', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'Hi', '{kundeAnredeName}')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {
          customer: {
            firstName: null,
            lastName: null,
            company: 'Acme GmbH',
            salutation: null
          }
        }
      })
      expect(sendMailMock.mock.calls[0][0].text).toBe(
        'Sehr geehrte Damen und Herren,'
      )
    })

    it('lets `extra` overrides win over derived variables', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', '{firma}', 'Body')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: { extra: { firma: 'Override AG' } }
      })
      expect(sendMailMock.mock.calls[0][0].subject).toBe('Override AG')
    })

    it('throws a German error when the template is missing', async () => {
      await seedSmtp()
      await seedCompany()
      // Note: no mailTemplates row → loadTemplate must reject.
      await expect(
        sendDocumentEmail({
          documentId: null,
          documentType: 'invoice',
          to: { email: 'k@example.com' },
          context: {}
        })
      ).rejects.toThrow(/Mailvorlage/)
    })
  })

  describe('SMTP settings', () => {
    it('produces a friendly German error when SMTP is unset', async () => {
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toMatch(/SMTP ist nicht konfiguriert/)
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('failed')
      expect(recorded.errorMessage).toMatch(/SMTP ist nicht konfiguriert/)
    })

    it('also fails friendly when host/fromAddress are blank strings', async () => {
      await seedCompany()
      await seedSmtp({ host: '', fromAddress: '' })
      await seedTemplate('invoice', 'S', 'B')
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toMatch(/SMTP ist nicht konfiguriert/)
    })

    it('passes the stored SMTP password verbatim to nodemailer', async () => {
      await seedSmtp({ password: 'secret-pass' })
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(createTransportMock).toHaveBeenCalledTimes(1)
      const opts = createTransportMock.mock.calls[0][0]
      expect(opts.host).toBe('smtp.example.com')
      expect(opts.port).toBe(587)
      expect(opts.secure).toBe(false)
      expect(opts.requireTLS).toBe(true)
      expect(opts.auth).toEqual({
        user: 'user@example.com',
        pass: 'secret-pass'
      })
    })

    it('uses secure=true when STMP secure setting is TLS', async () => {
      await seedSmtp({ secure: 'TLS', port: 465 })
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      const opts = createTransportMock.mock.calls[0][0]
      expect(opts.secure).toBe(true)
      expect(opts.requireTLS).toBe(false)
    })

    it('skips auth when no SMTP username is configured', async () => {
      await seedSmtp({ username: '' })
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      const opts = createTransportMock.mock.calls[0][0]
      expect(opts.auth).toBeUndefined()
    })

    it('builds the From header from name + address when both are set', async () => {
      await seedSmtp({ fromName: 'TwinCars Service' })
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      const opts = sendMailMock.mock.calls[0][0]
      expect(opts.from).toBe('TwinCars Service <rechnung@example.com>')
      expect(opts.replyTo).toBe('antwort@example.com')
    })

    it('falls back to bare from address when no fromName is set', async () => {
      await seedSmtp({ fromName: '' })
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(sendMailMock.mock.calls[0][0].from).toBe('rechnung@example.com')
    })
  })

  describe('PDF attachments', () => {
    it('attaches the rendered invoice PDF for document-typed mails', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      const docId = await seedDocument('invoice')
      getOrRenderDocumentPdfMock.mockResolvedValue({
        filename: 'RE-2026-0001.pdf',
        data: new Uint8Array([1, 2, 3, 4]),
        mime: 'application/pdf'
      })
      await sendDocumentEmail({
        documentId: docId,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(getOrRenderDocumentPdfMock).toHaveBeenCalledWith(docId)
      const opts = sendMailMock.mock.calls[0][0]
      expect(opts.attachments).toHaveLength(1)
      expect(opts.attachments[0].filename).toBe('RE-2026-0001.pdf')
      expect(opts.attachments[0].content).toBeInstanceOf(Buffer)
      expect(opts.attachments[0].content.length).toBe(4)
      expect(opts.attachments[0].contentType).toBe('application/pdf')

      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.attachmentMeta).toEqual([
        { name: 'RE-2026-0001.pdf', size: 4 }
      ])
    })

    it('sends without attachment for reminder mails', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('reminder_1', 'Zahlungserinnerung', 'Body')
      const docId = await seedDocument('invoice')
      await sendDocumentEmail({
        documentId: docId,
        documentType: 'reminder_1',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(getOrRenderDocumentPdfMock).not.toHaveBeenCalled()
      expect(sendMailMock.mock.calls[0][0].attachments).toBeUndefined()
    })

    it('silently drops the attachment when PDF rendering fails', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      const docId = await seedDocument('invoice')
      getOrRenderDocumentPdfMock.mockRejectedValue(new Error('boom'))
      const res = await sendDocumentEmail({
        documentId: docId,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(true)
      const opts = sendMailMock.mock.calls[0][0]
      expect(opts.attachments).toBeUndefined()
    })
  })

  describe('failure path', () => {
    it('records failed sends with the underlying error message', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      sendMailMock.mockRejectedValueOnce(new Error('Connection refused'))
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBe('Connection refused')
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('failed')
      expect(recorded.errorMessage).toBe('Connection refused')
    })

    it('reports "Unbekannter Fehler" for non-Error rejection values', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      sendMailMock.mockRejectedValueOnce('plain string')
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBe('Unbekannter Fehler.')
    })

    it('persists the pending row before attempting to send', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      sendMailMock.mockImplementationOnce(async () => {
        // At the moment of the actual send, a pending audit row must
        // already exist. The status flips afterwards.
        const rows = await db
          .select()
          .from(sentMessages)
          .where(eq(sentMessages.recipientEmail, 'k@example.com'))
        expect(rows).toHaveLength(1)
        expect(rows[0].status).toBe('pending')
        return { messageId: '<after>' }
      })
      const res = await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'k@example.com' },
        context: {}
      })
      expect(res.ok).toBe(true)
    })
  })

  describe('recipient header', () => {
    it('uses bare email when no name is provided', async () => {
      await seedSmtp()
      await seedCompany()
      await seedTemplate('invoice', 'S', 'B')
      await sendDocumentEmail({
        documentId: null,
        documentType: 'invoice',
        to: { email: 'naked@example.com' },
        context: {}
      })
      expect(sendMailMock.mock.calls[0][0].to).toBe('naked@example.com')
    })
  })

  /* ──────────────────────────────────────────────────────────────────────
   * Ad-hoc customer email
   * ──────────────────────────────────────────────────────────────────── */

  describe('sendAdHocCustomerEmail', () => {
    const seedCustomer = async (
      overrides: Partial<typeof customers.$inferInsert> = {}
    ): Promise<string> => {
      const [row] = await db
        .insert(customers)
        .values({
          customerNumber: `KU-${Date.now()}`,
          firstName: 'Max',
          lastName: 'Mustermann',
          email: 'max@example.com',
          ...overrides
        })
        .returning({ id: customers.id })
      return row.id
    }

    it('sends a free-form mail with attachments and records it', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer()

      const res = await sendAdHocCustomerEmail({
        customerId,
        subject: 'Hallo',
        body: 'Bitte sehen Sie den Anhang.',
        attachments: [
          {
            filename: 'preisliste.pdf',
            mime: 'application/pdf',
            base64Data: Buffer.from('hello').toString('base64')
          }
        ]
      })

      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(sendMailMock).toHaveBeenCalledTimes(1)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.subject).toBe('Hallo')
      expect(call.text).toBe('Bitte sehen Sie den Anhang.')
      expect(call.to).toBe('Max Mustermann <max@example.com>')
      expect(call.attachments).toHaveLength(1)
      expect(call.attachments[0].filename).toBe('preisliste.pdf')
      expect(call.attachments[0].contentType).toBe('application/pdf')
      expect(call.attachments[0].content).toBeInstanceOf(Buffer)
      expect(call.attachments[0].content.toString()).toBe('hello')

      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('sent')
      expect(recorded.documentType).toBe('mailing')
      expect(recorded.recipientEmail).toBe('max@example.com')
      expect(recorded.attachmentMeta).toEqual([
        { name: 'preisliste.pdf', size: 5 }
      ])
    })

    it('sends without attachments when none are provided', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer()

      const res = await sendAdHocCustomerEmail({
        customerId,
        subject: 'Kein Anhang',
        body: 'Nur Text.',
        attachments: []
      })
      expect(res.ok).toBe(true)
      expect(sendMailMock.mock.calls[0][0].attachments).toBeUndefined()
    })

    it('sends HTML with a derived plain-text fallback when asHtml=true', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer()

      const res = await sendAdHocCustomerEmail({
        customerId,
        subject: 'HTML',
        body: '<p>Hallo <strong>Max</strong></p>',
        asHtml: true,
        attachments: []
      })
      expect(res.ok).toBe(true)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.html).toBe('<p>Hallo <strong>Max</strong></p>')
      // Fallback strips tags so non-HTML clients still get readable text.
      expect(call.text).toBe('Hallo Max')
      // The audit row stores the plain-text variant, not the HTML source.
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.bodyText).toBe('Hallo Max')
    })

    it('omits html and keeps plain text when asHtml is absent', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer()
      await sendAdHocCustomerEmail({
        customerId,
        subject: 'Plain',
        body: 'Nur Text.',
        attachments: []
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.html).toBeUndefined()
      expect(call.text).toBe('Nur Text.')
    })

    it('uses the company name as recipient when set', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer({
        firstName: null,
        lastName: null,
        company: 'Acme GmbH'
      })
      await sendAdHocCustomerEmail({
        customerId,
        subject: 'Hi',
        body: 'Body',
        attachments: []
      })
      expect(sendMailMock.mock.calls[0][0].to).toBe(
        'Acme GmbH <max@example.com>'
      )
    })

    it('throws when the customer does not exist', async () => {
      await seedSmtp()
      await seedCompany()
      await expect(
        sendAdHocCustomerEmail({
          customerId: '00000000-0000-0000-0000-000000000000',
          subject: 'x',
          body: 'y',
          attachments: []
        })
      ).rejects.toThrow(/Kunde/)
    })

    it('throws when the customer has no email address', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer({ email: null })
      await expect(
        sendAdHocCustomerEmail({
          customerId,
          subject: 'x',
          body: 'y',
          attachments: []
        })
      ).rejects.toThrow(/E-Mail-Adresse/)
    })

    it('refuses when SMTP is unconfigured and records the failure', async () => {
      // No SMTP seeded — the transport build should reject with the
      // curated German message and the audit row should land as
      // `failed`.
      await seedCompany()
      const customerId = await seedCustomer()
      const res = await sendAdHocCustomerEmail({
        customerId,
        subject: 'Hi',
        body: 'Body',
        attachments: []
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toMatch(/SMTP ist nicht konfiguriert/)
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('failed')
      expect(recorded.errorMessage).toMatch(/SMTP ist nicht konfiguriert/)
    })

    it('accepts data-URL-prefixed base64 attachments', async () => {
      await seedSmtp()
      await seedCompany()
      const customerId = await seedCustomer()
      const dataUrl = `data:application/pdf;base64,${Buffer.from('xy').toString('base64')}`
      await sendAdHocCustomerEmail({
        customerId,
        subject: 'Hi',
        body: 'Body',
        attachments: [
          { filename: 'a.pdf', mime: 'application/pdf', base64Data: dataUrl }
        ]
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.attachments[0].content.toString()).toBe('xy')
    })
  })

  /* ──────────────────────────────────────────────────────────────────────
   * Broadcast / newsletter
   * ──────────────────────────────────────────────────────────────────── */

  describe('sendBroadcastEmail', () => {
    const seedOptIn = async (
      email: string,
      overrides: Partial<typeof customers.$inferInsert> = {}
    ): Promise<string> => {
      const [row] = await db
        .insert(customers)
        .values({
          customerNumber: `KU-${Math.random().toString(36).slice(2, 8)}`,
          firstName: 'Anna',
          lastName: 'Empfänger',
          email,
          wantsBroadcast: true,
          ...overrides
        })
        .returning({ id: customers.id })
      return row.id
    }

    it('returns sent=0 when no opted-in customers exist', async () => {
      await seedSmtp()
      await seedCompany()
      const res = await sendBroadcastEmail({
        subject: 'Frühling',
        body: 'Hallo!',
        attachments: []
      })
      expect(res).toEqual({ sent: 0, failed: [] })
      expect(sendMailMock).not.toHaveBeenCalled()
    })

    it('skips opted-in customers without email address', async () => {
      await seedSmtp()
      await seedCompany()
      await seedOptIn('a@example.com')
      await db
        .insert(customers)
        .values({
          customerNumber: 'KU-NOEMAIL',
          firstName: 'Ohne',
          lastName: 'Mail',
          email: null,
          wantsBroadcast: true
        })
      const res = await sendBroadcastEmail({
        subject: 'S',
        body: 'B',
        attachments: []
      })
      expect(res.sent).toBe(1)
      // Only one row in sent_messages — the no-email customer is never
      // attempted.
      const rows = await db.select().from(sentMessages)
      expect(rows).toHaveLength(1)
      expect(rows[0].recipientEmail).toBe('a@example.com')
    })

    it('sends every recipient via bcc (never to)', async () => {
      await seedSmtp()
      await seedCompany()
      await seedOptIn('one@example.com')
      await seedOptIn('two@example.com')
      const res = await sendBroadcastEmail({
        subject: 'Newsletter',
        body: 'Body',
        attachments: []
      })
      expect(res.sent).toBe(2)
      expect(res.failed).toEqual([])
      expect(sendMailMock).toHaveBeenCalledTimes(1)
      const call = sendMailMock.mock.calls[0][0]
      // `to` is the loopback to ourselves, NEVER a customer email.
      expect(call.to).toBe('rechnung@example.com')
      expect(call.bcc).toEqual(['one@example.com', 'two@example.com'])
    })

    it('chunks sends into bcc batches of 50', async () => {
      await seedSmtp()
      await seedCompany()
      // Seed 60 opted-in customers => two batches of 50 + 10.
      for (let i = 0; i < 60; i++) {
        await seedOptIn(`bulk-${i}@example.com`)
      }
      const res = await sendBroadcastEmail({
        subject: 'Bulk',
        body: 'Body',
        attachments: []
      })
      expect(res.sent).toBe(60)
      expect(res.failed).toEqual([])
      expect(sendMailMock).toHaveBeenCalledTimes(2)
      const batch1 = sendMailMock.mock.calls[0][0]
      const batch2 = sendMailMock.mock.calls[1][0]
      expect(batch1.bcc).toHaveLength(50)
      expect(batch2.bcc).toHaveLength(10)
    })

    it('continues past a failed batch and reports per-customer failures', async () => {
      await seedSmtp()
      await seedCompany()
      // Seed exactly 51 so we get two batches: the first (50) fails,
      // the second (1) succeeds — `sent` and `failed` should reflect
      // both outcomes.
      for (let i = 0; i < 51; i++) {
        await seedOptIn(`row-${String(i).padStart(3, '0')}@example.com`)
      }
      sendMailMock.mockReset()
      sendMailMock
        .mockRejectedValueOnce(new Error('Greylisted'))
        .mockResolvedValueOnce({ messageId: '<after>' })

      const res = await sendBroadcastEmail({
        subject: 'Bulk',
        body: 'Body',
        attachments: []
      })

      expect(sendMailMock).toHaveBeenCalledTimes(2)
      expect(res.sent).toBe(1)
      expect(res.failed).toHaveLength(50)
      // Every failure carries the underlying SMTP message.
      for (const f of res.failed) {
        expect(f.reason).toBe('Greylisted')
        expect(f.customerId).toMatch(/[0-9a-f-]{36}/)
      }

      const rows = await db.select().from(sentMessages)
      const failedRows = rows.filter((r) => r.status === 'failed')
      const sentRows = rows.filter((r) => r.status === 'sent')
      expect(failedRows).toHaveLength(50)
      expect(sentRows).toHaveLength(1)
      expect(failedRows[0].errorMessage).toBe('Greylisted')
    })

    it('attaches files to every batch', async () => {
      await seedSmtp()
      await seedCompany()
      await seedOptIn('one@example.com')
      await sendBroadcastEmail({
        subject: 'A',
        body: 'B',
        attachments: [
          {
            filename: 'foo.pdf',
            mime: 'application/pdf',
            base64Data: Buffer.from('xx').toString('base64')
          }
        ]
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.attachments).toHaveLength(1)
      expect(call.attachments[0].filename).toBe('foo.pdf')
      expect(call.attachments[0].content.toString()).toBe('xx')
    })

    it('appends the Abbestellen footer to the plain-text body', async () => {
      await seedSmtp()
      await seedCompany()
      await seedOptIn('one@example.com')
      await sendBroadcastEmail({
        subject: 'Newsletter',
        body: 'Frühlingsaktion!',
        attachments: []
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.text).toContain('Frühlingsaktion!')
      expect(call.text).toContain('Abbestellen')
      // No HTML in plain-text mode.
      expect(call.html).toBeUndefined()
      // The audit row carries the footer too.
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.bodyText).toContain('Abbestellen')
    })

    it('sets a List-Unsubscribe mailto header to the company address', async () => {
      await seedSmtp()
      await seedCompany({ email: 'kontakt@example.com' })
      await seedOptIn('one@example.com')
      await sendBroadcastEmail({ subject: 'N', body: 'B', attachments: [] })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.headers['List-Unsubscribe']).toBe(
        '<mailto:kontakt@example.com?subject=Abbestellen>'
      )
    })

    it('falls back to the SMTP reply-to for List-Unsubscribe when no company email', async () => {
      await seedSmtp({ replyTo: 'antwort@example.com' })
      await seedCompany({ email: '' })
      await seedOptIn('one@example.com')
      await sendBroadcastEmail({ subject: 'N', body: 'B', attachments: [] })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.headers['List-Unsubscribe']).toBe(
        '<mailto:antwort@example.com?subject=Abbestellen>'
      )
    })

    it('sends HTML with footer and a plain-text fallback when asHtml=true', async () => {
      await seedSmtp()
      await seedCompany()
      await seedOptIn('one@example.com')
      await sendBroadcastEmail({
        subject: 'N',
        body: '<p>Angebot</p>',
        asHtml: true,
        attachments: []
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.html).toContain('<p>Angebot</p>')
      expect(call.html).toContain('Abbestellen')
      expect(call.text).toContain('Angebot')
      expect(call.text).toContain('Abbestellen')
    })

    it('refuses when SMTP is unconfigured (transport build throws)', async () => {
      await seedCompany()
      await seedOptIn('one@example.com')
      await expect(
        sendBroadcastEmail({ subject: 'A', body: 'B', attachments: [] })
      ).rejects.toThrow(/SMTP ist nicht konfiguriert/)
    })
  })

  /* ──────────────────────────────────────────────────────────────────────
   * Public booking confirmation
   * ──────────────────────────────────────────────────────────────────── */

  describe('sendAppointmentConfirmation', () => {
    const seedAppointmentTemplate = async () => {
      await seedTemplate(
        'appointment_confirmation',
        'Ihre Terminbestätigung bei {firma}',
        `Hallo {kundeVorname},

wir bestätigen Ihren Termin:

Datum:      {terminDatum}
Uhrzeit:    {terminUhrzeit} Uhr
Dauer:      {terminDauer} Minuten
{leistung}
Bestätigungs-Code: {bestaetigungsCode}

Viele Grüße
{firma}`
      )
    }

    it('renders date / time / duration / token and the service line', async () => {
      await seedSmtp()
      await seedCompany()
      await seedAppointmentTemplate()
      // 2026-07-15T08:30 UTC == 10:30 Europe/Berlin (CEST).
      const startsAt = new Date('2026-07-15T08:30:00Z')

      const res = await sendAppointmentConfirmation({
        appointmentId: 'app-1',
        customerEmail: 'kunde@example.com',
        customerName: 'Max Mustermann',
        startsAt,
        durationMinutes: 45,
        serviceTitle: 'Inspektion',
        confirmationToken: '11111111-2222-3333-4444-555555555555'
      })
      expect(res.ok).toBe(true)
      expect(sendMailMock).toHaveBeenCalledTimes(1)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.subject).toBe('Ihre Terminbestätigung bei TwinCars GmbH')
      expect(call.to).toBe('Max Mustermann <kunde@example.com>')
      expect(call.text).toContain('Hallo Max,')
      expect(call.text).toContain('Datum:      15.07.2026')
      expect(call.text).toContain('Uhrzeit:    10:30 Uhr')
      expect(call.text).toContain('Dauer:      45 Minuten')
      expect(call.text).toContain('Leistung:    Inspektion')
      expect(call.text).toContain(
        'Bestätigungs-Code: 11111111-2222-3333-4444-555555555555'
      )
    })

    it('omits the Leistung line gracefully when no service title is given', async () => {
      await seedSmtp()
      await seedCompany()
      await seedAppointmentTemplate()
      const startsAt = new Date('2026-02-03T09:00:00Z') // CET → 10:00
      const res = await sendAppointmentConfirmation({
        appointmentId: 'app-2',
        customerEmail: 'k@example.com',
        customerName: 'Anna Beispiel',
        startsAt,
        durationMinutes: 30,
        confirmationToken: 'abc'
      })
      expect(res.ok).toBe(true)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.text).not.toContain('Leistung:')
      expect(call.text).toContain('Datum:      03.02.2026')
      expect(call.text).toContain('Uhrzeit:    10:00 Uhr')
    })

    it('does not throw when sending fails — returns ok=false and logs', async () => {
      await seedSmtp()
      await seedCompany()
      await seedAppointmentTemplate()
      sendMailMock.mockRejectedValueOnce(new Error('Connection refused'))
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const res = await sendAppointmentConfirmation({
        appointmentId: 'app-3',
        customerEmail: 'k@example.com',
        customerName: 'Test User',
        startsAt: new Date('2026-07-15T08:00:00Z'),
        durationMinutes: 60,
        confirmationToken: 'tok'
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBe('Connection refused')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('records a sent_messages row on successful send', async () => {
      await seedSmtp()
      await seedCompany()
      await seedAppointmentTemplate()
      await sendAppointmentConfirmation({
        appointmentId: 'app-4',
        customerEmail: 'audit@example.com',
        customerName: 'Audit User',
        startsAt: new Date('2026-07-15T08:00:00Z'),
        durationMinutes: 60,
        confirmationToken: 'audit-tok'
      })
      const rows = await db.select().from(sentMessages)
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe('sent')
      expect(rows[0].documentType).toBe('appointment_confirmation')
      expect(rows[0].recipientEmail).toBe('audit@example.com')
      expect(rows[0].recipientName).toBe('Audit User')
      expect(rows[0].subject).toBe('Ihre Terminbestätigung bei TwinCars GmbH')
    })
  })

  /* ──────────────────────────────────────────────────────────────────────
   * Contact-form notification
   * ──────────────────────────────────────────────────────────────────── */

  describe('sendContactNotification', () => {
    const seedInquiry = async (
      overrides: Partial<typeof customerInquiries.$inferInsert> = {}
    ): Promise<string> => {
      const [row] = await db
        .insert(customerInquiries)
        .values({
          customerEmail: 'lead@example.com',
          customerName: 'Lead Person',
          subject: 'Frage',
          message: 'Nachricht',
          ...overrides
        })
        .returning({ id: customerInquiries.id })
      return row.id
    }

    it('sends to companySettings.email with the [Anfrage] subject', async () => {
      await seedSmtp()
      await seedCompany({ email: 'kontakt@twincars.de' })
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        customerPhone: '+49 30 555',
        subject: 'Frage zum Reifen',
        message: 'Wann liefert ihr?',
        referenceType: 'general'
      })
      expect(res.ok).toBe(true)
      expect(sendMailMock).toHaveBeenCalledTimes(1)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.to).toBe('kontakt@twincars.de')
      expect(call.subject).toBe('[Anfrage] Frage zum Reifen')
      expect(call.text).toContain('Max Besucher')
      expect(call.text).toContain('visitor@example.com')
      expect(call.text).toContain('+49 30 555')
      expect(call.text).toContain('Wann liefert ihr?')
      expect(call.text).toContain(`Anfrage-ID:     ${inquiryId}`)
    })

    it('resolves a `used-car` reference and includes vehicle info + URL', async () => {
      await seedSmtp()
      await seedCompany({ email: 'ops@example.com' })
      const [v] = await db
        .insert(vehicles)
        .values({
          customerId: null,
          make: 'BMW',
          model: 'M3',
          firstRegistration: '2020-05-01'
        })
        .returning({ id: vehicles.id })
      await db
        .insert(vehicleListings)
        .values({
          vehicleId: v.id,
          status: 'available',
          salesPriceGross: '38900.00'
        })
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'Frage zum BMW',
        message: 'Noch verfügbar?',
        referenceType: 'used-car',
        referenceId: v.id
      })
      expect(res.ok).toBe(true)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.text).toContain('Bezogen auf:')
      expect(call.text).toContain('BMW M3')
      expect(call.text).toContain('Erstzulassung: 2020-05-01')
      expect(call.text).toMatch(/38\.900,00\s?€/)
      expect(call.text).toContain(`/vehicles/${v.id}`)
    })

    it('resolves a `tire` reference and includes brand, size, season', async () => {
      await seedSmtp()
      await seedCompany({ email: 'ops@example.com' })
      const [t] = await db
        .insert(tires)
        .values({
          articleNumber: 'TIRE-1',
          brand: 'Michelin',
          model: 'Primacy 4',
          width: 205,
          aspectRatio: 55,
          construction: 'R',
          diameterInch: 16,
          season: 'Sommer'
        })
        .returning({ id: tires.id })
      await db
        .insert(tirePriceVersions)
        .values({
          tireId: t.id,
          validFrom: '2020-01-01',
          unitPriceNet: '79.90'
        })
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'Reifen-Anfrage',
        message: 'Verfügbarkeit?',
        referenceType: 'tire',
        referenceId: t.id
      })
      expect(res.ok).toBe(true)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.text).toContain('Bezogen auf:')
      expect(call.text).toContain('Reifen: Michelin Primacy 4')
      expect(call.text).toContain('205/55 R16')
      expect(call.text).toContain('Saison: Sommer')
      expect(call.text).toMatch(/79,90\s?€/)
      expect(call.text).toContain(`/tires/${t.id}`)
    })

    it('falls back gracefully when the reference id does not resolve', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await seedSmtp()
      await seedCompany({ email: 'ops@example.com' })
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'Frage',
        message: 'Hallo',
        referenceType: 'used-car',
        referenceId: '00000000-0000-0000-0000-000000000000'
      })
      expect(res.ok).toBe(true)
      const call = sendMailMock.mock.calls[0][0]
      expect(call.text).not.toContain('Bezogen auf:')
      expect(call.text).toContain('Hallo')
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('sets Reply-To to the inquiring customer so the workshop can hit Reply', async () => {
      await seedSmtp()
      await seedCompany({ email: 'ops@example.com' })
      const inquiryId = await seedInquiry()
      await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'Hi',
        message: 'Hi',
        referenceType: 'general'
      })
      const call = sendMailMock.mock.calls[0][0]
      expect(call.replyTo).toBe('visitor@example.com')
      expect(call.to).toBe('ops@example.com')
    })

    it('records a failed send in sent_messages and returns ok:false', async () => {
      await seedSmtp()
      await seedCompany({ email: 'ops@example.com' })
      sendMailMock.mockRejectedValueOnce(new Error('Connection refused'))
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'S',
        message: 'M',
        referenceType: 'general'
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBe('Connection refused')
      const [recorded] = await db.select().from(sentMessages)
      expect(recorded.status).toBe('failed')
      expect(recorded.errorMessage).toBe('Connection refused')
      expect(recorded.documentType).toBe('mailing')
    })

    it('returns ok:false when companySettings.email is unset', async () => {
      await seedSmtp()
      // `seedCompany` defaults `email`; insert directly with email unset.
      await db.delete(companySettings)
      await db.insert(companySettings).values({ companyName: 'TwinCars GmbH' })
      const inquiryId = await seedInquiry()
      const res = await sendContactNotification({
        inquiryId,
        customerEmail: 'visitor@example.com',
        customerName: 'Max Besucher',
        subject: 'S',
        message: 'M',
        referenceType: 'general'
      })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toMatch(/Empfänger-Adresse/)
      expect(sendMailMock).not.toHaveBeenCalled()
    })

    it('recordInquiryNotificationResult flips columns on success / failure', async () => {
      await seedCompany({ email: 'ops@example.com' })
      const inquiryId = await seedInquiry()
      await recordInquiryNotificationResult(inquiryId, {
        ok: true,
        messageId: '<x>'
      })
      const [after] = await db
        .select()
        .from(customerInquiries)
        .where(eq(customerInquiries.id, inquiryId))
      expect(after.notificationStatus).toBe('sent')
      expect(after.notificationSentAt).not.toBeNull()
      expect(after.notificationError).toBeNull()

      await recordInquiryNotificationResult(inquiryId, {
        ok: false,
        error: 'kaput'
      })
      const [after2] = await db
        .select()
        .from(customerInquiries)
        .where(eq(customerInquiries.id, inquiryId))
      expect(after2.notificationStatus).toBe('failed')
      expect(after2.notificationError).toBe('kaput')
    })
  })
})
