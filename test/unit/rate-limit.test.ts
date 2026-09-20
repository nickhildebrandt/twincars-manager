/**
 * The counter that protects the sign-in endpoint and the public interface.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consume, resetRateLimits, trackedKeys } from '../../server/utils/rate-limit.ts'

afterEach(() => {
  resetRateLimits()
  vi.useRealTimers()
})

describe('consume', () => {
  it('lässt die erlaubte Anzahl durch', () => {
    for (let call = 1; call <= 10; call++) {
      expect(consume('client-a', 10).allowed, `Aufruf ${call}`).toBe(true)
    }
  })

  it('sperrt den Aufruf danach', () => {
    for (let call = 0; call < 10; call++) consume('client-b', 10)
    const result = consume('client-b', 10)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(60)
  })

  it('zählt jeden Schlüssel für sich', () => {
    for (let call = 0; call < 10; call++) consume('client-c', 10)
    expect(consume('client-c', 10).allowed).toBe(false)
    expect(consume('client-d', 10).allowed).toBe(true)
  })

  it('zählt die verbleibenden Aufrufe herunter', () => {
    expect(consume('client-e', 3).remaining).toBe(2)
    expect(consume('client-e', 3).remaining).toBe(1)
    expect(consume('client-e', 3).remaining).toBe(0)
  })

  it('öffnet nach einer Minute wieder', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T07:00:00Z'))
    for (let call = 0; call < 10; call++) consume('client-f', 10)
    expect(consume('client-f', 10).allowed).toBe(false)

    vi.setSystemTime(new Date('2026-09-13T07:01:01Z'))
    expect(consume('client-f', 10).allowed).toBe(true)
  })

  it('lässt bei einem Grenzwert von null nichts durch', () => {
    expect(consume('client-g', 0).allowed).toBe(false)
  })
})

describe('Die Kehrschleife', () => {
  it('räumt Zähler weg, deren Fenster lange vorbei ist', () => {
    // Ohne sie wüchse der Speicher mit jedem neuen Schlüssel weiter — eine
    // Flut aus lauter verschiedenen Adressen wäre ein Angriffsweg.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T07:00:00Z'))

    consume('alt', 10)
    expect(trackedKeys()).toBe(1)

    // Fünf Minuten später läuft die Kehrschleife und findet einen alten Eimer.
    vi.setSystemTime(new Date('2026-09-13T07:06:00Z'))
    vi.advanceTimersByTime(5 * 60_000)

    expect(trackedKeys()).toBe(0)
  })

  it('lässt einen frischen Zähler stehen', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T07:00:00Z'))
    consume('frisch', 10)

    vi.setSystemTime(new Date('2026-09-13T07:05:01Z'))
    consume('frisch', 10)
    vi.advanceTimersByTime(5 * 60_000)

    expect(trackedKeys()).toBe(1)
  })
})

describe('resetRateLimits', () => {
  it('räumt alle Zähler weg', () => {
    consume('client-h', 10)
    expect(trackedKeys()).toBe(1)
    resetRateLimits()
    expect(trackedKeys()).toBe(0)
  })
})
