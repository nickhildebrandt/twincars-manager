import { describe, expect, it } from 'vitest'

describe('Testumgebung (unit)', () => {
  it('läuft in der Zeitzone Europe/Berlin', () => {
    expect(process.env.TZ).toBe('Europe/Berlin')
  })

  it('rechnet Datumsgrenzen in deutscher Zeit', () => {
    // 2026-03-29 ist der Tag der Zeitumstellung; 00:30 lokal muss auf den
    // 29. fallen, nicht auf den 28.
    const d = new Date('2026-03-28T23:30:00Z')
    expect(d.toLocaleDateString('de-DE')).toBe('29.3.2026')
  })
})
