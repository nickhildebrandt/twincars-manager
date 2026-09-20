/**
 * Welche Adresse gezählt wird.
 *
 * B-003, B-054: der Vorgänger nahm `x-forwarded-for` bedingungslos. Ohne Proxy
 * davor schickte ein Angreifer bei jedem Versuch einen anderen Wert, landete
 * jedes Mal in einem frischen Eimer und der Brute-Force-Schutz wirkte nicht.
 */
import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { clientIp, trustsProxy } from '../../server/utils/client-ip.ts'

/** Nur die beiden Dinge, die der Helfer liest. */
function eventWith(headers: Record<string, string>, socket = '198.51.100.9'): H3Event {
  return {
    context: {},
    node: { req: { headers, socket: { remoteAddress: socket } } },
    headers: new Headers(headers),
  } as unknown as H3Event
}

describe('trustsProxy', () => {
  it.each([
    ['on', true],
    ['off', false],
    ['', false],
    [undefined, false],
    ['ja', false],
  ])('liest %s als %s', (setting, expected) => {
    expect(trustsProxy(setting)).toBe(expected)
  })
})

describe('clientIp ohne konfigurierten Proxy', () => {
  it('nimmt die Socket-Adresse', () => {
    expect(clientIp(eventWith({}), false)).toBe('198.51.100.9')
  })

  it('ignoriert einen behaupteten Weiterleitungs-Header', () => {
    // Das ist der Kern: ohne Proxy ist der Header frei erfunden.
    const event = eventWith({ 'x-forwarded-for': '203.0.113.1' })
    expect(clientIp(event, false)).toBe('198.51.100.9')
  })

  it('liefert für jede behauptete Adresse dieselbe Antwort', () => {
    const first = clientIp(eventWith({ 'x-forwarded-for': '203.0.113.1' }), false)
    const second = clientIp(eventWith({ 'x-forwarded-for': '203.0.113.2' }), false)
    expect(first).toBe(second)
  })
})

describe('clientIp hinter einem Proxy', () => {
  it('nimmt den ersten Eintrag der Kette', () => {
    const event = eventWith({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 10.0.0.2' })
    expect(clientIp(event, true)).toBe('203.0.113.1')
  })

  it('verträgt einen einzelnen Eintrag', () => {
    expect(clientIp(eventWith({ 'x-forwarded-for': '203.0.113.1' }), true)).toBe('203.0.113.1')
  })

  it('fällt ohne Header auf die Socket-Adresse zurück', () => {
    expect(clientIp(eventWith({}), true)).toBe('198.51.100.9')
  })

  it('fällt bei leerem Header auf die Socket-Adresse zurück', () => {
    expect(clientIp(eventWith({ 'x-forwarded-for': '  ' }), true)).toBe('198.51.100.9')
  })
})

describe('Regression', () => {
  it('B-003: ein erfundener Weiterleitungs-Header umgeht die Drossel nicht', () => {
    // Ohne konfigurierten Proxy landen alle Versuche im selben Eimer,
    // gleichgültig, welche Adresse der Aufrufer behauptet.
    const claimed = Array.from({ length: 20 }, (_, index) =>
      clientIp(eventWith({ 'x-forwarded-for': `203.0.113.${index}` }), false))
    expect(new Set(claimed).size).toBe(1)
  })

  it('B-054: mit konfiguriertem Proxy zählt die weitergereichte Adresse', () => {
    // Dann ist der Header von einem Gerät gesetzt, dem wir vertrauen.
    const claimed = Array.from({ length: 3 }, (_, index) =>
      clientIp(eventWith({ 'x-forwarded-for': `203.0.113.${index}` }), true))
    expect(new Set(claimed).size).toBe(3)
  })
})
