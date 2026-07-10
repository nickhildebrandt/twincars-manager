import { command, query } from '$app/server'
import { boolean, integer, maxValue, minValue } from 'valibot'
import { error } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
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
import {
  companySettings,
  mailTemplates,
  smtpSettings
} from '$lib/server/db/schema'
import { getSettings } from '$lib/server/services/settings-service'
import { defaultMailTemplates } from '$lib/server/db/seed-defaults'
import {
  addressLineSchema,
  citySchema,
  emailSchema,
  ibanSchema,
  bicSchema,
  moneySchema,
  phoneSchema,
  urlSchema,
  zipSchema,
  nameSchema,
  optionalEmailSchema
} from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { sendSmtpTestMail } from '$lib/server/services/mail-service'
import { upsertSmtpSettings } from '$lib/server/services/smtp-settings-service'
import { getLaborRate } from '$lib/server/services/work-order-service'
import { upsertItemPrice } from '$lib/server/services/item-service'

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

/**
 * Zahlungserinnerung settings — single friendly template, no
 * escalation, no Mahngebühr, no Verzugszinsen. The operator
 * configures only the on/off toggle, the wait time before the first
 * Zahlungserinnerung and the recurrence interval.
 */
const reminderSettingsSchema = object({
  reminderAutoEnabled: boolean(),
  smallBusinessExempt: boolean(),
  reminderDays1: pipe(
    number('Bitte einen Wert eingeben.'),
    integer('Bitte ganze Zahl eingeben.'),
    minValue(0, 'Bitte keinen negativen Wert eingeben.'),
    maxValue(365, 'Maximal 365 Tage.')
  ),
  reminderRecurEveryDays: pipe(
    number('Bitte einen Wert eingeben.'),
    integer('Bitte ganze Zahl eingeben.'),
    minValue(1, 'Intervall muss mindestens 1 Tag betragen.'),
    maxValue(365, 'Maximal 365 Tage.')
  )
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
 * The company payload includes the embedded logo (mime + base64 data
 * URL). It can be a few hundred KB for typical SVG/PNG logos but lives
 * comfortably within the remote-function transport, and serving it
 * here means the Branding tab can render the preview without a second
 * round-trip.
 *
 * @group integration
 * @module settings
 */
export const getAllSettingsRemote = query(async () => {
  requirePermission('settings')
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
          // Reines Boolean — das Passwort verlässt den Server niemals.
          // Die UI nutzt das Flag nur, um die Punkte als Platzhalter
          // zu rendern.
          hasPassword: !!smtp[0].password,
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
  requirePermission('settings')
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
 * Persist Zahlungserinnerung settings.
 *
 * @group integration
 * @module settings
 */
export const updateReminderSettingsRemote = command(
  reminderSettingsSchema,
  async (data) => {
    requirePermission('settings')
    const settings = await getSettings()
    await db
      .update(companySettings)
      .set({
        reminderAutoEnabled: data.reminderAutoEnabled,
        smallBusinessExempt: data.smallBusinessExempt,
        reminderDays1: data.reminderDays1,
        reminderRecurEveryDays: data.reminderRecurEveryDays,
        updatedAt: new Date()
      })
      .where(eq(companySettings.id, settings.id))
    void getAllSettingsRemote().refresh()
  }
)

/* ────────────────────────────────────────────────────────────────────── */
/* Stundensatz (workshop labor rate)                                      */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * The current workshop labor rate: the designated "Arbeitszeit" catalog
 * item (`company_settings.labor_item_id`) with its currently valid
 * price version. Returns `null` while no labor item is linked.
 *
 * @group integration
 * @module settings
 */
export const getLaborRateSettingRemote = query(async () => {
  requirePermission('settings')
  return getLaborRate()
})

/**
 * Set a new workshop labor rate. Writes a NEW `item_price_versions`
 * row (`valid_from` = today) for the labor item, so the price history
 * is preserved and existing order items keep their snapshot price.
 *
 * @group integration
 * @module settings
 */
export const updateLaborRateRemote = command(
  object({ priceNet: moneySchema }),
  async ({ priceNet }) => {
    requirePermission('settings')
    if (priceNet <= 0) {
      error(400, 'Der Stundensatz muss größer als 0 sein.')
    }
    const settings = await getSettings()
    if (!settings.laborItemId) {
      error(409, 'Es ist kein Arbeitszeit-Artikel hinterlegt.')
    }
    await upsertItemPrice({
      itemId: settings.laborItemId,
      validFrom: new Date().toISOString().slice(0, 10),
      unitPriceNet: priceNet.toFixed(2)
    })
    void getLaborRateSettingRemote().refresh()
  }
)

/* ────────────────────────────────────────────────────────────────────── */
/* Logo                                                                   */
/* ────────────────────────────────────────────────────────────────────── */

const logoSchema = object({
  /** MIME type, e.g. `image/png`. */
  logoMime: pipe(string(), trim(), maxLength(50)),
  /** Base64 data URL or raw base64 — capped at ~7 MB serialized. */
  logoData: pipe(string(), maxLength(7_000_000))
})

/**
 * Replace the company logo. Accepts a base64 data URL (`data:image/png;base64,…`)
 * just like the setup wizard. Pass an empty string to keep the current
 * value — use {@link removeLogoRemote} to clear it.
 *
 * @group integration
 * @module settings
 */
export const updateLogoRemote = command(logoSchema, async (data) => {
  requirePermission('settings')
  const settings = await getSettings()
  await db
    .update(companySettings)
    .set({
      logoMime: data.logoMime,
      logoData: data.logoData,
      updatedAt: new Date()
    })
    .where(eq(companySettings.id, settings.id))
  void getAllSettingsRemote().refresh()
})

/**
 * Remove the stored logo so PDFs revert to a text-only header.
 *
 * @group integration
 * @module settings
 */
export const removeLogoRemote = command(async () => {
  requirePermission('settings')
  const settings = await getSettings()
  await db
    .update(companySettings)
    .set({ logoMime: null, logoData: null, updatedAt: new Date() })
    .where(eq(companySettings.id, settings.id))
  void getAllSettingsRemote().refresh()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Mail templates                                                         */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * List all mail templates — used by the Mailvorlagen settings tab.
 *
 * @group integration
 * @module settings
 */
export const listMailTemplatesRemote = query(async () => {
  requirePermission('settings')
  const rows = await db
    .select()
    .from(mailTemplates)
    .orderBy(asc(mailTemplates.key))
  return rows.map((r) => ({
    key: r.key,
    subject: r.subject,
    body: r.body,
    isCustom: r.isCustom,
    updatedAt: r.updatedAt
  }))
})

const mailTemplateUpdateSchema = object({
  key: pipe(string(), trim(), maxLength(50)),
  subject: pipe(string(), trim(), maxLength(200)),
  body: pipe(string(), maxLength(20_000))
})

/**
 * Persist a single mail template. Sets `is_custom = true` so future
 * default-text changes won't overwrite the user's edits.
 *
 * @group integration
 * @module settings
 */
export const updateMailTemplateRemote = command(
  mailTemplateUpdateSchema,
  async ({ key, subject, body }) => {
    requirePermission('settings')
    const [existing] = await db
      .select()
      .from(mailTemplates)
      .where(eq(mailTemplates.key, key))
      .limit(1)
    if (!existing) error(404, `Mailvorlage „${key}" wurde nicht gefunden.`)
    await db
      .update(mailTemplates)
      .set({ subject, body, isCustom: true, updatedAt: new Date() })
      .where(eq(mailTemplates.key, key))
    void listMailTemplatesRemote().refresh()
  }
)

/**
 * Restore a single mail template to its built-in default content. The
 * defaults live alongside the seed in `seed-defaults.ts`, so both setup
 * and reset use the same source of truth.
 *
 * @group integration
 * @module settings
 */
export const resetMailTemplateRemote = command(
  object({ key: pipe(string(), trim(), maxLength(50)) }),
  async ({ key }) => {
    requirePermission('settings')
    const def = defaultMailTemplates.find((t) => t.key === key)
    if (!def) error(404, `Standardvorlage für „${key}" nicht hinterlegt.`)
    await db
      .update(mailTemplates)
      .set({
        subject: def.subject,
        body: def.body,
        isCustom: false,
        updatedAt: new Date()
      })
      .where(eq(mailTemplates.key, key))
    void listMailTemplatesRemote().refresh()
  }
)

/**
 * Persist SMTP credentials. Password only updated if non-empty; the
 * encrypt-and-upsert semantics live in `smtp-settings-service`.
 */
export const updateSmtpRemote = command(smtpUpdateSchema, async (data) => {
  requirePermission('settings')
  const port = Number(data.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    error(400, 'Ungültiger SMTP-Port.')

  await upsertSmtpSettings({
    host: data.host,
    port,
    secure: data.secure,
    username: data.username,
    // Absent input behaves like empty: keep the stored password.
    password: data.password ?? '',
    fromAddress: data.fromAddress,
    fromName: data.fromName,
    replyTo: data.replyTo ?? null
  })
  void getAllSettingsRemote().refresh()
})

/* ────────────────────────────────────────────────────────────────────── */
/* SMTP Testversand                                                       */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Double-fire guard for the SMTP test send. Module-level on purpose:
 * remote modules are process singletons, so an in-flight flag plus a
 * 5 s cooldown measured from the last START stops accidental double
 * clicks and rapid re-fires. This is a UI safeguard, not a
 * multi-instance rate limiter (the app runs as a single node process)
 * — it deliberately needs no DB table and resets on restart.
 */
let smtpTestInFlight = false
let smtpTestLastStartedAt = 0
const SMTP_TEST_COOLDOWN_MS = 5_000

/**
 * Send a German test mail to `recipient` via the currently PERSISTED
 * `smtp_settings` (never the unsaved form values — the UI hints at
 * saving first). Returns the typed service result: send failures come
 * back as `{ ok: false, error }` with a curated German message the UI
 * renders inline; only the double-fire guard throws (429).
 *
 * @group integration
 * @module settings
 */
export const sendSmtpTestMailRemote = command(
  object({ recipient: emailSchema }),
  async ({ recipient }) => {
    requirePermission('settings')
    const now = Date.now()
    if (
      smtpTestInFlight ||
      now - smtpTestLastStartedAt < SMTP_TEST_COOLDOWN_MS
    ) {
      error(
        429,
        'Ein Testversand läuft bereits oder wurde soeben gestartet. Bitte warten Sie einen Moment.'
      )
    }
    smtpTestInFlight = true
    smtpTestLastStartedAt = now
    try {
      return await sendSmtpTestMail({ recipient })
    } finally {
      smtpTestInFlight = false
    }
  }
)
