/**
 * Die Sicherheits-Kopfzeilen (M-40, P-21).
 *
 * Die Anwendung lieferte bis zum 17.09.2026 **keine einzige** davon aus. Hier
 * steht, was jede Antwort trägt — und vor allem die eine Zeile, die man nicht
 * versehentlich setzen darf: `Strict-Transport-Security` über http sperrt den
 * Browser für Monate aus der eigenen Anwendung aus.
 */
import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, isHttps, securityHeaders } from '../../server/utils/security-headers'

const production = { origin: 'https://twincars.example' }
const local = { origin: 'http://localhost:3000', development: true }

/** Die Richtlinie als Zuordnung Ziel → erlaubte Quellen. */
const directives = (policy: string): Record<string, string[]> =>
  Object.fromEntries(
    policy.split('; ').map((part) => {
      const [name, ...values] = part.split(' ')
      return [name!, values]
    }),
  )

describe('isHttps', () => {
  it.each([
    ['https://twincars.example', true],
    ['HTTPS://TWINCARS.EXAMPLE', true],
    ['  https://twincars.example  ', true],
    ['http://localhost:3000', false],
    ['', false],
  ])('%s → %s', (origin, expected) => {
    expect(isHttps(origin)).toBe(expected)
  })
})

describe('P-21: die Inhaltsrichtlinie', () => {
  it('erlaubt nur die eigene Herkunft', () => {
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['default-src']).toEqual(['\'self\''])
    expect(policy['connect-src']).toEqual(['\'self\''])
  })

  it('verbietet das Einbetten in eine fremde Seite', () => {
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['frame-ancestors']).toEqual(['\'none\''])
  })

  it('verbietet Plugins und fremde Formularziele', () => {
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['object-src']).toEqual(['\'none\''])
    expect(policy['form-action']).toEqual(['\'self\''])
    expect(policy['base-uri']).toEqual(['\'self\''])
  })

  it('lässt Bilder als Datenstrom zu — Fotos und PDFs kommen so an', () => {
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['img-src']).toContain('data:')
    expect(policy['img-src']).toContain('blob:')
  })

  it('erlaubt kein `unsafe-eval` im Betrieb', () => {
    // Im Entwicklungsbetrieb braucht Vite es; ausgeliefert wird es nie.
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['script-src']).not.toContain('\'unsafe-eval\'')
    expect(directives(contentSecurityPolicy(local))['script-src'])
      .toContain('\'unsafe-eval\'')
  })

  it('hebt im Betrieb jede Verbindung auf https', () => {
    expect(contentSecurityPolicy(production)).toContain('upgrade-insecure-requests')
    // Im Entwicklungsbetrieb nicht — sonst ist die Anwendung über http tot.
    expect(contentSecurityPolicy(local)).not.toContain('upgrade-insecure-requests')
  })

  it('lässt Vite im Entwicklungsbetrieb seine Verbindung zum Neuladen', () => {
    expect(directives(contentSecurityPolicy(local))['connect-src']).toContain('ws:')
  })

  it('erlaubt eingebettete Skripte nur aus der eigenen Auslieferung', () => {
    // `'unsafe-inline'` ist nötig, weil Nuxt den Zustand der Seite eingebettet
    // ablegt — ohne das hydriert nichts (siehe blocker.md W-03). Eine **fremde**
    // Quelle bleibt trotzdem gesperrt, und darauf kommt es an.
    const policy = directives(contentSecurityPolicy(production))
    expect(policy['script-src']).toEqual(['\'self\'', '\'unsafe-inline\''])
    expect(policy['script-src']).not.toContain('*')
    expect(policy['script-src']!.some(source => source.includes('http'))).toBe(false)
  })
})

describe('P-21: die übrigen Kopfzeilen', () => {
  it('M-40: jede Antwort sagt dem Browser, was er darf', () => {
    // Bis zum 17.09.2026 lieferte die Anwendung **keine einzige** dieser
    // Zeilen aus. Ein Browser, dem niemand etwas sagt, erlaubt alles.
    const headers = securityHeaders(production)
    expect(Object.keys(headers).length).toBeGreaterThanOrEqual(8)
    for (const required of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(headers[required], required).toBeTruthy()
    }
  })

  it('setzt alle Pflichtzeilen', () => {
    const headers = securityHeaders(production)
    expect(Object.keys(headers).sort()).toEqual([
      'Content-Security-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-Robots-Tag',
    ])
  })

  it('verbietet das Raten des Inhaltstyps', () => {
    expect(securityHeaders(production)['X-Content-Type-Options']).toBe('nosniff')
  })

  it('lässt keine interne Adresse nach draußen', () => {
    expect(securityHeaders(production)['Referrer-Policy']).toBe('same-origin')
  })

  it('schaltet Kamera, Mikrofon und Standort ab', () => {
    const policy = securityHeaders(production)['Permissions-Policy'] ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy, feature).toContain(`${feature}=()`)
    }
  })

  it('hält die Anwendung aus jedem Suchindex heraus', () => {
    // Eine Verwaltungsanwendung gehört in keinen Index und in kein Archiv.
    expect(securityHeaders(production)['X-Robots-Tag']).toContain('noindex')
  })

  it('P-21: setzt HSTS nur über https', () => {
    // Über http gesetzt sperrt diese Zeile den Browser für zwei Jahre aus der
    // eigenen Anwendung aus — und zwar so, dass es niemand ohne Handarbeit im
    // Browserprofil wieder löst.
    expect(securityHeaders(production)['Strict-Transport-Security'])
      .toContain('max-age=63072000')
    expect(securityHeaders(local)['Strict-Transport-Security']).toBeUndefined()
    expect(securityHeaders({ origin: 'http://twincars.example' })['Strict-Transport-Security'])
      .toBeUndefined()
  })

  it('kommt ohne gesetzte Herkunft zurecht', () => {
    // Eine halb eingerichtete Umgebung darf keine kaputte Kopfzeile erzeugen.
    const headers = securityHeaders({ origin: '' })
    expect(headers['Content-Security-Policy']).toBeTruthy()
    expect(headers['Strict-Transport-Security']).toBeUndefined()
  })
})
