import { describe, expect, it } from 'vitest'
import {
  appointmentStatusLabel,
  documentStatusBadge,
  documentStatusLabel,
  documentTypeLabel,
  itemKindLabel,
  paymentStatusLabel,
  reminderLevelBadge,
  reminderLevelLabel,
  sentMessageStatusLabel
} from './status-labels'

describe('documentStatusLabel', () => {
  it('maps every documented status to a German term', () => {
    // `draft` is an alias for `created` — both render as "Angelegt"
    // (the "Entwurf" wording was removed in the unified status flow).
    expect(documentStatusLabel('draft')).toBe('Angelegt')
    expect(documentStatusLabel('created')).toBe('Angelegt')
    expect(documentStatusLabel('sent')).toBe('Versendet')
    expect(documentStatusLabel('open')).toBe('Offen')
    expect(documentStatusLabel('paid')).toBe('Bezahlt')
    expect(documentStatusLabel('cancelled')).toBe('Storniert')
    expect(documentStatusLabel('converted')).toBe('In Rechnung überführt')
    expect(documentStatusLabel('overdue')).toBe('Überfällig')
  })

  it('falls back to a dash for unknown / null statuses', () => {
    expect(documentStatusLabel(null)).toBe('—')
    expect(documentStatusLabel(undefined)).toBe('—')
    expect(documentStatusLabel('foo')).toBe('—')
  })

  it('never returns the original english string for known states', () => {
    for (const en of ['draft', 'paid', 'sent', 'overdue']) {
      const out = documentStatusLabel(en)
      expect(out).not.toBe(en)
    }
  })
})

describe('documentStatusBadge', () => {
  it('reflects the lifecycle: created → sent → paid', () => {
    expect(documentStatusBadge('created')).toBe('badge-warning')
    expect(documentStatusBadge('draft')).toBe('badge-warning')
    expect(documentStatusBadge('sent')).toBe('badge-info')
    expect(documentStatusBadge('open')).toBe('badge-info')
    expect(documentStatusBadge('paid')).toBe('badge-success')
    expect(documentStatusBadge('overdue')).toBe('badge-error')
    expect(documentStatusBadge('cancelled')).toBe('badge-ghost')
    expect(documentStatusBadge('converted')).toBe('badge-success')
  })
})

describe('paymentStatusLabel', () => {
  it('maps payment statuses', () => {
    expect(paymentStatusLabel('paid')).toBe('Bezahlt')
    expect(paymentStatusLabel('open')).toBe('Offen')
    expect(paymentStatusLabel('partial')).toBe('Teilweise gezahlt')
  })
})

describe('appointmentStatusLabel', () => {
  it('maps appointment statuses', () => {
    expect(appointmentStatusLabel('scheduled')).toBe('Geplant')
    expect(appointmentStatusLabel('completed')).toBe('Abgeschlossen')
    expect(appointmentStatusLabel('cancelled')).toBe('Abgesagt')
  })
})

describe('sentMessageStatusLabel', () => {
  it('maps sent-message statuses', () => {
    expect(sentMessageStatusLabel('sent')).toBe('Gesendet')
    expect(sentMessageStatusLabel('failed')).toBe('Fehlgeschlagen')
    expect(sentMessageStatusLabel('pending')).toBe('In Warteschlange')
  })
})

describe('reminderLevelLabel', () => {
  it('labels each reminder count as a friendly Zahlungserinnerung', () => {
    expect(reminderLevelLabel(0)).toBe('Noch keine Zahlungserinnerung')
    expect(reminderLevelLabel(1)).toBe('Zahlungserinnerung')
    expect(reminderLevelLabel(2)).toBe('2. Zahlungserinnerung')
    expect(reminderLevelLabel(3)).toBe('3. Zahlungserinnerung')
    expect(reminderLevelLabel(4)).toBe('4. Zahlungserinnerung')
  })

  it('keeps every sent reminder on the same info badge — no escalation', () => {
    expect(reminderLevelBadge(0)).toBe('badge-ghost')
    expect(reminderLevelBadge(1)).toBe('badge-info')
    expect(reminderLevelBadge(2)).toBe('badge-info')
    expect(reminderLevelBadge(3)).toBe('badge-info')
    expect(reminderLevelBadge(4)).toBe('badge-info')
  })
})

describe('documentTypeLabel', () => {
  it('translates each document type to German', () => {
    expect(documentTypeLabel('invoice')).toBe('Rechnung')
    expect(documentTypeLabel('offer')).toBe('Angebot')
    expect(documentTypeLabel('cost_estimate')).toBe('Kostenvoranschlag')
    expect(documentTypeLabel('order_confirmation')).toBe('Auftragsbestätigung')
    expect(documentTypeLabel('reminder')).toBe('Zahlungserinnerung')
    expect(documentTypeLabel('reminder_1')).toBe('Zahlungserinnerung')
    expect(documentTypeLabel('reminder_2')).toBe('Zahlungserinnerung')
    expect(documentTypeLabel('reminder_3')).toBe('Zahlungserinnerung')
    expect(documentTypeLabel('mailing')).toBe('Serienbrief')
  })
})

describe('itemKindLabel', () => {
  it('translates known item kinds', () => {
    expect(itemKindLabel('service')).toBe('Leistung')
    expect(itemKindLabel('material')).toBe('Material')
    expect(itemKindLabel('article')).toBe('Artikel')
    expect(itemKindLabel('pass_through')).toBe('Durchlaufposten')
    expect(itemKindLabel('vehicle')).toBe('Fahrzeug')
  })
})
