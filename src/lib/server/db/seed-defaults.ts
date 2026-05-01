import { db } from './client'
import {
  companySettings,
  smtpSettings,
  numberRanges,
  mailTemplates,
  ledgerCategories
} from './schema'
import { sql } from 'drizzle-orm'

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
    key: 'reminder_1',
    subject: 'Zahlungserinnerung zu Rechnung {rechnungNummer}',
    body: `Sehr geehrte Damen und Herren,

unsere Rechnung {rechnungNummer} vom {rechnungDatum} ist seit {verzugstage} Tagen fällig.
Sicherlich haben Sie diese übersehen — wir bitten freundlich um Ausgleich des offenen Betrags von {rechnungOffenerBetrag} innerhalb der nächsten Tage.

Sollten Sie zwischenzeitlich gezahlt haben, betrachten Sie diese Erinnerung als gegenstandslos.

Mit freundlichen Grüßen
{firma}`
  },
  {
    key: 'reminder_2',
    subject: 'Zahlungserinnerung 2 zu Rechnung {rechnungNummer}',
    body: `Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung ist die Rechnung {rechnungNummer} bis heute nicht bezahlt.
Wir bitten Sie, den offenen Betrag von {rechnungOffenerBetrag} zuzüglich Mahngebühr ({mahnungGebühr}) bis spätestens {fälligkeitsDatum} zu begleichen.

Mit freundlichen Grüßen
{firma}`
  },
  {
    key: 'reminder_3',
    subject: 'Letzte Mahnung zu Rechnung {rechnungNummer}',
    body: `Sehr geehrte Damen und Herren,

dies ist unsere letzte Mahnung zu Rechnung {rechnungNummer}. Wir fordern Sie auf, den offenen Betrag von {rechnungOffenerBetrag} zuzüglich Mahngebühr ({mahnungGebühr}) innerhalb von 7 Tagen zu begleichen, anderenfalls werden wir weitere Schritte einleiten.

Mit freundlichen Grüßen
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
  },
  {
    key: 'payslip',
    subject: 'Ihre Lohnabrechnung {periode}',
    body: `Hallo {mitarbeiterVorname},

anbei erhalten Sie Ihre Lohnabrechnung für den Zeitraum {periode}.
Bei Fragen wende dich gern jederzeit an die Geschäftsleitung.

Viele Grüße
{firma}`
  }
]

const defaultNumberRanges = [
  { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}' },
  { kind: 'offer', formatTemplate: 'AN-{YYYY}-{NNNN}' },
  { kind: 'cost_estimate', formatTemplate: 'KV-{YYYY}-{NNNN}' },
  { kind: 'order_confirmation', formatTemplate: 'AB-{YYYY}-{NNNN}' },
  { kind: 'reminder', formatTemplate: 'MA-{YYYY}-{NNNN}' },
  { kind: 'customer', formatTemplate: 'KU-{NNNNN}' }
]

const defaultLedgerCategories = [
  { direction: 'income', name: 'Werkstatterlöse' },
  { direction: 'income', name: 'Fahrzeugverkauf' },
  { direction: 'income', name: 'Mahngebühren' },
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
    await db.execute(sql`
			INSERT INTO number_ranges (kind, format_template, next_value)
			VALUES (${r.kind}, ${r.formatTemplate}, 1)
			ON CONFLICT (kind) DO NOTHING
		`)
  }

  for (const t of defaultMailTemplates) {
    await db.execute(sql`
			INSERT INTO mail_templates (key, subject, body, is_custom)
			VALUES (${t.key}, ${t.subject}, ${t.body}, false)
			ON CONFLICT (key) DO NOTHING
		`)
  }

  for (const c of defaultLedgerCategories) {
    await db.execute(sql`
			INSERT INTO ledger_categories (direction, name)
			VALUES (${c.direction}, ${c.name})
			ON CONFLICT (name) DO NOTHING
		`)
  }
}
