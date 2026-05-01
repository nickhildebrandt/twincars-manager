import { command, query } from '$app/server'
import { boolean, integer, maxValue, minValue } from 'valibot'
import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import {
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { db } from '$lib/server/db/client'
import { companySettings, smtpSettings } from '$lib/server/db/schema'
import { encrypt } from '$lib/server/utils/crypto'
import { getSettings } from '$lib/server/services/settings-service'
import {
  addressLineSchema,
  citySchema,
  emailSchema,
  ibanSchema,
  bicSchema,
  phoneSchema,
  urlSchema,
  zipSchema,
  nameSchema,
  optionalEmailSchema
} from '$lib/server/db/validation'

const companyDataSchema = object({
  companyName: nameSchema,
  owner: optional(pipe(string(), trim(), maxLength(200))),
  street: addressLineSchema,
  zip: zipSchema,
  city: citySchema,
  state: pipe(string(), trim(), maxLength(50)),
  phone: phoneSchema,
  mobile: optional(phoneSchema),
  fax: optional(phoneSchema),
  email: emailSchema,
  website: optional(urlSchema),
  vatId: optional(pipe(string(), trim(), maxLength(30))),
  taxNumber: optional(pipe(string(), trim(), maxLength(30))),
  bankName: optional(pipe(string(), trim(), maxLength(100))),
  iban: optional(ibanSchema),
  bic: optional(bicSchema),
  defaultPaymentTermDays: optional(number()),
  defaultVatRate: optional(number()),
  salutationStyle: picklist(['Sie', 'Du']),
  pdfFooter: optional(pipe(string(), trim(), maxLength(10000)))
})

const reminderSettingsSchema = object({
  reminderAutoEnabled: boolean(),
  smallBusinessExempt: boolean(),
  reminderDays1: pipe(number(), integer(), minValue(0), maxValue(365)),
  reminderDays2: pipe(number(), integer(), minValue(0), maxValue(365)),
  reminderDays3: pipe(number(), integer(), minValue(0), maxValue(365)),
  reminderDays4: pipe(number(), integer(), minValue(0), maxValue(365)),
  reminderFee1: pipe(number(), minValue(0), maxValue(1_000)),
  reminderFee2: pipe(number(), minValue(0), maxValue(1_000)),
  reminderFee3: pipe(number(), minValue(0), maxValue(1_000)),
  reminderFee4: pipe(number(), minValue(0), maxValue(1_000)),
  reminderInterestRate: pipe(number(), minValue(0), maxValue(50))
})

const smtpUpdateSchema = object({
  host: pipe(string(), trim(), maxLength(255)),
  port: number(),
  secure: picklist(['none', 'STARTTLS', 'TLS']),
  username: pipe(string(), trim(), maxLength(200)),
  password: optional(pipe(string(), maxLength(200))),
  fromAddress: emailSchema,
  fromName: pipe(string(), trim(), maxLength(200)),
  replyTo: optionalEmailSchema
})

/**
 * Load combined settings (company + SMTP).
 *
 * @group integration
 * @module settings
 */
export const getAllSettingsRemote = query(async () => {
  const [company, smtp] = await Promise.all([
    getSettings(),
    db.select().from(smtpSettings).limit(1)
  ])
  return {
    company,
    smtp: smtp[0]
      ? {
          host: smtp[0].host,
          port: smtp[0].port,
          secure: smtp[0].secure,
          username: smtp[0].username,
          fromAddress: smtp[0].fromAddress,
          fromName: smtp[0].fromName,
          replyTo: smtp[0].replyTo,
          verified: smtp[0].verified
        }
      : null
  }
})

/**
 * Persist company data (settings page).
 */
export const updateCompanyRemote = command(companyDataSchema, async (data) => {
  const settings = await getSettings()
  await db
    .update(companySettings)
    .set({
      companyName: data.companyName,
      owner: data.owner ?? null,
      street: data.street,
      zip: data.zip,
      city: data.city,
      state: data.state,
      phone: data.phone,
      mobile: data.mobile ?? null,
      fax: data.fax ?? null,
      email: data.email,
      website: data.website ?? null,
      vatId: data.vatId ?? null,
      taxNumber: data.taxNumber ?? null,
      bankName: data.bankName ?? null,
      iban: data.iban ?? null,
      bic: data.bic ?? null,
      defaultPaymentTermDays:
        data.defaultPaymentTermDays ?? settings.defaultPaymentTermDays,
      defaultVatRate: data.defaultVatRate
        ? String(data.defaultVatRate)
        : settings.defaultVatRate,
      salutationStyle: data.salutationStyle,
      pdfFooter: data.pdfFooter ?? '',
      updatedAt: new Date()
    })
    .where(eq(companySettings.id, settings.id))
  void getAllSettingsRemote().refresh()
})

/**
 * Persist Mahnwesen / dunning settings.
 *
 * @group integration
 * @module settings
 */
export const updateReminderSettingsRemote = command(
  reminderSettingsSchema,
  async (data) => {
    const settings = await getSettings()
    await db
      .update(companySettings)
      .set({
        reminderAutoEnabled: data.reminderAutoEnabled,
        smallBusinessExempt: data.smallBusinessExempt,
        reminderDays1: data.reminderDays1,
        reminderDays2: data.reminderDays2,
        reminderDays3: data.reminderDays3,
        reminderDays4: data.reminderDays4,
        reminderFee1: String(data.reminderFee1),
        reminderFee2: String(data.reminderFee2),
        reminderFee3: String(data.reminderFee3),
        reminderFee4: String(data.reminderFee4),
        reminderInterestRate: String(data.reminderInterestRate),
        updatedAt: new Date()
      })
      .where(eq(companySettings.id, settings.id))
    void getAllSettingsRemote().refresh()
  }
)

/**
 * Persist SMTP credentials. Password only updated if non-empty.
 */
export const updateSmtpRemote = command(smtpUpdateSchema, async (data) => {
  const port = Number(data.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    error(400, 'Ungültiger SMTP-Port.')

  const rows = await db.select().from(smtpSettings).limit(1)
  const id = rows[0]?.id
  if (!id) {
    await db
      .insert(smtpSettings)
      .values({
        host: data.host,
        port,
        secure: data.secure,
        username: data.username,
        passwordEncrypted: encrypt(data.password ?? ''),
        fromAddress: data.fromAddress,
        fromName: data.fromName,
        replyTo: data.replyTo ?? null,
        verified: false,
        updatedAt: new Date()
      })
  } else {
    await db
      .update(smtpSettings)
      .set({
        host: data.host,
        port,
        secure: data.secure,
        username: data.username,
        passwordEncrypted: data.password
          ? encrypt(data.password)
          : rows[0].passwordEncrypted,
        fromAddress: data.fromAddress,
        fromName: data.fromName,
        replyTo: data.replyTo ?? null,
        verified: false,
        updatedAt: new Date()
      })
      .where(eq(smtpSettings.id, id))
  }
  void getAllSettingsRemote().refresh()
})
