/**
 * The validation and error funnel over real HTTP.
 *
 * A small h3 application is built here rather than calling the helpers
 * directly, so request parsing, status codes and the response body are
 * exercised exactly as they are in production
 * (../../../docs/rewrite/03-architektur.md §5.4, §6.2).
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import {
  coerceQuery,
  firstFieldMessage,
  toFieldErrors,
  useValidatedBody,
  useValidatedParams,
  useValidatedQuery,
} from '../../server/utils/validate'
import { conflict, forbidden, notFound, unauthorized } from '../../server/utils/errors'
import { listQuerySchema } from '#shared/schemas/pagination'
import { emailSchema, idSchema, requiredText } from '#shared/schemas/primitives'
import '#shared/schemas/messages'

const customerSchema = v.object({
  lastName: requiredText(100, 'Bitte einen Nachnamen eingeben.'),
  email: v.optional(emailSchema),
  items: v.optional(v.array(v.object({ quantity: v.number('Bitte eine Zahl eingeben.') }))),
})

function buildApp() {
  const app = createApp()
  const router = createRouter()

  router.get('/list', defineEventHandler(async (event) => {
    const query = await useValidatedQuery(event, listQuerySchema)
    return { ok: true, query }
  }))

  router.post('/customers', defineEventHandler(async (event) => {
    const body = await useValidatedBody(event, customerSchema)
    return { ok: true, body }
  }))

  router.get('/customers/:id', defineEventHandler(async (event) => {
    const { id } = await useValidatedParams(event, v.object({ id: idSchema }))
    return { ok: true, id }
  }))

  router.get('/missing', defineEventHandler(() => {
    throw notFound('Kunde')
  }))

  router.get('/no-session', defineEventHandler(() => {
    throw unauthorized()
  }))

  router.get('/no-permission', defineEventHandler(() => {
    throw forbidden()
  }))

  router.get('/conflict', defineEventHandler(() => {
    throw conflict('Zu diesem Auftrag gibt es bereits eine aktive Rechnung.')
  }))

  router.get('/boom', defineEventHandler(() => {
    throw new Error('SELECT * FROM users WHERE secret = \'geheim\'')
  }))

  app.use(router)
  return toWebHandler(app)
}

const handler = buildApp()

const call = async (path: string, init?: RequestInit) => {
  const response = await handler(new Request(`http://test${path}`, init))
  const text = await response.text()
  const body = parseJson(text)
  return { status: response.status, body }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  }
  catch {
    return { raw: text }
  }
}

const post = (path: string, payload: unknown) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

describe('Eingabeprüfung', () => {
  it('nimmt eine gültige Anfrage an', async () => {
    const { status, body } = await post('/customers', { lastName: 'Meier' })
    expect(status).toBe(200)
    expect((body.body as Record<string, unknown>).lastName).toBe('Meier')
  })

  it('antwortet auf ein fehlendes Pflichtfeld mit 422 und deutschem Feldfehler', async () => {
    const { status, body } = await post('/customers', { lastName: '  ' })
    expect(status).toBe(422)
    expect(body.statusMessage).toBe('Bitte prüfen Sie Ihre Eingaben.')
    const data = body.data as { code: string, fields: Record<string, string> }
    expect(data.code).toBe('VALIDATION_FAILED')
    expect(data.fields.lastName).toBe('Bitte einen Nachnamen eingeben.')
  })

  it('benennt das fehlerhafte Feld in einer Liste mit seiner Position', async () => {
    const { status, body } = await post('/customers', {
      lastName: 'Meier',
      items: [{ quantity: 1 }, { quantity: 'zwei' }],
    })
    expect(status).toBe(422)
    const fields = (body.data as { fields: Record<string, string> }).fields
    expect(fields['items.1.quantity']).toBe('Bitte eine Zahl eingeben.')
    expect(firstFieldMessage(fields)).toBe(
      'Ungültige Eingabe für „Menge (Position 2)“: Bitte eine Zahl eingeben.',
    )
  })

  it('meldet je Feld nur den ersten Fehler', async () => {
    const { body } = await post('/customers', { lastName: '', email: 'kaputt' })
    const fields = (body.data as { fields: Record<string, string> }).fields
    expect(Object.keys(fields)).toEqual(['lastName', 'email'])
  })

  it('lehnt einen kaputten Rumpf sauber ab', async () => {
    const { status, body } = await call('/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{kein json',
    })
    expect(status).toBe(400)
    expect(String(body.statusMessage)).toContain('lesbaren Daten')
  })
})

describe('Listenparameter', () => {
  it('nimmt eine Seitenzahl an und wandelt sie in eine Zahl', async () => {
    const { status, body } = await call('/list?page=3&q=meier')
    expect(status).toBe(200)
    expect((body.query as Record<string, unknown>).page).toBe(3)
    expect((body.query as Record<string, unknown>).q).toBe('meier')
  })

  it('setzt die Seite ohne Angabe auf 1', async () => {
    const { body } = await call('/list')
    expect((body.query as Record<string, unknown>).page).toBe(1)
  })

  it('antwortet auf page=0 mit 422 statt mit einem Serverfehler', async () => {
    const { status, body } = await call('/list?page=0')
    expect(status).toBe(422)
    const fields = (body.data as { fields: Record<string, string> }).fields
    expect(fields.page).toBe('Die Seitenzahl beginnt bei 1.')
  })

  it('antwortet auf eine negative Seite mit 422', async () => {
    expect((await call('/list?page=-5')).status).toBe(422)
  })

  it('ignoriert eine vom Aufrufer gewünschte Seitengröße', async () => {
    const { body } = await call('/list?page=1&size=100')
    expect((body.query as Record<string, unknown>).size).toBeUndefined()
  })
})

describe('Routenparameter', () => {
  it('nimmt eine UUID an', async () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    const { status, body } = await call(`/customers/${id}`)
    expect(status).toBe(200)
    expect(body.id).toBe(id)
  })

  it('antwortet auf eine vertippte Kennung mit 422 statt mit einem Datenbankfehler', async () => {
    const { status, body } = await call('/customers/abc')
    expect(status).toBe(422)
    const fields = (body.data as { fields: Record<string, string> }).fields
    expect(fields.id).toBe('Ungültige Kennung.')
  })
})

describe('Fehlerformen', () => {
  it('404 nennt die Entität auf Deutsch', async () => {
    const { status, body } = await call('/missing')
    expect(status).toBe(404)
    expect(body.statusMessage).toBe('Kunde nicht gefunden.')
    expect((body.data as { code: string }).code).toBe('NOT_FOUND')
  })

  it('401 bittet um Anmeldung', async () => {
    const { status, body } = await call('/no-session')
    expect(status).toBe(401)
    expect(body.statusMessage).toBe('Bitte melden Sie sich an.')
  })

  it('403 nennt die fehlende Berechtigung', async () => {
    const { status, body } = await call('/no-permission')
    expect(status).toBe(403)
    expect(body.statusMessage).toBe('Sie haben keine Berechtigung für diesen Bereich.')
  })

  it('409 reicht den fachlichen Grund durch', async () => {
    const { status, body } = await call('/conflict')
    expect(status).toBe(409)
    expect(body.statusMessage).toBe(
      'Zu diesem Auftrag gibt es bereits eine aktive Rechnung.',
    )
  })

  it('ein unerwarteter Fehler gibt keine Interna preis', async () => {
    const { status, body } = await call('/boom')
    expect(status).toBe(500)
    const serialised = JSON.stringify(body)
    expect(serialised).not.toContain('SELECT')
    expect(serialised).not.toContain('geheim')
  })
})

describe('Hilfsfunktionen', () => {
  it('wandelt Abfragewerte nur dort um, wo es eindeutig ist', () => {
    expect(coerceQuery({ page: '2', flag: 'true', off: 'false', name: 'Meier' })).toEqual({
      page: 2,
      flag: true,
      off: false,
      name: 'Meier',
    })
  })

  it('lässt eine Zeichenfolge in Ruhe, die nur aussieht wie eine Zahl', () => {
    expect(coerceQuery({ plate: '0815' }).plate).toBe(815)
    expect(coerceQuery({ q: '12a' }).q).toBe('12a')
  })

  it('verwirft leere Werte, statt sie als leeren Text weiterzureichen', () => {
    expect(coerceQuery({ q: '', page: '1' })).toEqual({ page: 1 })
  })

  it('nimmt bei mehrfach gesetzten Parametern den letzten', () => {
    expect(coerceQuery({ page: ['1', '4'] }).page).toBe(4)
  })

  it('sammelt je Pfad nur den ersten Fehler', () => {
    const result = v.safeParse(customerSchema, { lastName: '' })
    const fields = toFieldErrors(result.success ? [] : result.issues)
    expect(Object.keys(fields)).toEqual(['lastName'])
  })
})
