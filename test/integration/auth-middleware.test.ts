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

const config = installNitroGlobals()

const securityHeaders = (await import('../../server/middleware/00.security-headers.ts')).default
const throttle = (await import('../../server/middleware/01.throttle.ts')).default
const session = (await import('../../server/middleware/02.auth.ts')).default
const apiGuard = (await import('../../server/middleware/03.api-guard.ts')).default
const { resetRateLimits } = await import('../../server/utils/rate-limit.ts')
const { SIGN_IN_ATTEMPTS_PER_ACCOUNT } = await import('../../server/middleware/01.throttle.ts')
const { recordSignInAttempt, failedAttemptsSince } = await import('../../server/utils/sign-in-log.ts')
const { signInAttempts } = await import('../../server/database/schema/index.ts')
const { resetAuth, SIGN_IN_ATTEMPTS_PER_MINUTE } = await import('../../server/utils/auth.ts')
const { createUserWithCredential } = await import('../../server/utils/auth-accounts.ts')
const { addressLocks, auditLog, companySettings, rolePermissions, roles, userRoles, users } = await import('../../server/database/schema/index.ts')
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
  app.use(securityHeaders)
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
  await db.delete(auditLog)
  await db.delete(signInAttempts)
  await db.delete(users)
  await db.delete(roles)
  await db.delete(addressLocks)
  await db.delete(companySettings)
})

describe('Die Drossel', () => {
  it(`lässt ${SIGN_IN_ATTEMPTS_PER_MINUTE} Versuche zu und sperrt den nächsten`, async () => {
    // Mit **richtigem** Passwort, denn sonst greift vorher die Staffel (P-13):
    // fünf Fehlversuche sperren den Anschluss schon. Geprüft werden soll hier der
    // Minutenzähler — die erste, billige Abwehr, die noch vor jeder Abfrage
    // steht und eine Flut abfängt, egal ob sie richtig oder falsch rät.
    await createAccount('mmustermann')

    const statuses: number[] = []
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      statuses.push((await signIn('mmustermann', PASSWORD)).status)
    }

    expect(statuses.slice(0, SIGN_IN_ATTEMPTS_PER_MINUTE)).not.toContain(429)
    expect(statuses.at(-1)).toBe(429)
  })

  it('P-13: die Staffel greift früher als der Minutenzähler', async () => {
    // Die Reihenfolge, festgehalten: der Anschluss ist nach fünf Fehlversuchen
    // dicht — noch bevor der Minutenzähler bei zehn steht. Das Konto selbst
    // hätte hier erst bei zehn zugemacht; die schärfere der beiden Staffeln
    // gewinnt (P-15).
    await createAccount('mmustermann')

    const statuses: number[] = []
    for (let attempt = 0; attempt < 7; attempt++) {
      statuses.push((await signIn('mmustermann', 'falsch-aber-lang-genug')).status)
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses.slice(5)).toEqual([429, 429])
  })

  it('antwortet auf 429 mit einem deutschen Satz und Retry-After', async () => {
    await createAccount('mmustermann')
    let response!: Response
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      response = await signIn('mmustermann', PASSWORD)
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
      statuses.push((await signIn('mmustermann', PASSWORD, {
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

describe('M-36: die Drossel zählt auch je Konto', () => {
  it('M-36: der Kontozähler greift, auch wenn die Adresse jedes Mal wechselt', async () => {
    // Der eigentliche Fall. Ohne diesen Zähler verteilt ein Angreifer seine
    // Versuche über viele Adressen auf ein einziges Konto und füllt nie einen
    // Eimer. Hier bekommt jeder Versuch eine andere Adresse — der Adresszähler
    // greift also nie, und trotzdem ist nach einer Weile Schluss.
    await createAccount('mmustermann')
    config.trustProxy = 'on'
    try {
      const statuses: number[] = []
      for (let attempt = 0; attempt < 12; attempt++) {
        statuses.push((await signIn('mmustermann', 'falsch-aber-lang-genug', {
          'x-forwarded-for': `203.0.113.${attempt}`,
        })).status)
      }

      // Jeder Versuch kam von einer anderen Adresse, der Adresszähler war also
      // nie voll — und trotzdem ist nach zehn Schluss. Genau dafür gibt es die
      // Zählung am Konto.
      expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 401))
      expect(statuses.at(-1)).toBe(429)
    }
    finally {
      config.trustProxy = 'off'
    }
  })

  it('M-36: die Sperre wegen Drossel steht im Protokoll', async () => {
    await createAccount('mmustermann')
    config.trustProxy = 'on'
    try {
      for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_ACCOUNT; attempt++) {
        await signIn('mmustermann', 'falsch-aber-lang-genug', {
          'x-forwarded-for': `198.51.100.${attempt}`,
        })
      }
    }
    finally {
      config.trustProxy = 'off'
    }

    const rows = await db.select().from(signInAttempts)
    expect(rows.map(row => row.reason)).toContain('drossel')
  })

  it('M-36: ein Versuch ohne brauchbaren Benutzernamen füllt keinen Kontozähler', async () => {
    // Sonst legte ein Angreifer mit leerem Feld beliebig viele Eimer an.
    const response = await request('/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'ohne-namen' }),
    })
    expect(response.status).not.toBe(429)
  })

  it('M-36: der Kontozähler ist großzügiger als der Adresszähler', () => {
    // Im Betrieb sitzen mehrere Leute hinter derselben Adresse und dürfen sich
    // vertippen. Aber nicht beliebig oft auf dasselbe Konto.
    expect(SIGN_IN_ATTEMPTS_PER_ACCOUNT).toBeGreaterThan(SIGN_IN_ATTEMPTS_PER_MINUTE)
    expect(SIGN_IN_ATTEMPTS_PER_ACCOUNT).toBeLessThanOrEqual(30)
  })

  it('M-36: gescheiterte Versuche hinterlassen eine Spur', async () => {
    // Eine Drossel hält das Durchprobieren auf, macht es aber nicht sichtbar.
    const since = new Date(Date.now() - 60_000)

    await recordSignInAttempt({
      username: 'MMustermann',
      clientAddress: '203.0.113.7',
      succeeded: false,
      reason: 'passwort',
    }, db)
    await recordSignInAttempt({
      username: 'mmustermann',
      clientAddress: '203.0.113.8',
      succeeded: false,
      reason: 'unbekannt',
    }, db)
    await recordSignInAttempt({
      username: 'mmustermann',
      clientAddress: '203.0.113.7',
      succeeded: true,
    }, db)

    // Groß geschrieben oder klein — derselbe Zugang, derselbe Zähler.
    expect(await failedAttemptsSince('mmustermann', since, db)).toBe(2)
  })

  it('M-36: auch ein Versuch auf einen Namen, den es nicht gibt, wird notiert', async () => {
    // Gerade der ist interessant: wer erfundene Namen durchprobiert, sucht.
    await recordSignInAttempt({
      username: 'gibtsnicht',
      clientAddress: '203.0.113.9',
      succeeded: false,
      reason: 'unbekannt',
    }, db)

    const rows = await db.select().from(signInAttempts)
    expect(rows.map(row => row.username)).toContain('gibtsnicht')
  })

  it('M-36: ein Fehler beim Protokollieren sperrt niemanden aus', async () => {
    // Ein volles oder kaputtes Protokoll darf die Anmeldung nicht anhalten.
    const broken = {
      insert: () => {
        throw new Error('Protokoll kaputt')
      },
    }
    await expect(recordSignInAttempt(
      { username: 'egal', clientAddress: null, succeeded: true },
      broken as never,
    )).resolves.toBeUndefined()
  })
})

/* ── P-13, P-15 und P-22: die gestaffelte Sperre ────────────────────────────
   Eine Minutengrenze ist eine Bremse: wer wartet, kommt durch. Hier zählt ein
   Tag, und die Folgen steigen mit jeder Stufe. Gezählt wird mit zwei Maßen:
   das Konto großzügig (10/20/40), die Adresse streng (5/10/20) — wer einen
   Namen errät, den es nicht gibt, sucht nicht sein Passwort. Was im sicheren
   Bereich der Einstellungen liegt, wird nie gesperrt (P-22). */

const {
  accountLock,
  addressLock,
  accountExists,
  unlockAccount,
  unlockAddress,
  lockedAddresses,
  noteSignInOutcome,
  lockMessage,
  safeRangeSetting,
  ACCOUNT_STEPS,
  ADDRESS_STEPS,
  LOCK_WINDOW_MS,
} = await import('../../server/utils/account-lock.ts')

/** Trägt einen sicheren Adressbereich in die Einstellungen ein (P-22). */
const setSafeRanges = (ranges: string) =>
  db.insert(companySettings).values({ safeIpRanges: ranges })

/** Schreibt Fehlversuche ins Protokoll, älteste zuerst. */
async function failAttempts(
  count: number,
  options: { username?: string, address?: string, minutesAgo?: number, reason?: string } = {},
): Promise<void> {
  if (count === 0) return
  const base = Date.now() - (options.minutesAgo ?? 0) * 60_000
  await db.insert(signInAttempts).values(
    Array.from({ length: count }, (_, index) => ({
      username: options.username ?? 'mmustermann',
      clientAddress: options.address ?? '203.0.113.1',
      succeeded: false,
      reason: (options.reason ?? 'passwort') as never,
      at: new Date(base - index * 1000).toISOString(),
    })),
  )
}

const MINUTES = 60 * 1000

describe('P-21: die Kopfzeilen liegen auf jeder Antwort', () => {
  it('P-21: auch auf der abgewiesenen', async () => {
    // Deshalb steht das Zwischenstück an erster Stelle. Hinter dem Wächter
    // käme eine 401-Antwort ohne jede Richtlinie heraus.
    const response = await request('/api/customers')
    expect(response.status).toBe(401)
    expect(response.headers.get('content-security-policy')).toContain('default-src')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('P-21: auch auf der gedrosselten', async () => {
    await createAccount('mmustermann')
    let response!: Response
    for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_MINUTE; attempt++) {
      response = await signIn('mmustermann', PASSWORD)
    }

    expect(response.status).toBe(429)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('P-21: auch auf der erfolgreichen', async () => {
    await createAccount('mmustermann')
    const response = await signIn('mmustermann', PASSWORD)
    expect(response.status).toBe(200)
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
  })
})

describe('M-39: die Anmeldung landet im großen Protokoll', () => {
  it('M-39: ein unbekannter Benutzername wird als solcher festgehalten', async () => {
    // Gerade der ist interessant: wer erfundene Namen durchprobiert, sucht.
    const response = await signIn('gibtsnicht', 'irgendein-passwort')
    expect(response.status).toBe(401)

    const versuche = await db.select().from(signInAttempts)
    expect(versuche.map(row => row.reason)).toContain('unbekannt')

    const protokoll = await db.select().from(auditLog)
    const eintrag = protokoll.find(row => row.entityId === 'gibtsnicht')
    expect(eintrag?.severity).toBe('sicherheit')
    expect(eintrag?.action).toBe('abgewiesen')
    expect(eintrag?.note).toContain('Unbekannter Benutzername')
  })

  it('M-39: ein falsches Passwort wird als solches festgehalten', async () => {
    await createAccount('mmustermann')
    await signIn('mmustermann', 'falsch-aber-lang-genug')

    const protokoll = await db.select().from(auditLog)
    expect(protokoll.at(-1)?.note).toContain('Falsches Passwort')
  })

  it('M-39: die gelungene Anmeldung steht ebenfalls darin', async () => {
    await createAccount('mmustermann')
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(200)

    const protokoll = await db.select().from(auditLog)
    const eintrag = protokoll.at(-1)
    expect(eintrag?.action).toBe('angemeldet')
    expect(eintrag?.severity).toBe('sicherheit')
  })

  // Der **abgewiesene** Zugriff (P-18) wird vom Fehler-Haken protokolliert,
  // und der läuft nur unter Nitro. Er steht deshalb im End-to-End-Lauf
  // (`test/e2e/ssr.test.ts`), nicht hier.
})

describe('P-13: die Staffel greift nach Anzahl der Fehlversuche', () => {
  it('P-13: neun Fehlversuche sperren das Konto noch nicht', async () => {
    await createAccount('mmustermann')
    await failAttempts(9)
    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(false)
  })

  it('P-13: ab zehn Fehlversuchen sind es zehn Minuten', async () => {
    await createAccount('mmustermann')
    await failAttempts(10)

    const lock = await accountLock('mmustermann', new Date(), db)
    expect(lock.locked).toBe(true)
    expect(lock.permanent).toBe(false)
    expect(lock.retryAfter).toBeGreaterThan(8 * 60)
    expect(lock.retryAfter).toBeLessThanOrEqual(10 * 60)
  })

  it('P-13: ab zwanzig Fehlversuchen sind es 24 Stunden', async () => {
    await createAccount('mmustermann')
    await failAttempts(20)

    const lock = await accountLock('mmustermann', new Date(), db)
    expect(lock.locked).toBe(true)
    expect(lock.permanent).toBe(false)
    expect(lock.retryAfter).toBeGreaterThan(23 * 60 * 60)
  })

  it('P-13: ab vierzig Fehlversuchen ist dauerhaft Schluss', async () => {
    // Hier läuft nichts mehr ab. Nur der Administrator öffnet wieder.
    await createAccount('mmustermann')
    await failAttempts(40)

    const lock = await accountLock('mmustermann', new Date(), db)
    expect(lock.locked).toBe(true)
    expect(lock.permanent).toBe(true)
    expect(lock.until).toBeUndefined()
  })

  it('P-13: eine festgehaltene Sperre läuft auch nach einem Jahr nicht ab', async () => {
    // Der Grund, warum die letzte Stufe am Benutzer steht und nicht gerechnet
    // wird: die Fehlversuche fallen nach einem Tag aus dem Fenster. Gerechnet
    // wäre die „dauerhafte" Sperre danach weg.
    await createAccount('mmustermann')
    await failAttempts(40)
    await noteSignInOutcome({ username: 'mmustermann', succeeded: false, known: true }, new Date(), db)

    const inEinemJahr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const lock = await accountLock('mmustermann', inEinemJahr, db)
    expect(lock.locked).toBe(true)
    expect(lock.permanent).toBe(true)
  })

  it('P-13: die letzte Stufe wird erst festgehalten, wenn sie erreicht ist', async () => {
    await createAccount('mmustermann')
    await failAttempts(39)
    await noteSignInOutcome({ username: 'mmustermann', succeeded: false, known: true }, new Date(), db)

    const [row] = await db.select({ lockedAt: users.lockedAt })
      .from(users).where(eq(users.username, 'mmustermann'))
    expect(row?.lockedAt).toBeNull()
  })

  it('P-13: ein unbekannter Name hält am Konto nichts fest', async () => {
    // Es gibt keines. Gesperrt wird dann die Adresse (P-15).
    await failAttempts(40, { username: 'gibtsnicht', reason: 'unbekannt' })
    await expect(
      noteSignInOutcome({ username: 'gibtsnicht', succeeded: false, known: false }, new Date(), db),
    ).resolves.toBeUndefined()

    expect((await db.select().from(users)).length).toBe(0)
  })

  it('P-13: ein Fehler beim Festhalten sperrt die Anmeldung nicht', async () => {
    const broken = {
      select: () => {
        throw new Error('Datenbank weg')
      },
    }
    await expect(
      noteSignInOutcome({ username: 'egal', succeeded: false, known: true }, new Date(), broken as never),
    ).resolves.toBeUndefined()
  })

  it('P-13: eine gelungene Anmeldung hält gar nichts fest', async () => {
    await createAccount('mmustermann')
    await failAttempts(40)
    await noteSignInOutcome(
      { username: 'mmustermann', succeeded: true, known: true, clientAddress: '203.0.113.1' },
      new Date(),
      db,
    )

    const [row] = await db.select({ lockedAt: users.lockedAt })
      .from(users).where(eq(users.username, 'mmustermann'))
    expect(row?.lockedAt).toBeNull()
    expect((await db.select().from(addressLocks)).length).toBe(0)
  })

  it('P-13: die zehn Minuten laufen ab dem letzten Versuch', async () => {
    await createAccount('mmustermann')
    await failAttempts(10, { minutesAgo: 9 })

    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(true)
    const gleich = new Date(Date.now() + 2 * MINUTES)
    expect((await accountLock('mmustermann', gleich, db)).locked).toBe(false)
  })

  it('P-13: was älter als 24 Stunden ist, zählt nicht mehr', async () => {
    // Der Punkt der Entscheidung: „fünf Fehlanmeldungen über ein Jahr verteilt
    // dürfen nicht zur Sperre führen."
    await createAccount('mmustermann')
    await failAttempts(20, { minutesAgo: 25 * 60 })
    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(false)
  })

  it('P-13: über ein Jahr verteilte Fehlversuche sperren nichts', async () => {
    await createAccount('mmustermann')
    for (let month = 0; month < 12; month++) {
      await failAttempts(1, { minutesAgo: month * 30 * 24 * 60 + 60 })
    }

    // Nur der jüngste liegt noch im Zählfenster; die elf älteren sind heraus.
    const lock = await accountLock('mmustermann', new Date(), db)
    expect(lock.locked).toBe(false)
    expect(lock.failures).toBe(1)
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)
  })

  it('P-13: eine gelungene Anmeldung setzt die Zählung zurück', async () => {
    await createAccount('mmustermann')
    await failAttempts(20, { minutesAgo: 30 })
    await db.insert(signInAttempts).values({
      username: 'mmustermann',
      clientAddress: '203.0.113.1',
      succeeded: true,
      at: new Date(Date.now() - 60_000).toISOString(),
    })
    await failAttempts(2)

    const lock = await accountLock('mmustermann', new Date(), db)
    expect(lock.locked).toBe(false)
    expect(lock.failures).toBe(2)
  })

  it('P-13: das Entsperren wirkt sofort, auch bei der dauerhaften Sperre', async () => {
    await createAccount('mmustermann')
    await failAttempts(40)
    expect((await accountLock('mmustermann', new Date(), db)).permanent).toBe(true)

    expect(await unlockAccount('mmustermann', new Date(), db)).toBe(true)
    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(false)
  })

  it('P-13: das Entsperren löscht das Protokoll nicht', async () => {
    await createAccount('mmustermann')
    await failAttempts(40)
    await unlockAccount('mmustermann', new Date(), db)

    expect((await db.select().from(signInAttempts)).length).toBe(40)
  })

  it('P-13: die Staffeln stehen so, wie P-15 sie festlegt', () => {
    expect(ACCOUNT_STEPS.map(step => step.failures)).toEqual([40, 20, 10])
    expect(ADDRESS_STEPS.map(step => step.failures)).toEqual([20, 10, 5])

    for (const steps of [ACCOUNT_STEPS, ADDRESS_STEPS]) {
      expect(steps[0]!.duration).toBeNull()
      expect(steps[1]!.duration).toBe(24 * 60 * 60 * 1000)
      expect(steps[2]!.duration).toBe(10 * 60 * 1000)
    }

    // Die Adresse ist überall strenger als das Konto — das ist der Kern der
    // Entscheidung: „stimmt der Benutzername, 10 Fehlversuche; sonst 5."
    for (let step = 0; step < ACCOUNT_STEPS.length; step++) {
      expect(ADDRESS_STEPS[step]!.failures).toBeLessThan(ACCOUNT_STEPS[step]!.failures)
    }

    expect(LOCK_WINDOW_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('P-13: der Satz nennt die verbleibende Zeit in lesbaren Einheiten', () => {
    expect(lockMessage({ locked: true, scope: 'konto', permanent: false, retryAfter: 600, failures: 10 }))
      .toContain('10 Minuten')
    expect(lockMessage({ locked: true, scope: 'konto', permanent: false, retryAfter: 86_400, failures: 20 }))
      .toContain('24 Stunden')
    expect(lockMessage({ locked: true, scope: 'konto', permanent: true, retryAfter: 0, failures: 40 }))
      .toContain('Verwaltung')
  })

  it('P-13: die Anmeldung antwortet mit 429 und einem deutschen Satz', async () => {
    // Zehn Fehlversuche von zehn verschiedenen Adressen: das Konto ist dicht,
    // der Anschluss nicht. So steht im Satz wirklich „Dieses Konto".
    await createAccount('mmustermann')
    for (let attempt = 0; attempt < 10; attempt++) {
      await failAttempts(1, { address: `203.0.113.${attempt + 20}` })
    }

    const response = await signIn('mmustermann', PASSWORD)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()

    const body = await response.json() as { statusMessage?: string, message?: string }
    expect(body.statusMessage ?? body.message ?? '').toContain('Dieses Konto')
  })

  it('P-13: auch das richtige Passwort kommt während der Sperre nicht durch', async () => {
    await createAccount('mmustermann')
    for (let attempt = 0; attempt < 10; attempt++) {
      await failAttempts(1, { address: `203.0.113.${attempt + 20}` })
    }
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(429)

    await unlockAccount('mmustermann', new Date(), db)
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(200)
  })
})

describe('P-15: Konto und Anschluss werden getrennt gezählt', () => {
  it('P-15: ein unbekannter Benutzername sperrt den Anschluss ab fünf Versuchen', async () => {
    // Es gibt kein Konto, das man sperren könnte — und genau dieses Muster
    // verrät den Angriff: jemand probiert Namen durch. Deshalb die Hälfte der
    // Geduld, die ein bekanntes Konto bekommt.
    await failAttempts(4, { username: 'gibtsnicht', reason: 'unbekannt' })
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)

    await failAttempts(1, { username: 'gibtsnicht', reason: 'unbekannt' })
    const lock = await addressLock('203.0.113.1', new Date(), db)
    expect(lock.locked).toBe(true)
    expect(lock.scope).toBe('adresse')
  })

  it('P-15: der Anschluss zählt über alle Benutzernamen hinweg', async () => {
    for (const name of ['anna', 'bernd', 'clara', 'dora', 'emil']) {
      await failAttempts(1, { username: name, reason: 'unbekannt' })
    }

    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(true)
  })

  it('P-15: die Adressstaffel steigt wie die des Kontos', async () => {
    await failAttempts(10, { username: 'gibtsnicht', reason: 'unbekannt' })
    const nachZehn = await addressLock('203.0.113.1', new Date(), db)
    expect(nachZehn.permanent).toBe(false)
    expect(nachZehn.retryAfter).toBeGreaterThan(23 * 60 * 60)

    await failAttempts(10, { username: 'gibtsnicht', reason: 'unbekannt' })
    expect((await addressLock('203.0.113.1', new Date(), db)).permanent).toBe(true)
  })

  it('P-15: ein anderer Anschluss bleibt davon unberührt', async () => {
    await failAttempts(20, { username: 'gibtsnicht', reason: 'unbekannt' })

    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(true)
    expect((await addressLock('198.51.100.9', new Date(), db)).locked).toBe(false)
  })

  it('P-15: eine abgewiesene Anfrage zählt nicht als neuer Fehlversuch', async () => {
    // Sonst zählte sich eine Sperre selbst hoch: jeder abgewiesene Versuch
    // erzeugte einen Protokolleintrag, der die Sperre verlängert.
    await failAttempts(4, { reason: 'passwort' })
    await failAttempts(50, { reason: 'adresssperre' })

    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)
  })

  it('P-15: eine gelungene Anmeldung von hier setzt die Zählung zurück', async () => {
    await failAttempts(10, { minutesAgo: 30 })
    await db.insert(signInAttempts).values({
      username: 'mmustermann',
      clientAddress: '203.0.113.1',
      succeeded: true,
      at: new Date(Date.now() - 60_000).toISOString(),
    })

    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)
  })

  it('P-15: ohne Adresse wird nichts gesperrt', async () => {
    expect((await addressLock(null, new Date(), db)).locked).toBe(false)
    expect((await addressLock('  ', new Date(), db)).locked).toBe(false)
  })

  it('P-15: ein bekanntes Konto sperrt beides — Konto und Anschluss', async () => {
    await createAccount('mmustermann')
    await failAttempts(10, { reason: 'passwort' })

    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(true)
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(true)
  })

  it('P-15: die Adresssperre gilt auch für einen anderen, gültigen Benutzernamen', async () => {
    // Der Punkt einer Adresssperre: wer sie sich verspielt hat, kommt von hier
    // aus gar nicht mehr weiter.
    await createAccount('zweiter')
    await failAttempts(5, { username: 'gibtsnicht', address: '203.0.113.77', reason: 'unbekannt' })

    config.trustProxy = 'on'
    try {
      const response = await signIn('zweiter', PASSWORD, { 'x-forwarded-for': '203.0.113.77' })
      expect(response.status).toBe(429)
      const body = await response.json() as { statusMessage?: string, message?: string }
      expect(body.statusMessage ?? body.message ?? '').toContain('Anschluss')
    }
    finally {
      config.trustProxy = 'off'
    }
  })

  it('P-15: das Entsperren des Kontos öffnet den Anschluss nicht mit', async () => {
    // Zwei verschiedene Sperren, zwei verschiedene Gründe.
    await createAccount('mmustermann')
    await failAttempts(10)
    await unlockAccount('mmustermann', new Date(), db)

    expect((await accountLock('mmustermann', new Date(), db)).locked).toBe(false)
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(true)
  })

  it('P-15: die Adresssperre steht als eigener Grund im Protokoll', async () => {
    await createAccount('mmustermann')
    await failAttempts(5, { username: 'gibtsnicht', address: '203.0.113.78', reason: 'unbekannt' })

    config.trustProxy = 'on'
    try {
      await signIn('mmustermann', PASSWORD, { 'x-forwarded-for': '203.0.113.78' })
    }
    finally {
      config.trustProxy = 'off'
    }

    const rows = await db.select().from(signInAttempts)
    expect(rows.map(row => row.reason)).toContain('adresssperre')
  })

  it('P-15: `accountExists` entscheidet, was gesperrt wird', async () => {
    await createAccount('mmustermann')
    expect(await accountExists('MMustermann', db)).toBe(true)
    expect(await accountExists('gibtsnicht', db)).toBe(false)
    expect(await accountExists('', db)).toBe(false)
  })
})

describe('P-15: die dauerhafte Adresssperre wird festgehalten', () => {
  it('P-15: sie läuft auch nach einem Jahr nicht ab', async () => {
    // Derselbe Grund wie beim Konto: gerechnet wäre sie nach 24 Stunden von
    // selbst weg, weil die Fehlversuche aus dem Zählfenster fallen.
    await failAttempts(20, { username: 'gibtsnicht', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.1' },
      new Date(),
      db,
    )

    const inEinemJahr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const lock = await addressLock('203.0.113.1', inEinemJahr, db)
    expect(lock.locked).toBe(true)
    expect(lock.permanent).toBe(true)
    expect(lock.scope).toBe('adresse')
  })

  it('P-15: unterhalb der obersten Stufe wird nichts festgehalten', async () => {
    await failAttempts(19, { username: 'gibtsnicht', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.1' },
      new Date(),
      db,
    )

    expect((await db.select().from(addressLocks)).length).toBe(0)
  })

  it('P-15: ein zweiter Fehlversuch datiert die Sperre nicht vor', async () => {
    // Sonst machte ein einzelnes Klopfen nach der Freigabe diese rückgängig.
    await failAttempts(20, { username: 'gibtsnicht', reason: 'unbekannt' })
    const zuerst = new Date(Date.now() - 5 * MINUTES)
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.1' },
      zuerst,
      db,
    )

    const [vorher] = await db.select().from(addressLocks)
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.1' },
      new Date(),
      db,
    )

    const [nachher] = await db.select().from(addressLocks)
    expect(nachher?.lockedAt?.getTime()).toBe(vorher?.lockedAt?.getTime())
  })
})

describe('P-15: der Administrator hebt eine Adresssperre auf', () => {
  it('P-15: der Knopf wirkt sofort', async () => {
    await failAttempts(5, { username: 'gibtsnicht', reason: 'unbekannt' })
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(true)

    expect(await unlockAddress('203.0.113.1', { userName: 'Chefin' }, new Date(), db)).toBe(true)
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)
  })

  it('P-15: er wirkt auch auf die dauerhafte Sperre', async () => {
    await failAttempts(20, { username: 'gibtsnicht', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.1' },
      new Date(),
      db,
    )
    expect((await addressLock('203.0.113.1', new Date(), db)).permanent).toBe(true)

    await unlockAddress('203.0.113.1', { userName: 'Chefin' }, new Date(), db)
    expect((await addressLock('203.0.113.1', new Date(), db)).locked).toBe(false)
  })

  it('P-15: er hält fest, wer ihn gedrückt hat', async () => {
    await unlockAddress('203.0.113.1', { userId: null, userName: 'Chefin' }, new Date(), db)

    const [row] = await db.select().from(addressLocks)
    expect(row?.address).toBe('203.0.113.1')
    expect(row?.unlockedByName).toBe('Chefin')
    expect(row?.unlockedAt).toBeInstanceOf(Date)
  })

  it('P-15: er wirkt auch, wenn es noch gar keine Zeile gab', async () => {
    // Die gerechneten Stufen hinterlassen keine — trotzdem muss der Knopf
    // wirken, sonst ist er in genau dem Fall wirkungslos, der am häufigsten
    // vorkommt.
    expect((await db.select().from(addressLocks)).length).toBe(0)
    expect(await unlockAddress('198.51.100.3', {}, new Date(), db)).toBe(true)
    expect((await db.select().from(addressLocks)).length).toBe(1)
  })

  it('P-15: eine zweite Freigabe legt keine zweite Zeile an', async () => {
    await unlockAddress('203.0.113.1', { userName: 'Erste' }, new Date(), db)
    await unlockAddress('203.0.113.1', { userName: 'Zweite' }, new Date(), db)

    const rows = await db.select().from(addressLocks)
    expect(rows.length).toBe(1)
    expect(rows[0]?.unlockedByName).toBe('Zweite')
  })

  it('P-15: eine leere Adresse wird nicht freigegeben', async () => {
    expect(await unlockAddress('   ', {}, new Date(), db)).toBe(false)
    expect((await db.select().from(addressLocks)).length).toBe(0)
  })

  it('P-15: nach der Freigabe zählt nur noch, was danach kam', async () => {
    await failAttempts(10, { username: 'gibtsnicht', minutesAgo: 10, reason: 'unbekannt' })
    await unlockAddress('203.0.113.1', {}, new Date(Date.now() - 5 * MINUTES), db)
    await failAttempts(2, { username: 'gibtsnicht', reason: 'unbekannt' })

    const lock = await addressLock('203.0.113.1', new Date(), db)
    expect(lock.locked).toBe(false)
    expect(lock.failures).toBe(2)
  })
})

describe('P-22: der sichere Adressbereich wird nie gesperrt', () => {
  it('P-22: leer gelassen gilt die Sperre überall — auch im eigenen Netz', async () => {
    // Die Voreinstellung. Eine Ausnahme soll jemand bewusst eintragen.
    await setSafeRanges('')
    await failAttempts(5, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })

    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(true)
  })

  it('P-22: ohne Einstellungszeile gilt die Sperre ebenfalls überall', async () => {
    await failAttempts(5, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })
    expect(await safeRangeSetting(db)).toBe('')
    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(true)
  })

  it('P-22: was eingetragen ist, wird nicht gesperrt', async () => {
    await setSafeRanges('192.168.1.0/24')
    await failAttempts(50, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })

    const lock = await addressLock('192.168.1.7', new Date(), db)
    expect(lock.locked).toBe(false)
    expect(lock.permanent).toBe(false)
  })

  it('P-22: der Nachbar außerhalb des Bereichs wird sehr wohl gesperrt', async () => {
    await setSafeRanges('192.168.1.0/24')
    await failAttempts(5, { username: 'gibtsnicht', address: '192.168.2.7', reason: 'unbekannt' })

    expect((await addressLock('192.168.2.7', new Date(), db)).locked).toBe(true)
  })

  it('P-22: auch eine festgehaltene Sperre gilt im sicheren Bereich nicht', async () => {
    // Die Reihenfolge ist wichtig: erst der sichere Bereich, dann alles
    // andere. Sonst bliebe eine Adresse gesperrt, die jemand nachträglich in
    // den sicheren Bereich aufgenommen hat — und niemand käme mehr herein.
    await failAttempts(20, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '192.168.1.7' },
      new Date(),
      db,
    )
    expect((await addressLock('192.168.1.7', new Date(), db)).permanent).toBe(true)

    await setSafeRanges('192.168.1.0/24')
    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(false)
  })

  it('P-22: im sicheren Bereich wird gar nichts erst festgehalten', async () => {
    await setSafeRanges('192.168.0.0/16')
    await failAttempts(50, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '192.168.1.7' },
      new Date(),
      db,
    )

    expect((await db.select().from(addressLocks)).length).toBe(0)
  })

  it('P-22: das Konto bleibt trotzdem sperrbar', async () => {
    // Der sichere Bereich schützt den Anschluss, nicht das Passwort. Wer aus
    // dem Büro heraus vierzigmal falsch rät, sperrt sein Konto.
    await setSafeRanges('192.168.0.0/16')
    await createAccount('mmustermann')
    await failAttempts(40, { address: '192.168.1.7' })

    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(false)
    expect((await accountLock('mmustermann', new Date(), db)).permanent).toBe(true)
  })

  it('P-22: die Anmeldung aus dem sicheren Bereich kommt durch', async () => {
    await setSafeRanges('203.0.113.0/24')
    await createAccount('mmustermann')
    await failAttempts(10, { username: 'gibtsnicht', address: '203.0.113.9', reason: 'unbekannt' })

    config.trustProxy = 'on'
    try {
      const response = await signIn('mmustermann', PASSWORD, { 'x-forwarded-for': '203.0.113.9' })
      expect(response.status).toBe(200)
    }
    finally {
      config.trustProxy = 'off'
    }
  })
})

describe('P-15: die Übersicht der gesperrten Anschlüsse', () => {
  it('P-15: nennt jeden gesperrten Anschluss mit Anzahl und Zeitpunkt', async () => {
    await failAttempts(5, { username: 'gibtsnicht', address: '203.0.113.5', reason: 'unbekannt' })

    const rows = await lockedAddresses(new Date(), db)
    expect(rows.map(row => row.address)).toEqual(['203.0.113.5'])
    expect(rows[0]?.failures).toBe(5)
    expect(rows[0]?.lastAttemptAt).toBeTruthy()
    expect(rows[0]?.scope).toBe('adresse')
  })

  it('P-15: lässt einen Anschluss weg, der noch unter der ersten Stufe liegt', async () => {
    await failAttempts(4, { username: 'gibtsnicht', address: '203.0.113.5', reason: 'unbekannt' })
    expect(await lockedAddresses(new Date(), db)).toEqual([])
  })

  it('P-15: zeigt auch den dauerhaft Gesperrten, dessen Versuche aus dem Fenster gefallen sind', async () => {
    // Gerade der gehört in die Liste — und gerade der fehlte, wenn nur nach
    // frischen Fehlversuchen gesucht würde.
    await failAttempts(20, { username: 'gibtsnicht', address: '203.0.113.6', reason: 'unbekannt' })
    await noteSignInOutcome(
      { username: 'gibtsnicht', succeeded: false, known: false, clientAddress: '203.0.113.6' },
      new Date(),
      db,
    )
    await db.delete(signInAttempts)

    const rows = await lockedAddresses(new Date(), db)
    expect(rows.map(row => row.address)).toEqual(['203.0.113.6'])
    expect(rows[0]?.permanent).toBe(true)
    expect(rows[0]?.lockedAt).toBeInstanceOf(Date)
    expect(rows[0]?.lastAttemptAt).toBeNull()
  })

  it('P-15: stellt das Dringendste nach vorn', async () => {
    await failAttempts(10, { username: 'gibtsnicht', address: '203.0.113.7', reason: 'unbekannt' })
    await failAttempts(5, { username: 'gibtsnicht', address: '203.0.113.8', reason: 'unbekannt' })
    await failAttempts(20, { username: 'gibtsnicht', address: '203.0.113.9', reason: 'unbekannt' })

    const rows = await lockedAddresses(new Date(), db)
    expect(rows.map(row => row.address)).toEqual(['203.0.113.9', '203.0.113.7', '203.0.113.8'])
    expect(rows[0]?.permanent).toBe(true)
  })

  it('P-15: lässt den sicheren Bereich heraus', async () => {
    await setSafeRanges('192.168.0.0/16')
    await failAttempts(20, { username: 'gibtsnicht', address: '192.168.1.7', reason: 'unbekannt' })
    await failAttempts(5, { username: 'gibtsnicht', address: '203.0.113.5', reason: 'unbekannt' })

    const rows = await lockedAddresses(new Date(), db)
    expect(rows.map(row => row.address)).toEqual(['203.0.113.5'])
  })

  it('P-15: ist leer, solange nichts gesperrt ist', async () => {
    expect(await lockedAddresses(new Date(), db)).toEqual([])
  })
})
