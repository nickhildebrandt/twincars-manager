/**
 * Every discriminator of the application: the allowed values and their German
 * labels, in one place.
 *
 * Three things are derived from these lists and cannot drift apart:
 *
 *   1. the `CHECK` constraint in the database (`server/database/schema/`)
 *   2. the Valibot schema that guards the boundary (`shared/schemas/`)
 *   3. the German label the user reads
 *
 * The predecessor had none of that. Values were `varchar` without a check, so
 * a service could write anything; labels lived in two maps that disagreed with
 * each other, and a document type without a label leaked its English value
 * into the interface (B-011, B-335, B-411).
 *
 * **Codes are English, labels are German.** The predecessor stored the German
 * label itself as the payment method, which is why "Überweisung" appeared in
 * SQL queries. Since the new installation starts empty (E-20), the codes are
 * clean from the first row.
 */

/** A value list plus its labels. `values` feeds the database and the schema. */
export type Domain<T extends string> = {
  readonly values: readonly T[]
  readonly labels: Readonly<Record<T, string>>
}

/** Builds a domain from a label map, so a value can never miss its label. */
function domain<T extends string>(labels: Record<T, string>): Domain<T> {
  return { values: Object.keys(labels) as T[], labels }
}

/** The German label, or a dash. Never the raw value — that is the leak B-011 describes. */
export function labelOf<T extends string>(
  from: Domain<T>,
  value: string | null | undefined,
): string {
  if (!value) return '—'
  return (from.labels as Record<string, string>)[value] ?? '—'
}

/** `[{ value, label }]` for a select or a filter bar. */
export function optionsOf<T extends string>(from: Domain<T>): { value: T, label: string }[] {
  return from.values.map(value => ({ value, label: from.labels[value] }))
}

/* ── documents ────────────────────────────────────────────────────────── */

/**
 * Two Beleg kinds, and no more (M-15).
 *
 * The workshop writes an estimate and then an invoice. An *Angebot* is legally
 * binding; a *Kostenvoranschlag* is an estimate that may be exceeded by about
 * 15 %. In a workshop the second is always what is meant, so the first is gone,
 * along with the Auftragsbestätigung nobody wrote.
 *
 * A cancellation is **not** a kind of its own: it is an invoice with status
 * `storno` that points at the original (ADR-015).
 */
export const documentTypes = domain({
  cost_estimate: 'Kostenvoranschlag',
  invoice: 'Rechnung',
})
export type DocumentType = typeof documentTypes.values[number]

/**
 * Beleg lifecycle.
 *
 * The predecessor also carried `draft`, `open` and `overdue`. `draft` meant
 * exactly what `created` means; `open` and `overdue` are **derived** from the
 * payments and the due date, not stored. Keeping them as stored values is what
 * let the filters and the labels disagree.
 */
export const documentStatuses = domain({
  draft: 'Entwurf',
  created: 'Angelegt',
  sent: 'Versendet',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  storno: 'Stornorechnung',
  converted: 'In Rechnung überführt',
})

/**
 * A draft carries **no number** (M-14).
 *
 * The number is drawn when the document is issued, so deleting a draft leaves
 * no gap in the sequence — and gaps in an invoice sequence have to be explained
 * to the tax office.
 */
export const DRAFT_STATUS = 'draft'
export type DocumentStatus = typeof documentStatuses.values[number]

/** Which statuses count as issued — one definition for turnover (E-15). */
export const ISSUED_DOCUMENT_STATUSES = ['sent', 'paid', 'cancelled', 'storno'] as const

/**
 * How the customer pays (M-16).
 *
 * Two ways, because those are the two the workshop has. **Only cash reaches
 * the cash book** — a card payment never touches the till, so booking it there
 * would make the counted cash disagree with the book (P-07).
 */
export const paymentMethods = domain({
  cash: 'Bar',
  card: 'Karte',
})

/** Payment methods that belong in the cash book. */
export const CASH_BOOK_METHODS = ['cash'] as const
export type PaymentMethod = typeof paymentMethods.values[number]

/** What a billed line is. Drives grouping and wording, never the price. */
export const itemLineKinds = domain({
  article: 'Artikel',
  service: 'Leistung',
  material: 'Material',
  pass_through: 'Durchlaufposten',
  vehicle: 'Fahrzeug',
})
export type ItemLineKind = typeof itemLineKinds.values[number]

/** The catalogue. A vehicle is never a catalogue entry, only a billed line. */
export const itemKinds = domain({
  article: 'Artikel',
  service: 'Leistung',
  material: 'Material',
  pass_through: 'Durchlaufposten',
})
export type ItemKind = typeof itemKinds.values[number]

/* ── work orders ──────────────────────────────────────────────────────── */

/** The three columns of the shop-floor board. */
export const workOrderStatuses = domain({
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Abgeschlossen',
})
export type WorkOrderStatus = typeof workOrderStatuses.values[number]

/** Hours worked, or a part consumed. */
export const workOrderItemKinds = domain({
  labor: 'Arbeitszeit',
  material: 'Material',
})
export type WorkOrderItemKind = typeof workOrderItemKinds.values[number]

/* ── calendar ─────────────────────────────────────────────────────────── */

/** A customer appointment, or a day the workshop stays shut. */
export const calendarKinds = domain({
  appointment: 'Termin',
  closure: 'Betriebsschließung',
})
export type CalendarKind = typeof calendarKinds.values[number]

/** Appointment lifecycle. A closure carries no status at all. */
export const appointmentStatuses = domain({
  scheduled: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
})
export type AppointmentStatus = typeof appointmentStatuses.values[number]

/* ── people ───────────────────────────────────────────────────────────── */

export const absenceTypes = domain({
  vacation: 'Urlaub',
  sick: 'Krankheit',
  other: 'Sonstiges',
})
export type AbsenceType = typeof absenceTypes.values[number]

export const absenceStatuses = domain({
  planned: 'Geplant',
  approved: 'Genehmigt',
  cancelled: 'Abgesagt',
})
export type AbsenceStatus = typeof absenceStatuses.values[number]

/** Private person, company, or an eBay buyer (E-16). */
export const customerKinds = domain({
  privat: 'Privatkunde',
  firma: 'Firmenkunde',
  ebay: 'eBay-Käufer',
})
export type CustomerKind = typeof customerKinds.values[number]

/* ── communication ────────────────────────────────────────────────────── */

/**
 * What happened to one outgoing mail — named honestly (M-34).
 *
 * Through our own outgoing server the only thing that can be established is
 * that the server **accepted** the mail. Whether it was delivered is not
 * knowable, so nothing here says "delivered".
 */
export const messageStatuses = domain({
  wartend: 'In Warteschlange',
  angenommen: 'Vom Server angenommen',
  abgelehnt: 'Vom Server abgelehnt',
  fehler: 'Fehler beim Versand',
})
export type MessageStatus = typeof messageStatuses.values[number]

/**
 * Which business event produced a mail.
 *
 * There is one reminder type, not three: the escalation levels were dropped,
 * every reminder uses the same friendly wording.
 */
export const messageKinds = domain({
  invoice: 'Rechnung',
  cost_estimate: 'Kostenvoranschlag',
  reminder: 'Zahlungserinnerung',
  mailing: 'Rundschreiben',
  tire_reminder: 'Reifen-Erinnerung',
  appointment_confirmation: 'Terminbestätigung',
  inquiry_answer: 'Antwort auf eine Anfrage',
})
export type MessageKind = typeof messageKinds.values[number]

/**
 * What an outgoing mail was about (M-34).
 *
 * The predecessor's log pointed at a document and nothing else, although
 * payment reminders, tire reminders and answers to enquiries go out the same
 * way. Two fields now: the kind of thing, and its id.
 */
export const messageSubjects = domain({
  document: 'Beleg',
  reminder: 'Zahlungserinnerung',
  wheel_set: 'Radsatz',
  inquiry: 'Anfrage',
  mailing: 'Rundschreiben',
})
export type MessageSubject = typeof messageSubjects.values[number]

/** Mails that carry a PDF. Everything else is text only. */
export const MESSAGE_KINDS_WITH_PDF = ['invoice', 'cost_estimate', 'reminder'] as const

/**
 * How far an enquiry has come (M-33).
 *
 * Enquiries are worked on **in the application**, not in a mailbox. That way
 * nothing gets lost, and it is visible how many turned into orders.
 */
export const inquiryStatuses = domain({
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
})
export type InquiryStatus = typeof inquiryStatuses.values[number]

/** What a contact-form enquiry refers to. */
export const inquiryReferenceTypes = domain({
  'used-car': 'Fahrzeug',
  'article': 'Artikel',
  'tire': 'Reifen',
  'general': 'Allgemein',
})
export type InquiryReferenceType = typeof inquiryReferenceTypes.values[number]

/** Payment reminders. */
export const reminderStatuses = domain({
  open: 'Angelegt',
  sent: 'Versendet',
  paid: 'Bezahlt',
  cancelled: 'Zurückgezogen',
})
export type ReminderStatus = typeof reminderStatuses.values[number]

/**
 * Woraus ein Schnappschuss genommen wurde (M-42).
 *
 * When a contract-effective document is issued, the state of everything it
 * refers to is frozen alongside it. The list is deliberately short: only
 * records that can change *after* the document went out and would then make
 * the document look wrong.
 */
export const snapshotEntities = domain({
  customers: 'Kunde',
  vehicles: 'Fahrzeug',
  company_settings: 'Firma',
})
export type SnapshotEntity = typeof snapshotEntities.values[number]

/* ── vehicles and tires ───────────────────────────────────────────────── */

/**
 * What the vehicle is to the business right now (M-05).
 *
 * The predecessor had no such field: a vehicle was either attached to a
 * customer or it was stock, and deleting the customer took the car with it.
 * A car without a keeper is not a data error.
 */
export const vehicleStatuses = domain({
  kundenfahrzeug: 'Kundenfahrzeug',
  bestand: 'Im Bestand',
  verkauft: 'Verkauft',
})
export type VehicleStatus = typeof vehicleStatuses.values[number]

/**
 * Warum ein Fahrzeug den Halter wechselte (M-43).
 *
 * The keeper history answered *who* and *when*, never *why*. Without the
 * reason a row reads the same whether the business bought the car, sold it, or
 * merely corrected a typo — and exactly that difference is what somebody looks
 * for two years later.
 */
export const ownerChangeReasons = domain({
  ankauf: 'Ankauf',
  verkauf: 'Verkauf',
  halterwechsel: 'Halterwechsel',
  uebernahme: 'Übernahme aus dem Altsystem',
  korrektur: 'Korrektur',
})
export type OwnerChangeReason = typeof ownerChangeReasons.values[number]

/**
 * Wohin ein Fahrzeug ging (M-43).
 *
 * „Wo es hingeht" is the part the predecessor never recorded. A sale row had a
 * customer or nothing at all, so a car sold to a dealer, exported, or scrapped
 * simply stopped having a history.
 */
export const vehicleExitKinds = domain({
  kunde: 'An Kunden verkauft',
  haendler: 'An Händler verkauft',
  export: 'Export',
  verwertung: 'Verwertung',
  ruecknahme: 'Rücknahme durch Vorbesitzer',
})
export type VehicleExitKind = typeof vehicleExitKinds.values[number]

/** Whether a stock vehicle is still on offer. */
export const listingStatuses = domain({
  available: 'Verfügbar',
  sold: 'Verkauft',
})
export type ListingStatus = typeof listingStatuses.values[number]

/**
 * Tire season.
 *
 * The predecessor spelled this German and capitalised in the catalogue
 * (`Sommer`) and English and lower case in the storage table (`summer`) — the
 * same concept in two vocabularies, which is why the search had its own third
 * label map (B-011). One vocabulary now.
 */
export const tireSeasons = domain({
  summer: 'Sommer',
  winter: 'Winter',
  allseason: 'Ganzjahres',
})
export type TireSeason = typeof tireSeasons.values[number]

/** Radial or diagonal carcass. */
export const tireConstructions = domain({
  R: 'Radial',
  D: 'Diagonal',
})
export type TireConstruction = typeof tireConstructions.values[number]

/**
 * Where a wheel set is (M-17).
 *
 * Exactly one set per vehicle is fitted; the rest are in the rack. Changing
 * over swaps the two states (P-03).
 */
export const wheelSetStates = domain({
  montiert: 'Montiert',
  eingelagert: 'Eingelagert',
})
export type WheelSetState = typeof wheelSetStates.values[number]

/** Which half of the year a tire reminder belongs to. */
export const reminderSeasons = domain({
  spring: 'Frühjahr',
  autumn: 'Herbst',
})
export type ReminderSeason = typeof reminderSeasons.values[number]

/* ── bookkeeping ──────────────────────────────────────────────────────── */

export const ledgerDirections = domain({
  income: 'Einnahme',
  expense: 'Ausgabe',
})
export type LedgerDirection = typeof ledgerDirections.values[number]

export const ledgerPaymentStatuses = domain({
  paid: 'Bezahlt',
  open: 'Offen',
  partial: 'Teilweise gezahlt',
})
export type LedgerPaymentStatus = typeof ledgerPaymentStatuses.values[number]

/**
 * Where a booking came from (M-25).
 *
 * In the reference year about 150 of 809 bookings could come from the
 * application — workshop invoices, vehicle and tire sales, supplier credits.
 * The other 630 are supplier purchases and inspection fees, entered by hand.
 */
export const ledgerSources = domain({
  anwendung: 'Aus der Anwendung',
  manuell: 'Von Hand erfasst',
})
export type LedgerSource = typeof ledgerSources.values[number]

/**
 * What happened to a record (M-01).
 *
 * One entry per save, not per field — that is what a timeline wants to show.
 * The changed fields with their old and new values ride along in the entry.
 */
export const auditActions = domain({
  angelegt: 'Angelegt',
  geaendert: 'Geändert',
  geloescht: 'Gelöscht',
  archiviert: 'Archiviert',
  reaktiviert: 'Reaktiviert',
  angemeldet: 'Angemeldet',
  abgemeldet: 'Abgemeldet',
  abgewiesen: 'Zugriff abgewiesen',
  gesperrt: 'Gesperrt',
  entsperrt: 'Entsperrt',
  exportiert: 'Exportiert',
  ausgefuehrt: 'Ausgeführt',
})
export type AuditAction = typeof auditActions.values[number]

/**
 * Wie schwer ein Protokolleintrag wiegt (M-39).
 *
 * Ein Protokoll, in dem alles gleich aussieht, ist eine Wand aus Zeilen. Das
 * Gewicht entscheidet, was in der Oberfläche hervorsticht — und wie lange der
 * Eintrag aufbewahrt wird (P-20).
 */
export const auditSeverities = domain({
  info: 'Normal',
  warnung: 'Auffällig',
  sicherheit: 'Sicherheit',
})
export type AuditSeverity = typeof auditSeverities.values[number]

/**
 * Warum ein Anmeldeversuch scheiterte (M-36).
 *
 * In einem Wort, damit sich das Protokoll zählen lässt: „zwölfmal `passwort`
 * von einer Adresse" ist eine Auskunft, ein Fließtext nicht.
 *
 * Drei Wörter sehen sich ähnlich und meinen Verschiedenes:
 *
 *   - `deaktiviert` — der Administrator hat das Konto abgeschaltet, etwa weil
 *     jemand länger weg ist. Eine Verwaltungshandlung ohne Anlass.
 *   - `kontosperre` — zu viele Fehlversuche auf dieses Konto (P-13). Endet von
 *     selbst, außer auf der letzten Stufe.
 *   - `adresssperre` — zu viele Fehlversuche von diesem Anschluss (P-15).
 *
 * Wer sie gleich nennt, sieht in der Liste nicht mehr, ob jemand ausgesperrt
 * wurde oder angegriffen wird.
 */
export const signInFailures = domain({
  passwort: 'Falsches Passwort',
  unbekannt: 'Unbekannter Benutzername',
  deaktiviert: 'Konto deaktiviert',
  drossel: 'Zu viele Versuche in kurzer Zeit',
  kontosperre: 'Konto gesperrt',
  adresssperre: 'Anschluss gesperrt',
})
export type SignInFailure = typeof signInFailures.values[number]

/** One row per number sequence. Each is a separate, gapless counter. */
export const numberKinds = domain({
  invoice: 'Rechnung',
  cost_estimate: 'Kostenvoranschlag',
  storno: 'Stornorechnung',
  reminder: 'Zahlungserinnerung',
  customer: 'Kunde',
  tire: 'Reifen',
  wheel_set: 'Radsatz',
  work_order: 'Auftrag',
})
export type NumberKind = typeof numberKinds.values[number]

/* ── integrations and settings ────────────────────────────────────────── */

/** eBay listing state. An ended listing is kept as a tombstone, never deleted. */
export const ebayListingStatuses = domain({
  active: 'Aktiv',
  ended: 'Beendet',
})
export type EbayListingStatus = typeof ebayListingStatuses.values[number]

/**
 * How an import run ended.
 *
 * One vocabulary for both import kinds. The predecessor said `success` for
 * eBay and `completed` for the Access import, which meant every list that
 * showed both needed a special case.
 */
export const importRunStatuses = domain({
  running: 'Läuft',
  success: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
})
export type ImportRunStatus = typeof importRunStatuses.values[number]

export const ebayEnvironments = domain({
  production: 'Produktion',
  sandbox: 'Testumgebung',
})
export type EbayEnvironment = typeof ebayEnvironments.values[number]

/** How the mail server is reached. */
export const smtpSecurities = domain({
  none: 'Unverschlüsselt',
  STARTTLS: 'STARTTLS',
  TLS: 'TLS',
})
export type SmtpSecurity = typeof smtpSecurities.values[number]

/** How letters address the customer. */
export const salutationStyles = domain({
  Sie: 'Sie',
  Du: 'Du',
})
export type SalutationStyle = typeof salutationStyles.values[number]
