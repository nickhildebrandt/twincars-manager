/**
 * The authorisation guards.
 *
 * The predecessor checked permissions inside the handler body, sometimes after
 * a query had already run, and three endpoints forgot the check entirely
 * (B-002, B-003). These functions are the first statement of every endpoint,
 * so their behaviour — and the German sentence they produce — matters as much
 * as the business logic behind them.
 */
import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import {
  may,
  optionalUser,
  requireAnyPermission,
  requirePermission,
  requireUser,
} from '../../server/utils/guards.ts'
import type { AuthContext } from '../../server/utils/guards.ts'
import { WILDCARD_PERMISSION } from '#shared/permissions'

/** The part of an event a guard actually reads. */
const eventWith = (auth?: AuthContext) => ({ context: { auth } }) as unknown as H3Event

const userWith = (...permissions: string[]): AuthContext => ({
  userId: 'u-1',
  username: 'mitarbeiter',
  displayName: 'Max Mustermann',
  permissions: new Set(permissions),
})

const statusOf = (error: unknown) => (error as { statusCode?: number }).statusCode
const messageOf = (error: unknown) => (error as { message?: string }).message

describe('requireUser', () => {
  it('gibt den angemeldeten Benutzer zurück', () => {
    const auth = userWith('customers')
    expect(requireUser(eventWith(auth))).toBe(auth)
  })

  it('antwortet ohne Sitzung mit 401 und einem deutschen Satz', () => {
    try {
      requireUser(eventWith())
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(401)
      expect(messageOf(error)).toBe('Bitte melden Sie sich an.')
    }
  })
})

describe('optionalUser', () => {
  it('gibt ohne Sitzung null zurück, statt zu werfen', () => {
    // Die Anmeldeseite und die Navigation bedienen beide Zustände.
    expect(optionalUser(eventWith())).toBeNull()
  })

  it('gibt mit Sitzung den Benutzer zurück', () => {
    const auth = userWith()
    expect(optionalUser(eventWith(auth))).toBe(auth)
  })
})

describe('requirePermission', () => {
  it('lässt den Inhaber der Berechtigung durch', () => {
    expect(requirePermission(eventWith(userWith('customers')), 'customers').userId).toBe('u-1')
  })

  it('lässt den Administrator überall durch', () => {
    expect(requirePermission(eventWith(userWith(WILDCARD_PERMISSION)), 'settings')).toBeTruthy()
  })

  it('antwortet mit 403 und benennt den Bereich auf Deutsch', () => {
    try {
      requirePermission(eventWith(userWith('customers')), 'settings')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(403)
      // „Forbidden" hilft niemandem; der Nutzer soll lesen, was ihm fehlt.
      expect(messageOf(error)).toContain('Einstellungen')
      expect(messageOf(error)).toMatch(/^Sie haben keine Berechtigung für .+\.$/)
    }
  })

  it('prüft die Anmeldung vor der Berechtigung', () => {
    // 401 und 403 bedeuten Verschiedenes: das eine führt zur Anmeldung, das
    // andere nicht.
    try {
      requirePermission(eventWith(), 'customers')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(401)
    }
  })
})

describe('requireAnyPermission', () => {
  it('lässt durch, wenn eine der Berechtigungen vorliegt', () => {
    // Die Werkstatt wählt Mitarbeiter und Artikel am Auftrag aus, ohne selbst
    // die Personal- oder Katalogberechtigung zu haben.
    expect(requireAnyPermission(eventWith(userWith('orders')), 'employees', 'orders')).toBeTruthy()
  })

  it('antwortet mit 403 und nennt alle infrage kommenden Bereiche', () => {
    try {
      requireAnyPermission(eventWith(userWith('customers')), 'employees', 'items')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(403)
      expect(messageOf(error)).toContain(' oder ')
    }
  })

  it('verlangt ebenfalls zuerst eine Sitzung', () => {
    try {
      requireAnyPermission(eventWith(), 'customers', 'orders')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(401)
    }
  })
})

describe('may', () => {
  it.each([
    ['mit Berechtigung', ['customers'], true],
    ['ohne Berechtigung', ['orders'], false],
    ['als Administrator', [WILDCARD_PERMISSION], true],
  ])('%s', (_name, permissions, expected) => {
    expect(may(userWith(...permissions), 'customers')).toBe(expected)
  })

  it('ist für einen anonymen Besucher falsch', () => {
    expect(may(null, 'customers')).toBe(false)
  })
})

describe('Eines von mehreren Rechten genügt', () => {
  // Der Fall aus der Werkstatt: wer an einem Auftrag arbeitet, wählt
  // Mitarbeiter und Katalogartikel aus, ohne das Personal- oder das
  // Artikelmodul selbst zu besitzen.

  it('lässt das Auftragsrecht an die Mitarbeiterauswahl', () => {
    expect(requireAnyPermission(
      eventWith(userWith('orders')),
      'employees',
      'orders',
    )).toBeTruthy()
  })

  it('lässt ebenso das Personalrecht daran', () => {
    expect(requireAnyPermission(
      eventWith(userWith('employees')),
      'employees',
      'orders',
    )).toBeTruthy()
  })

  it('nennt in der Absage beide Bereiche', () => {
    try {
      requireAnyPermission(eventWith(userWith('customers')), 'employees', 'orders')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(statusOf(error)).toBe(403)
      expect(messageOf(error)).toBe('Sie haben keine Berechtigung für Mitarbeiter oder Aufträge.')
    }
  })

  it('nennt denselben Bereich nur einmal', () => {
    try {
      requireAnyPermission(eventWith(userWith('customers')), 'orders', 'orders')
      expect.unreachable('Der Wächter hätte werfen müssen.')
    }
    catch (error) {
      expect(messageOf(error)).toBe('Sie haben keine Berechtigung für Aufträge.')
    }
  })
})
