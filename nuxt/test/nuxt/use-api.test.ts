import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { ValidationError, fieldsOf, messageOf } from '~/composables/useApi'

// `mockNuxtImport` is hoisted above the file body, so the spies it uses have
// to be hoisted as well.
const { toastAdd, navigate } = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  navigate: vi.fn(),
}))

mockNuxtImport('useToast', () => () => ({
  add: toastAdd,
  clear: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  toasts: [],
}))

mockNuxtImport('navigateTo', () => navigate)

registerEndpoint('/api/probe/ok', () => ({ ok: true }))

registerEndpoint('/api/probe/invalid', {
  method: 'POST',
  handler: () =>
    createError({
      statusCode: 422,
      statusMessage: 'Bitte prüfen Sie Ihre Eingaben.',
      data: { code: 'VALIDATION_FAILED', fields: { lastName: 'Pflichtfeld.' } },
    }),
})

registerEndpoint('/api/probe/echo', {
  method: 'PATCH',
  handler: () => ({ method: 'PATCH' }),
})

registerEndpoint('/api/probe/weg', {
  method: 'DELETE',
  handler: () => ({ method: 'DELETE' }),
})

registerEndpoint('/api/probe/gone', () =>
  createError({
    statusCode: 401,
    statusMessage: 'Bitte melden Sie sich an.',
    data: { code: 'UNAUTHORIZED' },
  }),
)

registerEndpoint('/api/probe/conflict', () =>
  createError({
    statusCode: 409,
    statusMessage: 'Zu diesem Auftrag gibt es bereits eine aktive Rechnung.',
    data: { code: 'CONFLICT' },
  }),
)

describe('useApi', () => {
  it('gibt eine erfolgreiche Antwort unverändert zurück', async () => {
    toastAdd.mockClear()
    const api = useApi()
    await expect(api.get('/api/probe/ok')).resolves.toEqual({ ok: true })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('reicht Feldfehler an das Formular weiter, ohne einen Toast zu zeigen', async () => {
    toastAdd.mockClear()
    const api = useApi()
    await expect(api.post('/api/probe/invalid', {})).rejects.toBeInstanceOf(ValidationError)
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('nennt im Feldfehler das betroffene Feld', async () => {
    const api = useApi()
    await api.post('/api/probe/invalid', {}).catch((error: unknown) => {
      expect((error as ValidationError).fields).toEqual({ lastName: 'Pflichtfeld.' })
    })
  })

  it('zeigt bei einem fachlichen Konflikt den kuratierten deutschen Satz', async () => {
    toastAdd.mockClear()
    const api = useApi()
    await api.get('/api/probe/conflict').catch(() => {})
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({
      color: 'error',
      title: 'Zu diesem Auftrag gibt es bereits eine aktive Rechnung.',
    })
  })

  it('B-014: eine abgelaufene Sitzung führt zur Anmeldung, nicht nur zu einem Toast', async () => {
    // Der Vorgänger zeigte bei 401 lediglich eine Meldung; der Nutzer blieb auf
    // einer Seite stehen, die nicht mehr funktionierte.
    navigate.mockClear()
    toastAdd.mockClear()
    const api = useApi()
    await api.get('/api/probe/gone').catch(() => {})
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]![0]).toMatchObject({ path: '/login' })
    expect(toastAdd).not.toHaveBeenCalled()
  })
})

describe('Fehlerauswertung', () => {
  it('liest den kuratierten Satz aus der Antwort', () => {
    expect(messageOf({ data: { statusMessage: 'Kunde nicht gefunden.' } })).toBe(
      'Kunde nicht gefunden.',
    )
  })

  it('fällt auf einen allgemeinen Satz zurück, wenn nichts Kuratiertes da ist', () => {
    expect(messageOf(new Error('TypeError: fetch failed'))).toBe(
      'Es ist leider ein Fehler aufgetreten.',
    )
  })

  it('gibt Feldfehler nur bei 422 heraus', () => {
    const withFields = { statusCode: 422, data: { data: { fields: { a: 'x' } } } }
    expect(fieldsOf(withFields)).toEqual({ a: 'x' })
    expect(fieldsOf({ statusCode: 500, data: { data: { fields: { a: 'x' } } } })).toBeNull()
  })
})

describe('Sprachfilter', () => {
  it('B-044: der Client filtert Servermeldungen nicht mehr nach Wortanfang', () => {
    // Der Vorgänger verwarf im Browser jede Meldung, die mit "Invalid",
    // "Expected" oder "Missing" begann, und auf dem Server jede ohne Umlaut.
    // Dieselbe Meldung konnte dadurch an beiden Stellen unterschiedlich
    // aussehen. Jetzt wird die kuratierte Meldung unverändert übernommen.
    const curated = 'Die Seitenzahl beginnt bei 1.'
    expect(messageOf({ data: { statusMessage: curated } })).toBe(curated)

    const awkward = 'Expected: Bitte eine gueltige Eingabe.'
    expect(messageOf({ data: { statusMessage: awkward } })).toBe(awkward)
  })

  it('B-044: nur eine fehlende Servermeldung führt zum Ersatztext', () => {
    expect(messageOf({ data: { statusMessage: '   ' } })).toBe(
      'Es ist leider ein Fehler aufgetreten.',
    )
  })
})

describe('Die Kurzformen', () => {
  it('schickt patch als PATCH', async () => {
    await expect(useApi().patch('/api/probe/echo', { name: 'neu' }))
      .resolves.toEqual({ method: 'PATCH' })
  })

  it('schickt delete als DELETE', async () => {
    await expect(useApi().delete('/api/probe/weg')).resolves.toEqual({ method: 'DELETE' })
  })
})

describe('Regression', () => {
  it('B-057: eine abgelaufene Sitzung führt zur Anmeldung, nicht in eine tote Oberfläche', async () => {
    // Beim Vorgänger lief jeder Remote-Aufruf nach Sitzungsende in einen Toast
    // oder eine Fehlerseite, ohne Weiterleitung. Der Nutzer blieb auf einer
    // Seite, die nichts mehr laden konnte.
    navigate.mockClear()
    await useApi().get('/api/probe/gone').catch(() => {})

    expect(navigate).toHaveBeenCalledTimes(1)
    const target = navigate.mock.calls[0]![0] as { path: string, query: Record<string, string> }
    expect(target.path).toBe('/login')
    // Und das ursprüngliche Ziel reist mit, damit der Weg zurückführt.
    expect(target.query).toHaveProperty('redirectTo')
  })
})
