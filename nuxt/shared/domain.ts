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
 * The four Beleg kinds. A cancellation is **not** a kind of its own: it is an
 * invoice with status `storno` that points at the original (ADR-015).
 */
export const documentTypes = domain({
  invoice: 'Rechnung',
  offer: 'Angebot',
  cost_estimate: 'Kostenvoranschlag',
  order_confirmation: 'Auftragsbestätigung',
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
  created: 'Angelegt',
  sent: 'Versendet',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  storno: 'Stornorechnung',
  converted: 'In Rechnung überführt',
})
export type DocumentStatus = typeof documentStatuses.values[number]

/** Which statuses count as issued — one definition for turnover (E-15). */
export const ISSUED_DOCUMENT_STATUSES = ['sent', 'paid', 'cancelled', 'storno'] as const

/** How the customer pays. The stored value is a code, the label is German. */
export const paymentMethods = domain({
  transfer: 'Überweisung',
  cash: 'Bar',
  direct_debit: 'Lastschrift',
  card: 'Karte',
})
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

/** What happened to one outgoing mail. */
export const messageStatuses = domain({
  pending: 'In Warteschlange',
  sent: 'Gesendet',
  failed: 'Fehlgeschlagen',
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
  offer: 'Angebot',
  cost_estimate: 'Kostenvoranschlag',
  order_confirmation: 'Auftragsbestätigung',
  reminder: 'Zahlungserinnerung',
  mailing: 'Rundschreiben',
  tire_reminder: 'Reifen-Erinnerung',
  appointment_confirmation: 'Terminbestätigung',
})
export type MessageKind = typeof messageKinds.values[number]

/** Mails that carry a PDF. Everything else is text only. */
export const MESSAGE_KINDS_WITH_PDF = [
  'invoice', 'offer', 'cost_estimate', 'order_confirmation', 'reminder',
] as const

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

/* ── vehicles and tires ───────────────────────────────────────────────── */

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

/** Where a booking came from. */
export const ledgerSources = domain({
  manual: 'Manuell erfasst',
  invoice: 'Aus einer Rechnung',
})
export type LedgerSource = typeof ledgerSources.values[number]

/** One row per number sequence. Each is a separate, gapless counter. */
export const numberKinds = domain({
  invoice: 'Rechnung',
  offer: 'Angebot',
  cost_estimate: 'Kostenvoranschlag',
  order_confirmation: 'Auftragsbestätigung',
  storno: 'Stornorechnung',
  reminder: 'Zahlungserinnerung',
  customer: 'Kunde',
  tire: 'Reifen',
  tire_storage: 'Reifeneinlagerung',
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
