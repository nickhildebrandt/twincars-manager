/**
 * The open-redirect guard.
 *
 * B-002, B-056: the predecessor accepted anything starting with a single
 * slash. Browsers read a backslash as a slash, so `/\evil.example` becomes
 * `//evil.example` — a foreign host. After a successful login the user landed
 * on a phishing page with a real session in hand.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_REDIRECT, loginPathFor, safeRedirectTarget } from '#shared/redirect'

describe('safeRedirectTarget nimmt eigene Pfade an', () => {
  it.each([
    ['/', '/'],
    ['/customers', '/customers'],
    ['/customers?page=2', '/customers?page=2'],
    ['/customers#oben', '/customers#oben'],
    ['/invoices/9f1c/edit', '/invoices/9f1c/edit'],
    ['/suche?q=M%C3%BCller', '/suche?q=M%C3%BCller'],
  ])('nimmt %s an', (input, expected) => {
    expect(safeRedirectTarget(input)).toBe(expected)
  })
})

describe('safeRedirectTarget weist fremde Ziele ab', () => {
  it.each([
    ['//evil.example', 'protokollrelativ'],
    ['/\\evil.example', 'Backslash — der Browser liest ihn als Schrägstrich'],
    ['\\\\evil.example', 'zwei Backslashes'],
    ['/%2fevil.example', 'versteckter zweiter Schrägstrich'],
    ['https://evil.example', 'vollständige Adresse'],
    ['http://evil.example/pfad', 'vollständige Adresse mit Pfad'],
    ['//evil.example/customers', 'fremder Host mit eigenem Pfad'],
    ['javascript:alert(1)', 'Skript-Schema'],
    ['data:text/html,<script>', 'Daten-Schema'],
    ['customers', 'ohne führenden Schrägstrich'],
    ['', 'leer'],
    [' /customers', 'führendes Leerzeichen'],
    ['/customers\nSet-Cookie: x', 'Zeilenumbruch'],
    ['/%', 'kaputte Prozentkodierung'],
  ])('weist %s ab (%s)', (input) => {
    expect(safeRedirectTarget(input)).toBe(DEFAULT_REDIRECT)
  })

  it.each([null, undefined])('weist %s ab', (input) => {
    expect(safeRedirectTarget(input)).toBe(DEFAULT_REDIRECT)
  })

  it('nimmt den angegebenen Rückfall', () => {
    expect(safeRedirectTarget('//evil.example', '/dashboard')).toBe('/dashboard')
  })
})

describe('loginPathFor', () => {
  it('hängt ein eigenes Ziel an', () => {
    expect(loginPathFor('/customers?page=2')).toBe('/login?redirectTo=%2Fcustomers%3Fpage%3D2')
  })

  it('lässt die Startseite weg', () => {
    expect(loginPathFor('/')).toBe('/login')
  })

  it('verwirft ein fremdes Ziel, statt es weiterzureichen', () => {
    expect(loginPathFor('//evil.example')).toBe('/login')
  })
})

describe('Regression', () => {
  it('B-002: der Backslash-Trick führt nicht mehr nach außen', () => {
    // `new URL('/\evil.example', origin)` ergibt im Browser
    // `https://evil.example/` — genau das prüft der Wächter jetzt nach.
    expect(safeRedirectTarget('/\\evil.example')).toBe('/')
    expect(safeRedirectTarget('/\\\\evil.example')).toBe('/')
    expect(safeRedirectTarget('/\\/evil.example')).toBe('/')
  })

  it('B-056: auch die kodierte Fassung wird abgewiesen', () => {
    expect(safeRedirectTarget('%2F%5Cevil.example')).toBe('/')
    expect(safeRedirectTarget('/%5Cevil.example')).toBe('/')
  })
})
