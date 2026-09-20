import { describe, expect, it } from 'vitest'
import {
  INTERNAL_MESSAGE,
  UNKNOWN_CLIENT_MESSAGE,
  badRequest,
  conflict,
  forbidden,
  isCuratedError,
  notFound,
  tooManyRequests,
  unauthorized,
  validationFailed,
} from '../../server/utils/errors'

const shape = (error: unknown) => {
  const e = error as { statusCode: number, statusMessage: string, data: { code: string, fields?: unknown } }
  return { status: e.statusCode, message: e.statusMessage, code: e.data.code, fields: e.data.fields }
}

describe('Fehler-Helfer', () => {
  it('400 reicht den Grund durch', () => {
    expect(shape(badRequest('Die Datei ist leer.'))).toMatchObject({
      status: 400,
      message: 'Die Datei ist leer.',
      code: 'BAD_REQUEST',
    })
  })

  it('401 bittet um Anmeldung', () => {
    expect(shape(unauthorized())).toMatchObject({
      status: 401,
      message: 'Bitte melden Sie sich an.',
      code: 'UNAUTHORIZED',
    })
  })

  it('403 nennt die fehlende Berechtigung', () => {
    expect(shape(forbidden())).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('403 nimmt einen eigenen Text an', () => {
    expect(shape(forbidden('Nur die Verwaltung darf das.')).message).toBe(
      'Nur die Verwaltung darf das.',
    )
  })

  it('404 baut den Satz aus dem Namen der Entität', () => {
    expect(shape(notFound('Fahrzeug')).message).toBe('Fahrzeug nicht gefunden.')
  })

  it('409 nennt den fachlichen Grund', () => {
    expect(shape(conflict('Bereits abgerechnet.'))).toMatchObject({
      status: 409,
      code: 'CONFLICT',
    })
  })

  it('422 trägt die Feldfehler mit', () => {
    const error = shape(validationFailed({ email: 'Pflichtfeld.' }))
    expect(error.status).toBe(422)
    expect(error.fields).toEqual({ email: 'Pflichtfeld.' })
    expect(error.message).toBe('Bitte prüfen Sie Ihre Eingaben.')
  })

  it('422 nimmt einen eigenen Kopfsatz an', () => {
    expect(shape(validationFailed({ a: 'x' }, 'Die Positionen stimmen nicht.')).message).toBe(
      'Die Positionen stimmen nicht.',
    )
  })

  it('429 bittet um Geduld', () => {
    expect(shape(tooManyRequests())).toMatchObject({ status: 429, code: 'RATE_LIMITED' })
  })

  it('kennt die beiden Ersatztexte', () => {
    expect(INTERNAL_MESSAGE).toBe('Ein interner Fehler ist aufgetreten.')
    expect(UNKNOWN_CLIENT_MESSAGE).toBe('Die Anfrage konnte nicht bearbeitet werden.')
  })

  it('erkennt einen kuratierten Fehler', () => {
    expect(isCuratedError(notFound('Kunde'))).toBe(true)
  })

  it('erkennt einen fremden Fehler als nicht kuratiert', () => {
    expect(isCuratedError(new Error('kaputt'))).toBe(false)
    expect(isCuratedError({ data: 'text' })).toBe(false)
    expect(isCuratedError(null)).toBe(false)
  })

  it('jede Meldung ist ein vollständiger deutscher Satz', () => {
    const messages = [
      unauthorized(), forbidden(), notFound('Kunde'), tooManyRequests(),
      validationFailed({}),
    ].map(error => (error as { statusMessage: string }).statusMessage)

    for (const message of messages) {
      expect(message).toMatch(/[.!?]$/)
      expect(message).not.toMatch(/Invalid|Error|Failed/)
    }
  })
})
