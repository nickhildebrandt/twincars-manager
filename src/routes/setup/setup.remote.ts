import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import {
  array,
  boolean,
  check,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  regex,
  string,
  trim,
  maxLength
} from 'valibot'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  roles,
  smtpSettings,
  userRoles,
  users
} from '$lib/server/db/schema'
import { getSettings } from '$lib/server/services/settings-service'
import { createUserWithCredential } from '$lib/server/auth-users'
import {
  listWorkshopHours,
  updateWorkshopHours
} from '$lib/server/services/workshop-hours-service'
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

/**
 * Mandatory company data for a Kfz business that issues compliant
 * invoices: identity + address + contact + tax number + bank details.
 * The server enforces the same required set as the wizard's client-side
 * validator so the setup can't be completed with a half-filled record via
 * a direct API call. Truly optional fields (`owner`, `mobile`, `fax`,
 * `website`, `vatId`, logo) stay `optional()`; the SMTP step and the logo
 * can be added later under Settings.
 */
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
  taxNumber: pipe(
    string('Bitte die Steuernummer angeben.'),
    trim(),
    minLength(1, 'Bitte die Steuernummer angeben.'),
    maxLength(30, 'Steuernummer zu lang.')
  ),
  bankName: pipe(
    string('Bitte den Bank-Namen angeben.'),
    trim(),
    minLength(1, 'Bitte den Bank-Namen angeben.'),
    maxLength(100, 'Bank-Name zu lang.')
  ),
  iban: ibanSchema,
  bic: bicSchema,
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
 * Persist SMTP credentials. Password is stored as-is in the database
 * — see the setup notes for the deliberate decision to not encrypt
 * application data at rest.
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
        password: data.password,
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
        password: data.password ? data.password : rows[0].password,
        fromAddress: data.fromAddress,
        fromName: data.fromName,
        replyTo: data.replyTo ?? null,
        verified: false,
        updatedAt: new Date()
      })
      .where(eq(smtpSettings.id, id))
  }
})

const adminSchema = object({
  username: pipe(
    string(),
    trim(),
    minLength(3, 'Benutzername zu kurz (mind. 3 Zeichen).'),
    maxLength(64, 'Benutzername zu lang.'),
    regex(
      /^[a-zA-Z0-9_.]+$/,
      'Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten.'
    )
  ),
  name: pipe(
    string(),
    trim(),
    minLength(1, 'Anzeigename darf nicht leer sein.'),
    maxLength(200, 'Anzeigename zu lang.')
  ),
  password: pipe(
    string(),
    minLength(8, 'Passwort zu kurz (mind. 8 Zeichen).'),
    maxLength(128, 'Passwort zu lang.')
  )
})

/**
 * Create the very first administrator account. Only succeeds while no
 * users exist yet — once a user is in the table, the settings UI takes
 * over for further user management. The Administrator role must already
 * be present (seeded by `seedDefaults`).
 *
 * @group integration
 * @module setup
 */
export const createInitialAdmin = command(
  adminSchema,
  async ({ username, name, password }) => {
    const existing = await db.select({ id: users.id }).from(users).limit(1)
    if (existing.length > 0) {
      error(409, 'Es existiert bereits ein Benutzerkonto.')
    }

    const { id: userId } = await createUserWithCredential({
      username,
      name,
      password
    })

    const [adminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'Administrator'))
      .limit(1)
    if (!adminRole) {
      error(500, 'Standard-Rolle „Administrator" fehlt.')
    }
    await db
      .insert(userRoles)
      .values({ userId, roleId: adminRole.id })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
  }
)

/* ──────────────────────────────────────────────────────────────────────
 * Workshop opening hours — wizard-scoped variants
 *
 * The settings-area workshop-hours remotes are gated by the `settings`
 * permission. The setup wizard runs anonymously
 * (no admin exists yet), so we need a thin pair of guard-less remotes
 * usable only while setup is incomplete. Once setupCompleted=true the
 * operator manages opening hours via the regular settings page.
 * ────────────────────────────────────────────────────────────────────── */

const setupWorkshopHoursSchema = object({
  rows: array(
    object({
      weekday: pipe(
        number(),
        minValue(0, 'Wochentag muss zwischen 0 und 6 liegen.'),
        maxValue(6, 'Wochentag muss zwischen 0 und 6 liegen.'),
        check((v) => Number.isInteger(v), 'Wochentag muss ganzzahlig sein.')
      ),
      opensAt: pipe(
        string('Bitte eine Uhrzeit eingeben.'),
        trim(),
        check(
          (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
          'Bitte eine gültige Uhrzeit im Format HH:MM eingeben.'
        )
      ),
      closesAt: pipe(
        string('Bitte eine Uhrzeit eingeben.'),
        trim(),
        check(
          (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
          'Bitte eine gültige Uhrzeit im Format HH:MM eingeben.'
        )
      ),
      closed: boolean()
    })
  )
})

const refuseAfterSetup = async (): Promise<void> => {
  const s = await getSettings()
  if (s.setupCompleted) {
    error(
      403,
      'Setup ist bereits abgeschlossen. Bitte die regulären Einstellungen verwenden.'
    )
  }
}

/**
 * Wizard-side read of the seven workshop_hours rows. Anonymous-callable
 * for as long as setup is incomplete; refuses once the operator has
 * marked setup as done.
 *
 * @group integration
 * @module setup
 */
export const listWorkshopHoursForSetup = query(async () => {
  await refuseAfterSetup()
  return listWorkshopHours()
})

/**
 * Persist all seven weekday rows in one go. The wizard sends the whole
 * week on "Weiter" so we avoid fanning out into seven sequential
 * remote calls.
 *
 * @group integration
 * @module setup
 */
export const saveWorkshopHoursForSetup = command(
  setupWorkshopHoursSchema,
  async ({ rows }) => {
    await refuseAfterSetup()
    // 7 small writes against a local DB; sequential keeps error
    // reporting predictable if a single row fails validation.
    for (const r of rows) {
      await updateWorkshopHours(r.weekday, {
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        closed: r.closed
      })
    }
  }
)

/**
 * Mark setup as completed. Guards against leaving a half-finished state:
 * refuses unless (a) an admin user exists and (b) the mandatory company
 * data (name, address, e-mail) was actually persisted — so a client that
 * skipped or bypassed the company step can't flip the app into the
 * "set up" state with an empty record.
 */
export const completeSetup = command(async () => {
  const adminCount = await db.select({ id: users.id }).from(users).limit(1)
  if (adminCount.length === 0) {
    error(400, 'Bitte zuerst ein Administrator-Konto anlegen.')
  }
  const s = await getSettings()
  const missingCompany =
    !s.companyName?.trim() ||
    !s.street?.trim() ||
    !s.city?.trim() ||
    !s.email?.trim()
  if (missingCompany) {
    error(400, 'Bitte zuerst die Firmendaten vollständig ausfüllen.')
  }
  await db
    .update(companySettings)
    .set({ setupCompleted: true, updatedAt: new Date() })
    .where(eq(companySettings.id, s.id))
  void getSetupStatus().refresh()
})
