import { describe, it, expect } from 'vitest'
import { signInErrorMessage } from './sign-in-error'

/**
 * Unit tests for the German sign-in error mapping. Regression: the raw
 * better-auth message ("Invalid username or password") must never reach
 * the UI.
 *
 * @group unit
 * @module login
 */
describe('signInErrorMessage', () => {
  it('maps 401 wrong credentials to German', () => {
    expect(
      signInErrorMessage({
        status: 401,
        message: 'Invalid username or password'
      })
    ).toBe('Benutzername oder Passwort ist falsch.')
  })
  it('maps 403 to the same German credentials message', () => {
    expect(signInErrorMessage({ status: 403 })).toBe(
      'Benutzername oder Passwort ist falsch.'
    )
  })
  it('keeps the German rate-limit body on 429', () => {
    expect(
      signInErrorMessage({
        status: 429,
        message: 'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.'
      })
    ).toBe('Zu viele Anmeldeversuche, bitte warten Sie eine Minute.')
  })
  it('falls back to a German rate-limit default on empty 429 body', () => {
    expect(signInErrorMessage({ status: 429 })).toBe(
      'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.'
    )
  })
  it('uses a German generic for unexpected statuses', () => {
    expect(signInErrorMessage({ status: 500, message: 'Internal error' })).toBe(
      'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.'
    )
  })
})
