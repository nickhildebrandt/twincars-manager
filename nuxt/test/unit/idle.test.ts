/**
 * Wann eine Sitzung wegen Untätigkeit endet.
 *
 * B-013, B-072: beim Vorgänger zählte jeder Tab für sich und ohne Vorwarnung.
 * Ein im Hintergrund offener Tab meldete den Nutzer ab, während er in einem
 * anderen arbeitete, und ein halb ausgefülltes Formular war weg.
 */
import { describe, expect, it } from 'vitest'
import { IDLE_WARNING_SECONDS, formatCountdown, idleStateAt } from '#shared/idle'

const MINUTE = 60_000
const NOW = Date.UTC(2026, 8, 13, 7, 0, 0)

describe('idleStateAt', () => {
  it('ist bei frischer Aktivität aktiv', () => {
    expect(idleStateAt(NOW, NOW, 60)).toEqual({ phase: 'active', remainingSeconds: 3600 })
  })

  it('bleibt kurz vor der Vorwarnung aktiv', () => {
    const state = idleStateAt(NOW, NOW + 57 * MINUTE + 59_000, 60)
    expect(state.phase).toBe('active')
  })

  it('warnt in den letzten zwei Minuten', () => {
    const state = idleStateAt(NOW, NOW + 58 * MINUTE, 60)
    expect(state.phase).toBe('warning')
    expect(state.remainingSeconds).toBe(IDLE_WARNING_SECONDS)
  })

  it('zählt in der Vorwarnung herunter', () => {
    expect(idleStateAt(NOW, NOW + 59 * MINUTE, 60).remainingSeconds).toBe(60)
  })

  it('läuft nach der eingestellten Zeit ab', () => {
    expect(idleStateAt(NOW, NOW + 60 * MINUTE, 60)).toEqual({ phase: 'expired', remainingSeconds: 0 })
  })

  it('bleibt danach abgelaufen', () => {
    expect(idleStateAt(NOW, NOW + 600 * MINUTE, 60).phase).toBe('expired')
  })

  it('zählt Aktivität in einem anderen Tab mit', () => {
    // Der Kern von B-013: die letzte Aktivität kommt aus dem gemeinsamen
    // Speicher, nicht aus diesem Tab. Wer woanders tippt, bleibt angemeldet.
    const inAnotherTab = NOW + 59 * MINUTE
    expect(idleStateAt(inAnotherTab, NOW + 60 * MINUTE, 60).phase).toBe('active')
  })

  it('nimmt eine Aktivität aus der Zukunft als jetzt', () => {
    // Zwei Rechner mit leicht verschiedenen Uhren, oder ein von Hand
    // veränderter Wert: das darf niemanden abmelden.
    expect(idleStateAt(NOW + 10 * MINUTE, NOW, 60).phase).toBe('active')
  })

  it('berücksichtigt eine andere eingestellte Dauer', () => {
    expect(idleStateAt(NOW, NOW + 10 * MINUTE, 10).phase).toBe('expired')
    expect(idleStateAt(NOW, NOW + 9 * MINUTE, 10).phase).toBe('warning')
  })
})

describe('formatCountdown', () => {
  it.each([
    [120, '2:00'],
    [119, '1:59'],
    [60, '1:00'],
    [59, '0:59'],
    [5, '0:05'],
    [0, '0:00'],
    [-5, '0:00'],
  ])('zeigt %s Sekunden als %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text)
  })
})

describe('Regression', () => {
  it('B-013: ein ruhender Tab meldet den arbeitenden nicht ab', () => {
    // Beim Vorgänger zählte jeder Tab für sich. Tab A ruhte seit einer Stunde
    // und führte `signOut` aus — womit die Sitzung ALLER Tabs endete, auch die
    // des Tabs, in dem gerade getippt wurde.
    const lastActivityAnywhere = NOW + 59 * MINUTE
    const inTheQuietTab = idleStateAt(lastActivityAnywhere, NOW + 60 * MINUTE, 60)
    expect(inTheQuietTab.phase).toBe('active')
  })

  it('B-072: vor der Abmeldung wird gewarnt', () => {
    // Ohne Vorwarnung war ein halb ausgefülltes Formular weg.
    const state = idleStateAt(NOW, NOW + 58 * MINUTE, 60)
    expect(state.phase).toBe('warning')
    expect(state.remainingSeconds).toBe(IDLE_WARNING_SECONDS)
    expect(formatCountdown(state.remainingSeconds)).toBe('2:00')
  })
})
