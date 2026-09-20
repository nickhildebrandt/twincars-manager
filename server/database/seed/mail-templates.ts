/**
 * The eight mail templates the application ships with.
 *
 * Taken over word for word from the predecessor: the wording is the business
 * owner's, has been in use with customers for a long time, and is edited in
 * the settings rather than in code. Placeholders in braces are filled in by
 * the mail service.
 */

export const DEFAULT_MAIL_TEMPLATES: ReadonlyArray<{
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
{firma}`,
  },
  {
    key: 'cost_estimate',
    subject: 'Ihr Kostenvoranschlag {angebotNummer} - {fahrzeugKennzeichen}',
    body: `Sehr geehrte Damen und Herren,

anbei erhalten Sie unseren Kostenvoranschlag {angebotNummer} für Ihr Fahrzeug {fahrzeugTyp} ({fahrzeugKennzeichen}).
Der Kostenvoranschlag ist gültig bis {angebotGültigBis}.

Bei Fragen oder Rückmeldungen stehen wir Ihnen jederzeit gern zur Verfügung.

Mit freundlichen Grüßen
{firma}`,
  },
  {
    key: 'offer',
    subject: 'Unser Angebot {angebotNummer}',
    body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen unser Angebot {angebotNummer} unterbreiten zu dürfen.
Das Angebot finden Sie im Anhang. Es ist gültig bis {angebotGültigBis}.

Mit freundlichen Grüßen
{firma}`,
  },
  {
    key: 'order_confirmation',
    subject: 'Auftragsbestätigung {angebotNummer}',
    body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihren Auftrag. Anbei senden wir Ihnen die Auftragsbestätigung zu {angebotNummer}.
Wir bestätigen den Auftrag und melden uns mit dem geplanten Termin.

Mit freundlichen Grüßen
{firma}`,
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

Vielen Dank und mit freundlichen Grüßen
{firma}`,
  },
  {
    // Twice-yearly nudge to customers whose tires are stored on the
    // workshop premises. The body uses `{kundeVorname}` so we can
    // greet the customer by first name when available; the mail
    // service falls back to "{kundeName}" when it isn't.
    key: 'tire_reminder',
    subject: 'Termin für den Reifenwechsel buchen - {firma}',
    body: `Hallo {kundeVorname},

die nächste Saison rückt näher. Wir möchten Sie freundlich daran erinnern, einen Termin für den Reifenwechsel bei uns zu buchen. Ihre eingelagerten Reifen sind bereit.

Bitte melden Sie sich kurz telefonisch unter {firmaTelefon} oder per E-Mail an {firmaMail}, dann finden wir gemeinsam einen passenden Termin.

Mit freundlichen Grüßen
{firma}`,
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
{firma}`,
  },
  {
    key: 'mailing',
    subject: 'Information von {firma}',
    body: `Sehr geehrte Damen und Herren,

wir möchten Sie auf folgendes hinweisen:

[Hier Ihren Text einfügen]

Bei Rückfragen erreichen Sie uns unter {firmaTelefon} oder per E-Mail unter {firmaMail}.

Mit freundlichen Grüßen
{firma}`,
  },
]
