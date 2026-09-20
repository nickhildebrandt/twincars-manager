/**
 * Der Einmalwert der Inhaltsrichtlinie (M-40).
 *
 * Zwei Zusagen, und die zweite ist die wichtigere: der Wert muss an die
 * Skripte des Rahmens **und er darf nicht** an den gerenderten Seiteninhalt.
 * Ein Stempel dort höbe die Maßnahme auf, statt sie durchzusetzen.
 */
import { describe, expect, it } from 'vitest'
import { FRAMEWORK_PARTS, newNonce, stampNonce } from '../../server/utils/csp-nonce'
import { contentSecurityPolicy } from '../../server/utils/security-headers'

describe('newNonce', () => {
  it('ist lang genug, um nicht geraten zu werden', () => {
    // Die Empfehlung lautet mindestens 128 Bit. 16 Bytes base64 sind 24
    // Zeichen.
    expect(newNonce()).toHaveLength(24)
  })

  it('ist jedes Mal ein anderer', () => {
    // Wiederverwendet wäre er wertlos: wer ihn einmal sieht, kennt ihn für
    // jede weitere Antwort.
    const werte = new Set(Array.from({ length: 200 }, () => newNonce()))
    expect(werte.size).toBe(200)
  })

  it('enthält nichts, was die Kopfzeile zerlegt', () => {
    // base64 kennt `+`, `/` und `=` — alle drei sind in einer CSP-Quelle
    // zulässig. Ein Anführungszeichen oder ein Semikolon wäre es nicht.
    for (let versuch = 0; versuch < 200; versuch += 1) {
      expect(newNonce()).toMatch(/^[A-Za-z0-9+/=]+$/)
    }
  })
})

describe('stampNonce', () => {
  it('stempelt ein eingebettetes Skript', () => {
    expect(stampNonce('<script>alert(1)</script>', 'abc'))
      .toBe('<script nonce="abc">alert(1)</script>')
  })

  it('stempelt auch ein Skript mit Attributen', () => {
    expect(stampNonce('<script type="importmap">{}</script>', 'abc'))
      .toBe('<script nonce="abc" type="importmap">{}</script>')
  })

  it('stempelt jedes Skript eines Abschnitts', () => {
    const stamped = stampNonce('<script>a</script><link><script>b</script>', 'abc')
    expect(stamped.match(/nonce="abc"/g)).toHaveLength(2)
  })

  it('stempelt nicht doppelt', () => {
    const once = stampNonce('<script>a</script>', 'abc')
    expect(stampNonce(once, 'xyz')).toBe(once)
  })

  it('lässt alles andere unberührt', () => {
    const markup = '<link rel="stylesheet" href="/a.css"><meta charset="utf-8">'
    expect(stampNonce(markup, 'abc')).toBe(markup)
  })
})

describe('M-40: der gerenderte Seiteninhalt wird nicht gestempelt', () => {
  it('M-40: `body` steht nicht in der Liste der gestempelten Teile', () => {
    // Der Kern der Sache. In `body` steht, was die Seite gerendert hat — dort
    // könnte ein Skript stehen, das über eine Lücke hineingeraten ist. Es zu
    // stempeln hieße, ihm genau die Erlaubnis zu geben, die ihm die
    // Richtlinie verweigern soll.
    expect(FRAMEWORK_PARTS).not.toContain('body')
    expect([...FRAMEWORK_PARTS].sort()).toEqual(['bodyAppend', 'bodyPrepend', 'head'])
  })
})

describe('M-40: die Richtlinie mit Einmalwert', () => {
  it('M-40: setzt den Wert statt `unsafe-inline`', () => {
    // Beides zusammen wäre wirkungslos: in Anwesenheit eines Einmalwerts
    // ignoriert der Browser `'unsafe-inline'`. Es steht deshalb gar nicht erst
    // da — sonst läse sich die Kopfzeile, als gäbe es einen Rückfallweg.
    const policy = contentSecurityPolicy({
      origin: 'https://twincars.example',
      nonce: 'abc123',
    })
    expect(policy).toContain('script-src \'self\' \'nonce-abc123\'')
    expect(policy).not.toContain('script-src \'self\' \'unsafe-inline\'')
  })

  it('M-40: ohne Wert bleibt es beim Rückfall', () => {
    // Im Entwicklungsbetrieb: dort fügt Vite eigene Skripte ein, die nicht
    // durch den Nuxt-Haken laufen.
    const policy = contentSecurityPolicy({ origin: 'http://localhost:3000', development: true })
    expect(policy).toContain('\'unsafe-inline\'')
    expect(policy).not.toContain('nonce-')
  })

  it('M-40: die Stile behalten ihren Rückfall', () => {
    // Nuxt UI setzt Stile als Attribut am Element; ein Einmalwert deckt
    // Attribute nicht ab. Eingeschleustes CSS ist ein deutlich kleinerer
    // Hebel als eingeschleustes JavaScript.
    const policy = contentSecurityPolicy({
      origin: 'https://twincars.example',
      nonce: 'abc123',
    })
    expect(policy).toContain('style-src \'self\' \'unsafe-inline\'')
  })
})
