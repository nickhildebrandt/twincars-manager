/**
 * Single source of truth for German labels of every status / state used in
 * the UI. Kept here so we can guarantee that **no English status string
 * ever leaks into the frontend** — every visible badge / tag goes through
 * `documentStatusLabel`, `paymentStatusLabel`, etc.
 *
 * Internal storage stays English (`'paid'`, `'open'`, …) because Drizzle
 * column unions are easier to type that way; only the rendered text is
 * German.
 */

/**
 * Document lifecycle. Both KV / Angebot and Rechnung share `created`,
 * `sent`, and `cancelled`. Rechnung adds `paid`. KV adds `converted`.
 *
 * GoBD-Storno adds `storno`: this is the discriminator for the
 * cancellation document (`type='invoice'`, `cancelsDocumentId` points
 * to the original). The original Rechnung itself flips to `cancelled`
 * + `cancelledAt` once a storno has been issued.
 *
 * Legacy values kept as aliases:
 *   - `draft`    → renders as "Angelegt" (== `created`).
 *   - `open`     → "Offen" (used in older queries to mean "not paid"; new
 *                  code should not write this).
 *   - `overdue`  → "Überfällig" (kept for historical UI badges).
 */
export type DocumentStatus =
  | 'draft'
  | 'created'
  | 'sent'
  | 'open'
  | 'paid'
  | 'cancelled'
  | 'storno'
  | 'converted'
  | 'overdue'

const documentStatusMap: Record<DocumentStatus, string> = {
  draft: 'Angelegt',
  created: 'Angelegt',
  sent: 'Versendet',
  open: 'Offen',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  storno: 'Stornorechnung',
  converted: 'In Rechnung überführt',
  overdue: 'Überfällig'
}

/** German label for a document status. Falls back to "—" for unknowns. */
export const documentStatusLabel = (
  status: string | null | undefined
): string =>
  status && status in documentStatusMap
    ? documentStatusMap[status as DocumentStatus]
    : '—'

/** DaisyUI badge class for a document status. */
export const documentStatusBadge = (
  status: string | null | undefined
): string => {
  switch (status) {
    case 'paid':
      return 'badge-success'
    case 'open':
    case 'sent':
      return 'badge-info'
    case 'overdue':
      return 'badge-error'
    case 'cancelled':
      return 'badge-ghost'
    case 'storno':
      return 'badge-error'
    case 'converted':
      return 'badge-success'
    case 'draft':
    case 'created':
    default:
      return 'badge-warning'
  }
}

/** Ledger entry payment status. */
export type PaymentStatus = 'paid' | 'open' | 'partial'

const paymentStatusMap: Record<PaymentStatus, string> = {
  paid: 'Bezahlt',
  open: 'Offen',
  partial: 'Teilweise gezahlt'
}

export const paymentStatusLabel = (
  status: string | null | undefined
): string =>
  status && status in paymentStatusMap
    ? paymentStatusMap[status as PaymentStatus]
    : '—'

export const paymentStatusBadge = (
  status: string | null | undefined
): string => {
  switch (status) {
    case 'paid':
      return 'badge-success'
    case 'partial':
      return 'badge-warning'
    case 'open':
      return 'badge-error'
    default:
      return 'badge-ghost'
  }
}

/** Appointment status. */
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

const appointmentStatusMap: Record<AppointmentStatus, string> = {
  scheduled: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt'
}

export const appointmentStatusLabel = (
  status: string | null | undefined
): string =>
  status && status in appointmentStatusMap
    ? appointmentStatusMap[status as AppointmentStatus]
    : '—'

export const appointmentStatusBadge = (
  status: string | null | undefined
): string => {
  switch (status) {
    case 'completed':
      return 'badge-success'
    case 'cancelled':
      return 'badge-ghost'
    case 'scheduled':
    default:
      return 'badge-info'
  }
}

/** Sent-message status (E-Mail history). */
export type SentMessageStatus = 'sent' | 'failed' | 'pending'

const sentMessageStatusMap: Record<SentMessageStatus, string> = {
  sent: 'Gesendet',
  failed: 'Fehlgeschlagen',
  pending: 'In Warteschlange'
}

export const sentMessageStatusLabel = (
  status: string | null | undefined
): string =>
  status && status in sentMessageStatusMap
    ? sentMessageStatusMap[status as SentMessageStatus]
    : '—'

export const sentMessageStatusBadge = (
  status: string | null | undefined
): string => {
  switch (status) {
    case 'sent':
      return 'badge-success'
    case 'failed':
      return 'badge-error'
    case 'pending':
      return 'badge-warning'
    default:
      return 'badge-ghost'
  }
}

/**
 * Reminder sequential counter → German label. There is no escalation
 * anymore — every call sends the same friendly "Zahlungserinnerung".
 * The label just communicates "no reminder yet" vs. "the N-th
 * Zahlungserinnerung has been sent".
 */
export const reminderLevelLabel = (
  level: number | null | undefined
): string => {
  if (!level || level <= 0) return 'Noch keine Zahlungserinnerung'
  if (level === 1) return 'Zahlungserinnerung'
  return `${level}. Zahlungserinnerung`
}

export const reminderLevelBadge = (
  level: number | null | undefined
): string => {
  if (!level || level <= 0) return 'badge-ghost'
  return 'badge-info'
}

/** Document / sent-message type label. */
export const documentTypeLabel = (type: string | null | undefined): string => {
  switch (type) {
    case 'invoice':
      return 'Rechnung'
    case 'offer':
      return 'Angebot'
    case 'cost_estimate':
      return 'Kostenvoranschlag'
    case 'order_confirmation':
      return 'Auftragsbestätigung'
    case 'reminder':
    case 'reminder_1':
    case 'reminder_2':
    case 'reminder_3':
      return 'Zahlungserinnerung'
    case 'customer_letter':
    case 'mailing':
      return 'Serienbrief'
    default:
      return type ?? '—'
  }
}

/** Item kind label. */
export const itemKindLabel = (kind: string | null | undefined): string => {
  switch (kind) {
    case 'service':
      return 'Leistung'
    case 'material':
      return 'Material'
    case 'pass_through':
      return 'Durchlaufposten'
    case 'article':
      return 'Artikel'
    case 'vehicle':
      return 'Fahrzeug'
    default:
      return kind ?? '—'
  }
}
