/**
 * The three pieces of server middleware, over real HTTP.
 *
 * They are mounted in a small h3 application rather than called directly, so
 * request parsing, status codes and headers behave exactly as they do in
 * production.
 *
 * Findings: B-003 and B-054 (a forged forwarding header must not defeat the
 * sign-in throttle), B-041 (a forgotten guard must be a 401, not open data),
 * B-051 and B-052 (only a handful of the library's endpoints are exposed).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { installNitroGlobals, TEST_ORIGIN } from '../setup/nitro-globals'

installNitroGlobals()

const throttle = (await import('../../server/middleware/00.throttle.ts')).default
const session = (await import('../../server/middleware/01.auth.ts')).default
const apiGuard = (await import('../../server/middleware/02.api-guard.ts')).default
const { resetRateLimits } = await import('../../server/utils/rate-limit.ts')
const { resetAuth, SIGN_IN_ATTEMPTS_PER_MINUTE } = await import('../../server/utils/auth.ts')
const { createUserWithCredential } = await import('../../server/utils/auth-accounts.ts')
const { rolePermissions, roles, userRoles, users } = await import('../../server/database/schema/index.ts')
const { useDatabase, closeDatabase } = await import('../../server/utils/db.ts')
const { requirePermission } = await import('../../server/utils/guards.ts')
const { isExposedAuthEndpoint } = await import('../../server/utils/auth-paths.ts')

// The real endpoint modules, so the test covers the files that ship.
const authCatchAll = (await import('../../server/api/auth/[...all].ts')).default
const meEndpoint = (await import('../../server/api/me.get.ts')).default
const healthEndpoint = (await import('../../server/api/health.get.ts')).default

const db = useDatabase()

afterAll(async () => {
  resetAuth()
  await closeDatabase()
})

/** The middleware chain plus a couple of probe endpoints. */
function buildApp() {
  const app = createApp()
  app.use(throttle)
  app.use(session)
  app.use(apiGuard)

  // Mounted without a prefix, because h3 strips a mount prefix from
  // `event.path` while Nitro hands the handler the full path. The real
  // endpoint modules are used, not copies of them.
  app.use(defineEventHandler((event) => {
    const path = event.path.split('?')[0] ?? event.path

    if (path.startsWith('/api/auth')) return authCatchAll(event)
    if (path === '/api/me') return meEndpoint(event)
    if (path === '/api/health') return healthEndpoint(event)

    // An endpoint that forgot its guard. Reaching it without a session must
    // still be impossible.
    if (path === '/api/unguarded') return { secret: 'Umsatz' }

    if (path === '/api/customers') {
      requirePermission(event, 'customers')
      return { items: [] }
    }
  }))

  return toWebHandler(app)
}

const app = buildApp()
const PASSWORD = 'ein-gutes-passwort'

const request = (path: string, init: RequestInit = {}) =>
  app(new Request(`${TEST_ORIGIN}${path}`, init))

const signIn = (username: string, password = PASSWORD, headers: HeadersInit = {}) =>
  request('/api/auth/sign-in/username', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ username, password }),
  })

/**
 * The session cookie out of a sign-in response.
 *
 * `getSetCookie()` rather than `get('set-cookie')`: the expiry date contains a
 * comma, so splitting the joined header tears every cookie in half.
 */
function cookieOf(response: Response): string {
  return response.headers.getSetCookie()
    .map(entry => entry.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

async function createAccount(username: string, permissions: string[] = []) {
  const { id } = await createUserWithCredential({
    username,
    displayName: 'Testperson',
    password: PASSWORD,
  })
  if (permissions.length > 0) {
    const [role] = await db.insert(roles).values({ name: `Rolle ${username}` }).returning()
    await db.insert(rolePermissions).values(
      permissions.map(permission => ({ roleId: role!.id, permission })),
    )
    await db.insert(userRoles).values({ userId: id, roleId: role!.id })
  }
  return id
}

beforeEach(async () => {
  resetRateLimits()
  await db.delete(users)
  await db.delete(roles)
})

describe('Die Drossel', () => {
  it(`lässt ${SIGN_IN_ATTEMPTS_PER_MINUTE} Versuche zu und sperrt den nächsten`, async () => {
    await createAccount('mmustermann')

    const statuses: number[] = []
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      statuses.push((await signIn('mmustermann', 'falsch-aber-lang-genug')).status)
    }

    expect(statuses.slice(0, SIGN_IN_ATTEMPTS_PER_MINUTE)).not.toContain(429)
    expect(statuses.at(-1)).toBe(429)
  })

  it('antwortet auf 429 mit einem deutschen Satz und Retry-After', async () => {
    await createAccount('mmustermann')
    let response!: Response
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      response = await signIn('mmustermann', 'falsch-aber-lang-genug')
    }

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await response.text()).toContain('Zu viele Versuche')
  })

  it('lässt sich nicht durch einen erfundenen Weiterleitungs-Header umgehen', async () => {
    // Der Kern von B-003 und B-054: ohne konfigurierten Proxy zählt die
    // Socket-Adresse. Ein Angreifer, der bei jedem Versuch eine andere
    // Adresse behauptet, landet trotzdem im selben Eimer.
    await createAccount('mmustermann')

    const statuses: number[] = []
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      statuses.push((await signIn('mmustermann', 'falsch-aber-lang-genug', {
        'x-forwarded-for': `203.0.113.${attempt}`,
      })).status)
    }

    expect(statuses.at(-1)).toBe(429)
  })

  it('lässt eine erfolgreiche Anmeldung durch', async () => {
    await createAccount('mmustermann')
    expect((await signIn('mmustermann')).status).toBe(200)
  })

  it('zählt nur schreibende Anfragen', async () => {
    // Die Sitzung zu lesen ist kein Anmeldeversuch.
    for (let call = 0; call <= SIGN_IN_ATTEMPTS_PER_MINUTE + 5; call++) {
      const response = await request('/api/auth/get-session')
      expect(response.status).not.toBe(429)
    }
  })

  it('zählt nur die Anmeldung, nicht jede Anfrage', async () => {
    await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))

    for (let call = 0; call <= SIGN_IN_ATTEMPTS_PER_MINUTE + 5; call++) {
      expect((await request('/api/customers', { headers: { cookie } })).status).toBe(200)
    }
  })
})

describe('Der zweite Riegel vor /api', () => {
  it('weist einen Endpoint ohne Sitzung mit 401 ab, auch ohne eigenen Wächter', async () => {
    // B-041: beim Vorgänger hing die Sicherheit vollständig daran, dass jede
    // einzelne Funktion ihren Wächter nicht vergisst.
    const response = await request('/api/unguarded')
    expect(response.status).toBe(401)
    expect(await response.text()).toContain('Bitte melden Sie sich an.')
  })

  it('lässt den Gesundheitsendpunkt ohne Sitzung durch', async () => {
    expect((await request('/api/health')).status).toBe(200)
  })

  it('lässt die Anmeldung selbst ohne Sitzung durch', async () => {
    await createAccount('mmustermann')
    expect((await signIn('mmustermann')).status).toBe(200)
  })

  it('lässt einen Seitenaufruf in Ruhe', async () => {
    // Die Middleware bewacht `/api`. Seiten regelt die Route-Middleware im
    // Browser; ein 401 auf `/customers` wäre eine leere Seite statt einer
    // Anmeldung.
    const response = await request('/customers')
    expect(response.status).not.toBe(401)
  })
})

describe('Sitzung und Rechte am Endpoint', () => {
  it('liefert ohne Sitzung 401', async () => {
    expect((await request('/api/customers')).status).toBe(401)
  })

  it('liefert mit Sitzung, aber ohne Recht, 403', async () => {
    await createAccount('mmustermann', ['orders'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const response = await request('/api/customers', { headers: { cookie } })
    expect(response.status).toBe(403)
    expect(await response.text()).toContain('Kunden')
  })

  it('liefert mit Recht die Daten', async () => {
    await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const response = await request('/api/customers', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
  })

  it('lässt den Administrator mit dem Platzhalter überall hin', async () => {
    await createAccount('chefin', ['*'])
    const cookie = cookieOf(await signIn('chefin'))
    expect((await request('/api/customers', { headers: { cookie } })).status).toBe(200)
  })

  it('beendet den Zugriff, sobald das Konto deaktiviert wird', async () => {
    // Die Sitzung besteht noch; die Prüfung bei jedem Request ist es, die
    // greift.
    const id = await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))
    expect((await request('/api/customers', { headers: { cookie } })).status).toBe(200)

    await db.update(users).set({ active: false }).where(eq(users.id, id))

    expect((await request('/api/customers', { headers: { cookie } })).status).toBe(401)
  })
})

describe('Nur ausgewählte Endpunkte der Bibliothek', () => {
  it.each([
    ['/api/auth/update-user', 'ließe den Benutzernamen ändern'],
    ['/api/auth/is-username-available', 'verriete, welche Zugänge es gibt'],
    ['/api/auth/list-sessions', 'gehört der Verwaltung, nicht dem Konto'],
    ['/api/auth/sign-up/email', 'es gibt keine Selbstregistrierung'],
    ['/api/auth/forget-password', 'es gibt kein Zurücksetzen per Mail'],
  ])('sperrt %s (%s)', async (path) => {
    const response = await request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(response.status).toBe(404)
  })

  it.each([
    '/api/auth/sign-in/username',
    '/api/auth/sign-out',
    '/api/auth/get-session',
    '/api/auth/change-password',
  ])('lässt %s zu', (path) => {
    expect(isExposedAuthEndpoint(path)).toBe(true)
  })
})

describe('Regression', () => {
  it('B-052: die Verfügbarkeitsabfrage für Benutzernamen ist nicht erreichbar', async () => {
    // Der Vorgänger bot sie ohne Sitzung an. Damit ließ sich durchprobieren,
    // welche Benutzernamen es gibt — obwohl ADR-013 genau das ausschließt.
    const response = await request('/api/auth/is-username-available', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'chefin' }),
    })
    expect(response.status).toBe(404)
  })

  it('B-051: der eigene Benutzername lässt sich nicht ändern', async () => {
    await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const response = await request('/api/auth/update-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ username: 'chefin' }),
    })
    expect(response.status).toBe(404)

    const [user] = await db.select().from(users).where(eq(users.username, 'mmustermann'))
    expect(user).toBeDefined()
  })

  it('B-041: ein vergessener Wächter ist kein offener Datenzugriff', async () => {
    expect((await request('/api/unguarded')).status).toBe(401)
  })
})

describe('GET /api/me', () => {
  it('antwortet ohne Sitzung mit einem leeren Zustand', async () => {
    // Die Anmeldeseite rendert damit, ohne dass der Server einen Fehler wirft.
    const response = await request('/api/me')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: null, permissions: [], modules: {} })
  })

  it('nennt Benutzer, Rollen und Rechte', async () => {
    await createAccount('mmustermann', ['customers', 'orders'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const body = await (await request('/api/me', { headers: { cookie } })).json() as {
      user: { username: string, displayName: string, roles: string[] }
      permissions: string[]
      modules: Record<string, boolean>
    }

    expect(body.user.username).toBe('mmustermann')
    expect(body.user.displayName).toBe('Testperson')
    expect(body.user.roles).toEqual(['Rolle mmustermann'])
    expect(body.permissions).toEqual(['customers', 'orders'])
  })

  it('beantwortet je Modul, ob es sichtbar ist', async () => {
    await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const body = await (await request('/api/me', { headers: { cookie } })).json() as {
      modules: Record<string, boolean>
    }

    expect(body.modules.customers).toBe(true)
    expect(body.modules.settings).toBe(false)
    expect(Object.keys(body.modules).length).toBeGreaterThan(10)
  })

  it('gibt dem Administrator jedes Modul', async () => {
    await createAccount('chefin', ['*'])
    const cookie = cookieOf(await signIn('chefin'))

    const body = await (await request('/api/me', { headers: { cookie } })).json() as {
      modules: Record<string, boolean>
    }

    expect(Object.values(body.modules).every(Boolean)).toBe(true)
  })

  it('verrät kein Passwort und keine Adresse', async () => {
    await createAccount('mmustermann', ['customers'])
    const cookie = cookieOf(await signIn('mmustermann'))

    const text = await (await request('/api/me', { headers: { cookie } })).text()
    expect(text).not.toContain('twincars.local')
    expect(text).not.toContain('password')
  })
})

describe('GET /api/health', () => {
  it('antwortet ohne Sitzung', async () => {
    const response = await request('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok' })
  })
})
