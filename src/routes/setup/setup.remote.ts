import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import {
  object,
  optional,
  picklist,
  pipe,
  string,
  trim,
  maxLength
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
  optionalEmailSchema,
  phoneSchema,
  zipSchema,
  urlSchema,
  nameSchema
} from '$lib/server/db/validation'

const companyDataSchema = object({
  companyName: nameSchema,
  owner: optional(pipe(string(), trim(), maxLength(200))),
  street: addressLineSchema,
  zip: zipSchema,
  city: citySchema,
  state: pipe(string(), trim(), maxLength(50, 'Bundesland zu lang')),
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
  salutationStyle: picklist(['Sie', 'Du']),
  logoMime: optional(pipe(string(), maxLength(50))),
  logoData: optional(pipe(string(), maxLength(7_000_000)))
})

const smtpSchema = object({
  host: pipe(string(), trim(), maxLength(255)),
  port: pipe(string(), trim(), maxLength(5)),
  secure: picklist(['none', 'STARTTLS', 'TLS']),
  username: pipe(string(), trim(), maxLength(200)),
  password: pipe(string(), maxLength(200)),
  fromAddress: emailSchema,
  fromName: pipe(string(), trim(), maxLength(200)),
  replyTo: optionalEmailSchema
})

/**
 * Returns whether the first-run setup has been completed.
 *
 * @group integration
 * @module setup
 */
export const getSetupStatus = query(async () => {
  const s = await getSettings()
  return { setupCompleted: s.setupCompleted }
})

/**
 * Persist the company data step. Returns the saved row id.
 *
 * @group integration
 * @module setup
 */
export const saveCompanyData = command(companyDataSchema, async (data) => {
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
      salutationStyle: data.salutationStyle,
      logoMime: data.logoMime ?? null,
      logoData: data.logoData ?? null,
      updatedAt: new Date()
    })
    .where(eq(companySettings.id, settings.id))
})

/**
 * Persist SMTP credentials. Password is encrypted with the app key.
 *
 * @group integration
 * @module setup
 */
export const saveSmtp = command(smtpSchema, async (data) => {
  const portNum = Number(data.port)
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    error(400, 'Ungültiger SMTP-Port.')
  }
  const rows = await db.select().from(smtpSettings).limit(1)
  const id = rows[0]?.id
  if (!id) {
    await db
      .insert(smtpSettings)
      .values({
        host: data.host,
        port: portNum,
        secure: data.secure,
        username: data.username,
        passwordEncrypted: encrypt(data.password),
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
        port: portNum,
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
})

/**
 * Mark setup as completed.
 */
export const completeSetup = command(async () => {
  const s = await getSettings()
  await db
    .update(companySettings)
    .set({ setupCompleted: true, updatedAt: new Date() })
    .where(eq(companySettings.id, s.id))
  void getSetupStatus().refresh()
})
