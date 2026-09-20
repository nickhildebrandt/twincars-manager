/**
 * Which paths are public, and which of the library's endpoints exist at all.
 *
 * B-051, B-052: the predecessor's catch-all published everything the library
 * happened to implement — including a way for a signed-in person to change
 * their own user name, and an unauthenticated way to test which user names
 * exist.
 */
import { describe, expect, it } from 'vitest'
import {
  authEndpointOf,
  exposedAuthEndpoints,
  isApiPath,
  isExposedAuthEndpoint,
  isPublicPath,
} from '../../server/utils/auth-paths.ts'

describe('isPublicPath', () => {
  it.each([
    '/login',
    '/login?redirectTo=%2Fcustomers',
    '/setup',
    '/setup/schritt-2',
    '/api/auth/sign-in/username',
    '/api/public/used-cars',
    '/api/ebay/account-deletion',
    '/api/health',
    '/api/me',
    '/_nuxt/entry.js',
    '/favicon.ico',
  ])('lässt %s ohne Sitzung durch', (path) => {
    expect(isPublicPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/customers',
    '/api/customers',
    '/api/settings/users',
    '/api/ebay/listings',
  ])('verlangt für %s eine Sitzung', (path) => {
    expect(isPublicPath(path)).toBe(false)
  })

  it('lässt sich nicht durch einen ähnlichen Namen austricksen', () => {
    // `/api/publicity` ist nicht `/api/public/`.
    expect(isPublicPath('/api/publicity/secrets')).toBe(false)
    expect(isPublicPath('/api/healthy-profits')).toBe(false)
  })
})

describe('isApiPath', () => {
  it.each(['/api/customers', '/api/auth/sign-out', '/api/health?x=1'])('erkennt %s', (path) => {
    expect(isApiPath(path)).toBe(true)
  })

  it.each(['/customers', '/', '/apikeys'])('erkennt %s nicht als API', (path) => {
    expect(isApiPath(path)).toBe(false)
  })
})

describe('authEndpointOf', () => {
  it.each([
    ['/api/auth/sign-in/username', '/sign-in/username'],
    ['/api/auth/sign-out', '/sign-out'],
    ['/api/auth/sign-out?x=1', '/sign-out'],
    ['/api/auth', '/'],
    ['/sign-in/username', '/sign-in/username'],
  ])('zerlegt %s zu %s', (path, endpoint) => {
    expect(authEndpointOf(path)).toBe(endpoint)
  })
})

describe('isExposedAuthEndpoint', () => {
  it.each([...exposedAuthEndpoints()])('lässt %s zu', (endpoint) => {
    expect(isExposedAuthEndpoint(`/api/auth${endpoint}`)).toBe(true)
  })

  it.each([
    ['/api/auth/update-user', 'ließe den Benutzernamen ändern (B-051)'],
    ['/api/auth/is-username-available', 'verriete vorhandene Zugänge (B-052)'],
    ['/api/auth/list-sessions', 'gehört der Verwaltung'],
    ['/api/auth/revoke-session', 'gehört der Verwaltung'],
    ['/api/auth/sign-up/email', 'es gibt keine Selbstregistrierung'],
    ['/api/auth/forget-password', 'es gibt kein Zurücksetzen per Mail'],
    ['/api/auth/reset-password', 'es gibt kein Zurücksetzen per Mail'],
    ['/api/auth/verify-email', 'es gibt keine Adressbestätigung'],
    ['/api/auth/sign-in/social', 'es gibt keine Fremdanmeldung'],
  ])('sperrt %s (%s)', (path) => {
    expect(isExposedAuthEndpoint(path)).toBe(false)
  })

  it('ist eine Zulassungsliste, keine Sperrliste', () => {
    // Eine künftige Fassung der Bibliothek kann Endpunkte hinzufügen. Mit
    // einer Zulassungsliste bleiben sie zu, bis jemand sie bewusst öffnet.
    expect(isExposedAuthEndpoint('/api/auth/etwas-ganz-neues')).toBe(false)
    expect(exposedAuthEndpoints().length).toBeLessThanOrEqual(6)
  })
})
