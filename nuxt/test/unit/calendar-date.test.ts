/**
 * Die Grenze zwischen `YYYY-MM-DD` und dem Datumsobjekt der Oberfläche.
 *
 * Hier entstehen Datumsfehler um einen Tag: wer ein `Date` dazwischenschaltet,
 * bekommt bei Mitternacht UTC den Vortag. Ein Leistungsdatum, das einen Tag
 * daneben liegt, steht auf einer Rechnung.
 */
import { describe, expect, it } from 'vitest'
import {
  daysInMonth,
  fromCalendarDate,
  isIsoDate,
  isLeapYear,
  roundTrip,
  toCalendarDate,
} from '#shared/calendar-date'

describe('isIsoDate', () => {
  it.each(['2026-01-01', '2026-12-31', '2028-02-29', '1900-03-01'])('nimmt %s an', (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each([
    ['2026-13-01', 'Monat 13'],
    ['2026-00-01', 'Monat 0'],
    ['2026-02-30', '30. Februar'],
    ['2026-02-29', '29. Februar in einem Nicht-Schaltjahr'],
    ['1900-02-29', '1900 ist kein Schaltjahr'],
    ['2026-04-31', '31. April'],
    ['26-01-01', 'zweistelliges Jahr'],
    ['2026-1-1', 'ohne führende Null'],
    ['01.01.2026', 'deutsche Schreibweise'],
    ['', 'leer'],
  ])('lehnt %s ab (%s)', (value) => {
    expect(isIsoDate(value)).toBe(false)
  })

  it.each([null, undefined, 20260101, new Date()])('lehnt %s ab', (value) => {
    expect(isIsoDate(value)).toBe(false)
  })
})

describe('isLeapYear', () => {
  it.each([
    [2024, true],
    [2026, false],
    [1900, false],
    [2000, true],
    [2100, false],
  ])('%s ist ein Schaltjahr: %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected)
  })
})

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%s-%s hat %s Tage', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days)
  })
})

describe('Hin und zurück', () => {
  it.each([
    '2026-01-01',
    '2026-03-04',
    '2026-06-30',
    '2026-12-31',
    '2028-02-29',
    '1999-12-31',
    '2000-01-01',
  ])('%s bleibt unverändert', (value) => {
    expect(roundTrip(value)).toBe(value)
  })

  it('bleibt über jeden Tag eines Jahres unverändert', () => {
    // Der eigentliche Nachweis: nicht drei Stichproben, sondern 365 Tage.
    let date = new Date(Date.UTC(2026, 0, 1))
    for (let day = 0; day < 365; day++) {
      const value = date.toISOString().slice(0, 10)
      expect(roundTrip(value), value).toBe(value)
      date = new Date(date.getTime() + 86_400_000)
    }
  })

  it('verschiebt auch am Monatsersten nichts', () => {
    // Der klassische Fehler: Mitternacht UTC ist in manchen Zonen der Vortag,
    // und aus dem 1. März wird der 28. Februar.
    for (let month = 1; month <= 12; month++) {
      const value = `2026-${String(month).padStart(2, '0')}-01`
      expect(roundTrip(value), value).toBe(value)
    }
  })
})

describe('toCalendarDate', () => {
  it('zerlegt in Jahr, Monat, Tag', () => {
    const date = toCalendarDate('2026-03-04')!
    expect([date.year, date.month, date.day]).toEqual([2026, 3, 4])
  })

  it.each([null, undefined, '', 'morgen', '2026-02-30'])('gibt für %s nichts zurück', (value) => {
    expect(toCalendarDate(value)).toBeNull()
  })
})

describe('fromCalendarDate', () => {
  it('füllt Monat und Tag auf zwei Stellen auf', () => {
    expect(fromCalendarDate(toCalendarDate('2026-01-02'))).toBe('2026-01-02')
  })

  it('gibt für nichts nichts zurück', () => {
    expect(fromCalendarDate(null)).toBeNull()
  })
})
