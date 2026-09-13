/**
 * One business time zone, everywhere.
 *
 * B-028: the predecessor used the container's local time for number ranges
 * and UTC for the dashboard. In Europe/Berlin that means the dashboard showed
 * yesterday during the first one or two hours of every day, and the year in an
 * invoice number depended on how the container was configured. Every case
 * below is one of those boundaries.
 */
import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TIMEZONE,
  addDays,
  businessMonth,
  businessWeekday,
  businessYear,
  daysBetween,
  formatDate,
  formatDateTime,
  fromIsoDate,
  isWorkday,
  isoDate,
  startOfMonth,
  today,
} from '#shared/datetime'

describe('die Geschäftszeitzone', () => {
  it('ist Europe/Berlin', () => {
    expect(BUSINESS_TIMEZONE).toBe('Europe/Berlin')
  })
})

describe('isoDate', () => {
  it('nennt den Tag, an dem der Betrieb gerade ist', () => {
    // 22:30 UTC am 12. September ist in Berlin bereits der 13. September.
    expect(isoDate(new Date('2026-09-12T22:30:00Z'))).toBe('2026-09-13')
  })

  it('kippt nicht zu früh in den neuen Tag', () => {
    // 21:59 UTC ist in Berlin (Sommerzeit, UTC+2) noch 23:59 desselben Tages.
    expect(isoDate(new Date('2026-09-12T21:59:00Z'))).toBe('2026-09-12')
  })

  it('rechnet auch in der Winterzeit richtig', () => {
    // Im Januar gilt UTC+1: 23:30 UTC ist schon der Folgetag.
    expect(isoDate(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
    expect(isoDate(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
  })

  it('liefert heute ohne Argument', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('businessYear und businessMonth', () => {
  it('nennen das Jahr, das in eine Belegnummer gehört', () => {
    // Silvester 23:30 UTC ist in Berlin bereits Neujahr — die Rechnung trägt
    // die neue Jahreszahl.
    const silvester = new Date('2026-12-31T23:30:00Z')
    expect(businessYear(silvester)).toBe(2027)
    expect(businessMonth(silvester)).toBe(1)
  })

  it('nennen den Monat, den das Kassenbuch meint', () => {
    const monatswechsel = new Date('2026-08-31T22:30:00Z')
    expect(businessMonth(monatswechsel)).toBe(9)
  })
})

describe('Wochentage', () => {
  it.each([
    ['2026-09-14T10:00:00Z', 1, true],
    ['2026-09-18T10:00:00Z', 5, true],
    ['2026-09-19T10:00:00Z', 6, false],
    ['2026-09-20T10:00:00Z', 0, false],
  ])('%s ist Wochentag %s, Werktag: %s', (moment, weekday, workday) => {
    expect(businessWeekday(new Date(moment))).toBe(weekday)
    expect(isWorkday(new Date(moment))).toBe(workday)
  })

  it('zählt den späten Sonntagabend noch als Sonntag', () => {
    // 22:30 UTC am Sonntag ist in Berlin bereits Montag — der Zeitplan läuft.
    expect(isWorkday(new Date('2026-09-20T22:30:00Z'))).toBe(true)
  })
})

describe('startOfMonth', () => {
  it('nennt den Monatsersten', () => {
    expect(startOfMonth(new Date('2026-09-13T12:00:00Z'))).toBe('2026-09-01')
  })
})

describe('addDays', () => {
  it.each([
    ['2026-09-13', 1, '2026-09-14'],
    ['2026-09-13', -1, '2026-09-12'],
    ['2026-09-30', 1, '2026-10-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-09-13', 14, '2026-09-27'],
  ])('%s plus %s Tage ist %s', (from, days, to) => {
    expect(addDays(from, days)).toBe(to)
  })

  it('überspringt die Zeitumstellung nicht', () => {
    // In der Nacht zum 25.10.2026 wird die Uhr zurückgestellt. Ein Kalendertag
    // bleibt trotzdem ein Kalendertag.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('daysBetween', () => {
  it.each([
    ['2026-09-13', '2026-09-27', 14],
    ['2026-09-27', '2026-09-13', -14],
    ['2026-09-13', '2026-09-13', 0],
    ['2026-10-24', '2026-10-26', 2],
  ])('von %s bis %s sind %s Tage', (from, to, days) => {
    expect(daysBetween(from, to)).toBe(days)
  })
})

describe('fromIsoDate', () => {
  it('liest ein Datum als Mittag, nicht als Mitternacht', () => {
    // Mitternacht UTC ist in manchen Zonen der Vortag — genau so entstehen
    // Datumsfehler um einen Tag.
    expect(fromIsoDate('2026-09-13')?.toISOString()).toBe('2026-09-13T12:00:00.000Z')
  })

  it.each(['', '13.09.2026', '2026-9-13', 'morgen'])('lehnt %s ab', (value) => {
    expect(fromIsoDate(value)).toBeNull()
  })
})

describe('formatDate', () => {
  it('schreibt deutsch', () => {
    expect(formatDate('2026-09-13')).toBe('13.09.2026')
  })

  it.each([null, undefined, ''])('zeigt für %s einen Gedankenstrich', (value) => {
    expect(formatDate(value)).toBe('—')
  })

  it('zeigt für Unsinn einen Gedankenstrich statt Invalid Date', () => {
    expect(formatDate('morgen')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('zeigt den Zeitpunkt in Berliner Zeit', () => {
    expect(formatDateTime('2026-09-13T05:30:00Z')).toBe('13.09.2026, 07:30')
  })

  it('zeigt für Unsinn einen Gedankenstrich', () => {
    expect(formatDateTime('irgendwann')).toBe('—')
  })
})

describe('Regression', () => {
  it('B-028: eine einzige Geschäftszeitzone entscheidet jede Tagesgrenze', () => {
    // Der Vorgänger nahm für Nummernkreise die Prozesszeit und für das
    // Dashboard UTC. Beides zusammen ergab in den ersten ein bis zwei Stunden
    // jedes Tages ein Dashboard, das den Vortag zeigte, und eine Jahreszahl in
    // der Rechnungsnummer, die von der Container-Einstellung abhing.
    const kurzNachMitternacht = new Date('2026-09-12T22:30:00Z')
    expect(isoDate(kurzNachMitternacht)).toBe('2026-09-13')
    expect(businessYear(kurzNachMitternacht)).toBe(2026)
    expect(startOfMonth(kurzNachMitternacht)).toBe('2026-09-01')

    const silvester = new Date('2026-12-31T23:30:00Z')
    expect(businessYear(silvester)).toBe(2027)
    expect(businessMonth(silvester)).toBe(1)

    // Und zwar unabhängig davon, wie der Prozess eingestellt ist: die
    // Umrechnung nennt die Zone ausdrücklich.
    expect(BUSINESS_TIMEZONE).toBe('Europe/Berlin')
  })
})
