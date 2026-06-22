import { db } from './client'
import {
  companySettings,
  smtpSettings,
  numberRanges,
  mailTemplates,
  ledgerCategories,
  roles,
  rolePermissions,
  workshopHours
} from './schema'
import {
  MODULE_PERMISSIONS,
  WILDCARD_PERMISSION
} from '$lib/server/auth-permissions'
import { seedDefaultHolidays } from './seed-holidays'
import { eq } from 'drizzle-orm'

export const defaultMailTemplates: Array<{
  key: string
  subject: string
  body: string
}> = [
  {
    key: 'invoice',
    subject: 'Ihre Rechnung {rechnungNummer} vom {rechnungDatum}',
    body: `Sehr geehrte Damen und Herren,

anbei senden wir Ihnen die Rechnung {rechnungNummer} vom {rechnungDatum}.
Bitte überweisen Sie den Betrag von {rechnungBetragBrutto} bis spätestens {fälligkeitsDatum} auf folgendes Konto:

{firma}
IBAN: {firmaIban}
BIC: {firmaBic}

Vielen Dank für Ihr Vertrauen.

Mit freundlichen Grüßen
{firma}`
  },
  {
    key: 'cost_estimate',
    subject: 'Ihr Kostenvoranschlag {angebotNummer} – {fahrzeugKennzeichen}',
    body: `Sehr geehrte Damen und Herren,

anbei erhalten Sie unseren Kostenvoranschlag {angebotNummer} für Ihr Fahrzeug {fahrzeugTyp} ({fahrzeugKennzeichen}).
Der Kostenvoranschlag ist gültig bis {angebotGültigBis}.

Bei Fragen oder Rückmeldungen stehen wir Ihnen jederzeit gern zur Verfügung.

Mit freundlichen Grüßen
{firma}`
  },
  {
    key: 'offer',
    subject: 'Unser Angebot {angebotNummer}',
    body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen unser Angebot {angebotNummer} unterbreiten zu dürfen.
Das Angebot finden Sie im Anhang. Es ist gültig bis {angebotGültigBis}.

Mit freundlichen Grüßen
{firma}`
  },
  {
    key: 'order_confirmation',
    subject: 'Auftragsbestätigung {angebotNummer}',
    body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihren Auftrag. Anbei senden wir Ihnen die Auftragsbestätigung zu {angebotNummer}.
Wir bestätigen den Auftrag und melden uns mit dem geplanten Termin.

Mit freundlichen Grüßen
{firma}`
  },
  {
    // Single, friendly payment reminder template. The same body goes
    // out each time the recurring scheduler picks the invoice up
    // again — there is no `reminder_2` / `reminder_3` escalation.
    key: 'reminder_1',
    subject: 'Freundliche Zahlungserinnerung zu Rechnung {rechnungNummer}',
    body: `Sehr geehrte Damen und Herren,

wir möchten Sie freundlich daran erinnern, dass unsere Rechnung {rechnungNummer} vom {rechnungDatum} noch offen ist. Aktuell sind {verzugstage} Tage seit dem Fälligkeitsdatum vergangen.

Bitte überweisen Sie den offenen Betrag von {rechnungOffenerBetrag} auf das in der Rechnung angegebene Konto.

Sollte sich Ihre Zahlung mit dieser E-Mail überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos. Bei Fragen melden Sie sich gern jederzeit bei uns.

Vielen Dank — mit freundlichen Grüßen
{firma}`
  },
  {
    // Twice-yearly nudge to customers whose tires are stored on the
    // workshop premises. The body uses `{kundeVorname}` so we can
    // greet the customer by first name when available; the mail
    // service falls back to "{kundeName}" when it isn't.
    key: 'tire_reminder',
    subject: 'Termin für den Reifenwechsel buchen — {firma}',
    body: `Hallo {kundeVorname},

die nächste Saison rückt näher. Wir möchten Sie freundlich daran erinnern, einen Termin für den Reifenwechsel bei uns zu buchen. Ihre eingelagerten Reifen sind bereit.

Bitte melden Sie sich kurz telefonisch unter {firmaTelefon} oder per E-Mail an {firmaMail}, dann finden wir gemeinsam einen passenden Termin.

Mit freundlichen Grüßen
{firma}`
  },
  {
    // Auto-sent after a successful public booking via
    // `POST /api/public/appointments`. The body mixes the slot details
    // with the confirmation token so the customer can find the booking
    // again if needed (the token is also stashed in the appointment's
    // notes column).
    key: 'appointment_confirmation',
    subject: 'Ihre Terminbestätigung bei {firma}',
    body: `Hallo {kundeVorname},

wir bestätigen Ihren Termin:

Datum:      {terminDatum}
Uhrzeit:    {terminUhrzeit} Uhr
Dauer:      {terminDauer} Minuten
{leistung}
Bestätigungs-Code: {bestaetigungsCode}

Bei Rückfragen sind wir unter {firmaTelefon} oder {firmaMail} erreichbar.

Viele Grüße
{firma}`
  },
  {
    key: 'mailing',
    subject: 'Information von {firma}',
    body: `Sehr geehrte Damen und Herren,

wir möchten Sie auf folgendes hinweisen:

[Hier Ihren Text einfügen]

Bei Rückfragen erreichen Sie uns unter {firmaTelefon} oder per E-Mail unter {firmaMail}.

Mit freundlichen Grüßen
{firma}`
  }
]

/**
 * Nummern-Schema: Kunden- und Belegnummern sind aus rechtlichen
 * Gründen reine Zähler — der Betrieb muss nahtlos an die alte
 * KFZ-Kaufmann-DB anschließen können (z.B. Rechnung 19086 → 19087
 * nach Datenübernahme). Zahlungserinnerungen behalten ihren eigenen
 * Jahres-Prefix, weil Legacy keine eigene Erinnerungs-Nummer kannte
 * und wir dort frei bei 1 starten können.
 */
const defaultNumberRanges = [
  { kind: 'invoice', formatTemplate: '{N}' },
  { kind: 'offer', formatTemplate: '{N}' },
  { kind: 'cost_estimate', formatTemplate: '{N}' },
  { kind: 'order_confirmation', formatTemplate: '{N}' },
  { kind: 'reminder', formatTemplate: 'ZE-{YYYY}-{NNNN}' },
  { kind: 'customer', formatTemplate: '{N}' },
  { kind: 'tire_storage', formatTemplate: 'L-{YYYY}-{NNNN}' },
  // GoBD-Storno: gleicher Zähler-Stil wie Rechnungen, S-Präfix damit
  // Audit-Listen die Storno-Rechnungen sofort von regulären Rechnungen
  // unterscheiden. `cancelInvoice` ruft `nextDocumentNumber('storno')`.
  { kind: 'storno', formatTemplate: 'S-{N}' }
]

const defaultLedgerCategories = [
  { direction: 'income', name: 'Werkstatterlöse' },
  { direction: 'income', name: 'Fahrzeugverkauf' },
  { direction: 'income', name: 'Sonstige Einnahmen' },
  { direction: 'expense', name: 'Material' },
  { direction: 'expense', name: 'Werkzeug' },
  { direction: 'expense', name: 'Miete' },
  { direction: 'expense', name: 'Strom' },
  { direction: 'expense', name: 'Internet' },
  { direction: 'expense', name: 'Reisekosten' },
  { direction: 'expense', name: 'Lohnaufwand' },
  { direction: 'expense', name: 'Fahrzeug-Einkauf' },
  { direction: 'expense', name: 'Inzahlungnahme' },
  { direction: 'expense', name: 'Sonstiges' }
]

const defaultPdfFooter = `Vielen Dank für Ihren Auftrag. Es gelten unsere allgemeinen Geschäftsbedingungen.
Zahlbar innerhalb des angegebenen Zahlungsziels ohne Abzug.`

/**
 * Seed default rows for company settings, SMTP, mail templates, number
 * ranges and ledger categories. Idempotent — only inserts what's missing.
 */
export async function seedDefaults() {
  const existing = await db.select().from(companySettings).limit(1)
  if (existing.length === 0) {
    await db.insert(companySettings).values({ pdfFooter: defaultPdfFooter })
  }

  const existingSmtp = await db.select().from(smtpSettings).limit(1)
  if (existingSmtp.length === 0) {
    await db.insert(smtpSettings).values({})
  }

  for (const r of defaultNumberRanges) {
    await db
      .insert(numberRanges)
      .values({ kind: r.kind, formatTemplate: r.formatTemplate, nextValue: 1 })
      .onConflictDoNothing({ target: numberRanges.kind })
  }

  for (const t of defaultMailTemplates) {
    await db
      .insert(mailTemplates)
      .values({ key: t.key, subject: t.subject, body: t.body, isCustom: false })
      .onConflictDoNothing({ target: mailTemplates.key })
  }

  for (const c of defaultLedgerCategories) {
    await db
      .insert(ledgerCategories)
      .values({ direction: c.direction, name: c.name })
      .onConflictDoNothing({ target: ledgerCategories.name })
  }

  await seedDefaultRoles()
  await seedDefaultWorkshopHours()
  await seedDefaultHolidays()
}

/**
 * Seed the seven `workshop_hours` rows (one per weekday). Defaults:
 * Mon-Fri 08:00-17:00 open, Sat (6) and Sun (0) closed.
 *
 * Idempotent — only inserts the weekdays that are not already present,
 * so subsequent boots leave operator edits untouched.
 */
export async function seedDefaultWorkshopHours(): Promise<void> {
  const defaults: Array<{
    weekday: number
    opensAt: string
    closesAt: string
    closed: boolean
  }> = [
    { weekday: 0, opensAt: '08:00', closesAt: '17:00', closed: true },
    { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 5, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 6, opensAt: '08:00', closesAt: '17:00', closed: true }
  ]
  for (const row of defaults) {
    await db
      .insert(workshopHours)
      .values(row)
      .onConflictDoNothing({ target: workshopHours.weekday })
  }
}

/**
 * Seed the three built-in roles (per-module permission model — one key
 * grants full access to a module):
 *
 * - "Administrator": wildcard `*` — full access. Always present.
 * - "Werkstattleiter": every module except `settings` / `users`.
 * - "Mitarbeiter": the operational modules a workshop employee needs,
 *   with `hours:write_own` (self-service time logging) instead of full
 *   `hours`. No settings/users/employees/ledger/mailings/shipping/import.
 *
 * Permissions stay in sync with the canonical `MODULE_PERMISSIONS`
 * table — a new module is auto-granted to Administrator via the
 * wildcard and to Werkstattleiter via the `flatMap` below; the
 * Mitarbeiter list is curated and gains new modules only deliberately.
 */
async function seedDefaultRoles(): Promise<void> {
  await ensureRole('Administrator', 'Voller Zugriff auf alle Module.', [
    WILDCARD_PERMISSION
  ])
  await ensureRole(
    'Werkstattleiter',
    'Vollzugriff auf alle Module außer Einstellungen / Benutzer.',
    Object.entries(MODULE_PERMISSIONS)
      .filter(([m]) => m !== 'settings' && m !== 'users')
      .flatMap(([, perms]) => perms)
  )
  await ensureRole(
    'Mitarbeiter',
    'Operativer Zugriff auf die wichtigsten Module; Stunden nur für sich selbst.',
    [
      'customers',
      'vehicles',
      'suppliers',
      'items',
      'offers',
      'invoices',
      'reminders',
      'calendar',
      'inventory',
      'tires',
      'hours:write_own'
    ]
  )
}

async function ensureRole(
  name: string,
  description: string,
  permissions: string[]
): Promise<void> {
  let [row] = await db.select().from(roles).where(eq(roles.name, name)).limit(1)
  if (!row) {
    ;[row] = await db.insert(roles).values({ name, description }).returning()
  }
  for (const permission of permissions) {
    await db
      .insert(rolePermissions)
      .values({ roleId: row.id, permission })
      .onConflictDoNothing({
        target: [rolePermissions.roleId, rolePermissions.permission]
      })
  }
}
