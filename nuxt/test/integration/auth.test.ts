/**
 * Signing in, sessions, and what happens when an account is switched off.
 *
 * These tests drive the real authentication library against a real PostgreSQL —
 * the same code path a browser takes, only without the browser. Nothing is
 * mocked: a password is hashed, a session row is written, a cookie comes back.
 *
 * Findings covered here: B-041 (a forgotten guard must not mean open data),
 * B-071 (no built-in fallback secret), B-051 and B-052 (the library's own
 * endpoints are an allow list), and the acceptance criteria of T-007.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { installNitroGlobals, TEST_ORIGIN } from '../setup/nitro-globals'

// The globals have to exist before the modules under test are imported,
// because building the authentication instance reads the configuration.
installNitroGlobals()

const { rolePermissions, roles, sessions, userRoles, users }
  = await import('../../server/database/schema/index.ts')
const { useAuth, resetAuth } = await import('../../server/utils/auth.ts')
const { createUserWithCredential, resetPassword } = await import('../../server/utils/auth-accounts.ts')
const {
  activateUser,
  deactivateUser,
  deleteUserSessions,
  hasAnyUser,
  hasCredential,
  isLastAdministrator,
  isUserActive,
  loadUserPermissions,
  loadUserRoles,
  setUserRoles,
  syntheticEmail,
} = await import('../../server/utils/auth-users.ts')
const { useDatabase, closeDatabase } = await import('../../server/utils/db.ts')

const db = useDatabase()

afterAll(async () => {
  resetAuth()
  await closeDatabase()
})

const PASSWORD = 'ein-gutes-passwort'

/** Signs in over the library's HTTP handler, exactly as the browser does. */
async function signIn(username: string, password: string, headers: HeadersInit = {}) {
  return useAuth().handler(new Request(`${TEST_ORIGIN}/api/auth/sign-in/username`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ username, password }),
  }))
}

async function createAccount(username: string, displayName = 'Testperson') {
  return createUserWithCredential({ username, displayName, password: PASSWORD })
}

beforeEach(async () => {
  await db.delete(users)
  await db.delete(roles)
})

describe('Konto anlegen', () => {
  it('legt Benutzer und Zugangsdaten an', async () => {
    const { id } = await createAccount('mmustermann', 'Max Mustermann')

    const [user] = await db.select().from(users).where(eq(users.id, id))
    expect(user?.username).toBe('mmustermann')
    expect(user?.name).toBe('Max Mustermann')
    expect(user?.active).toBe(true)
  })

  it('erfindet eine Adresse, die den Server nie verlässt', async () => {
    const { id } = await createAccount('mmustermann')
    const [user] = await db.select().from(users).where(eq(users.id, id))
    expect(user?.email).toBe(syntheticEmail('mmustermann'))
    expect(user?.email).toContain('@twincars.local')
  })

  it('schreibt den Benutzernamen klein', async () => {
    const { id } = await createAccount('MMustermann')
    const [user] = await db.select().from(users).where(eq(users.id, id))
    expect(user?.username).toBe('mmustermann')
  })

  it('lehnt einen bereits vergebenen Benutzernamen mit deutschem Satz ab', async () => {
    await createAccount('mmustermann')
    await expect(createAccount('mmustermann')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Diesen Benutzernamen gibt es bereits.',
    })
  })
})

describe('Anmelden', () => {
  it('gelingt mit dem richtigen Passwort', async () => {
    await createAccount('mmustermann')
    const response = await signIn('mmustermann', PASSWORD)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('tcm.session_token')
  })

  it('legt eine Sitzung in der Datenbank an', async () => {
    const { id } = await createAccount('mmustermann')
    await signIn('mmustermann', PASSWORD)
    const rows = await db.select().from(sessions).where(eq(sessions.userId, id))
    expect(rows).toHaveLength(1)
  })

  it('scheitert mit falschem Passwort', async () => {
    await createAccount('mmustermann')
    const response = await signIn('mmustermann', 'falsch-aber-lang-genug')
    expect(response.status).toBe(401)
  })

  it('gibt für falsches Passwort und unbekannten Namen dieselbe Antwort', async () => {
    // Jeder Unterschied — Status, Meldung oder Laufzeit — verriete, welche
    // Zugänge es gibt.
    await createAccount('mmustermann')

    const wrongPassword = await signIn('mmustermann', 'falsch-aber-lang-genug')
    const unknownUser = await signIn('gibtsnicht', 'falsch-aber-lang-genug')

    expect(unknownUser.status).toBe(wrongPassword.status)
    expect(await unknownUser.text()).toBe(await wrongPassword.text())
  })
})

describe('Deaktivierte Konten', () => {
  it('können sich nicht anmelden', async () => {
    const { id } = await createAccount('mmustermann')
    await db.update(users).set({ active: false }).where(eq(users.id, id))

    const response = await signIn('mmustermann', PASSWORD)
    expect(response.status).toBe(403)
  })

  it('bekommen keine Sitzung, auch nicht kurzzeitig', async () => {
    // Der Wächter greift, BEVOR die Zeile entsteht.
    const { id } = await createAccount('mmustermann')
    await db.update(users).set({ active: false }).where(eq(users.id, id))
    await signIn('mmustermann', PASSWORD)

    const rows = await db.select().from(sessions).where(eq(sessions.userId, id))
    expect(rows).toEqual([])
  })

  it('verlieren ihre laufende Sitzung sofort', async () => {
    const { id } = await createAccount('mmustermann')
    await signIn('mmustermann', PASSWORD)
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(1)

    await db.transaction(tx => deactivateUser(id, tx))

    expect(await isUserActive(id)).toBe(false)
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([])
  })

  it('melden beim Abmelden aller Sitzungen die Anzahl', async () => {
    const { id } = await createAccount('mmustermann')
    await signIn('mmustermann', PASSWORD)
    await signIn('mmustermann', PASSWORD)
    expect(await deleteUserSessions(id)).toBe(2)
  })
})

describe('Konten wieder freischalten', () => {
  it('macht ein deaktiviertes Konto wieder anmeldefähig', async () => {
    const { id } = await createAccount('mmustermann')
    await db.transaction(tx => deactivateUser(id, tx))
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(403)

    await activateUser(id)

    expect(await isUserActive(id)).toBe(true)
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(200)
  })
})

describe('Der Zustand der Installation', () => {
  it('meldet eine leere Installation als leer', async () => {
    expect(await hasAnyUser()).toBe(false)
  })

  it('meldet nach dem ersten Konto, dass es eines gibt', async () => {
    await createAccount('chefin')
    expect(await hasAnyUser()).toBe(true)
  })

  it('erkennt, ob ein Konto sich überhaupt anmelden kann', async () => {
    const { id } = await createAccount('mmustermann')
    expect(await hasCredential(id)).toBe(true)
  })

  it('erkennt ein Konto ohne Zugangsdaten', async () => {
    const [user] = await db.insert(users).values({
      id: 'ohne-zugang',
      name: 'Ohne Zugang',
      email: 'ohne@twincars.local',
    }).returning()
    expect(await hasCredential(user!.id)).toBe(false)
  })

  it('meldet für einen unbekannten Benutzer, dass er nicht aktiv ist', async () => {
    expect(await isUserActive('gibtsnicht')).toBe(false)
  })
})

describe('Anmeldedrosselung', () => {
  it('ist nicht mehr Sache der Bibliothek', async () => {
    // Der eingebaute Zähler liest standardmäßig `x-forwarded-for` und
    // akzeptiert einen einwertigen Header. Ohne Proxy davor schickt ein
    // Angreifer bei jedem Versuch einen anderen Wert und landet nie im selben
    // Eimer (B-003, B-054). Gezählt wird deshalb in
    // `server/middleware/03.sign-in-throttle.ts` — dort entscheidet ohne
    // konfigurierten Proxy die Socket-Adresse.
    const context = await useAuth().$context
    expect(context.options.rateLimit?.enabled).toBe(false)
    expect(context.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([])
  })
})

describe('Passwort zurücksetzen', () => {
  it('lässt die Anmeldung mit dem neuen Passwort zu', async () => {
    const { id } = await createAccount('mmustermann')
    await resetPassword(id, 'ein-anderes-passwort')

    expect((await signIn('mmustermann', 'ein-anderes-passwort')).status).toBe(200)
    expect((await signIn('mmustermann', PASSWORD)).status).toBe(401)
  })

  it('legt Zugangsdaten an, wenn es noch keine gab', async () => {
    // Ein Konto ohne Zugangsdaten kann sich nicht anmelden. Das Setzen eines
    // Passworts muss es anlegen, nicht nur ein vorhandenes ändern.
    const [user] = await db.insert(users).values({
      id: 'ohne-zugang-2',
      name: 'Ohne Zugang',
      email: 'ohne2@twincars.local',
      username: 'ohnezugang',
    }).returning()
    expect(await hasCredential(user!.id)).toBe(false)

    await resetPassword(user!.id, 'ein-gutes-passwort')

    expect(await hasCredential(user!.id)).toBe(true)
    expect((await signIn('ohnezugang', 'ein-gutes-passwort')).status).toBe(200)
  })

  it('beendet dabei jede laufende Sitzung', async () => {
    const { id } = await createAccount('mmustermann')
    await signIn('mmustermann', PASSWORD)

    await resetPassword(id, 'ein-anderes-passwort')

    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([])
  })
})

describe('Rechte', () => {
  async function giveRole(userId: string, name: string, permissions: string[]) {
    const [role] = await db.insert(roles).values({ name }).returning()
    if (permissions.length > 0) {
      await db.insert(rolePermissions).values(
        permissions.map(permission => ({ roleId: role!.id, permission })),
      )
    }
    await db.insert(userRoles).values({ userId, roleId: role!.id })
    return role!.id
  }

  it('sammelt die Rechte über alle Rollen', async () => {
    const { id } = await createAccount('mmustermann')
    await giveRole(id, 'Werkstatt', ['orders', 'vehicles'])
    await giveRole(id, 'Empfang', ['customers'])

    expect([...await loadUserPermissions(id)].sort()).toEqual(['customers', 'orders', 'vehicles'])
  })

  it('nennt die Rollen alphabetisch', async () => {
    const { id } = await createAccount('mmustermann')
    await giveRole(id, 'Werkstatt', [])
    await giveRole(id, 'Empfang', [])
    expect(await loadUserRoles(id)).toEqual(['Empfang', 'Werkstatt'])
  })

  it('gibt einem Benutzer ohne Rolle nichts', async () => {
    const { id } = await createAccount('mmustermann')
    expect(await loadUserPermissions(id)).toEqual(new Set())
  })

  it('ersetzt die Rollen vollständig', async () => {
    const { id } = await createAccount('mmustermann')
    await giveRole(id, 'Werkstatt', ['orders'])
    const [empfang] = await db.insert(roles).values({ name: 'Empfang' }).returning()
    await db.insert(rolePermissions).values({ roleId: empfang!.id, permission: 'customers' })

    await db.transaction(tx => setUserRoles(id, [empfang!.id], tx))

    expect([...await loadUserPermissions(id)]).toEqual(['customers'])
  })
})

describe('Der letzte Administrator', () => {
  async function makeAdministrator(userId: string, roleName: string) {
    const [role] = await db.insert(roles).values({ name: roleName }).returning()
    await db.insert(rolePermissions).values({ roleId: role!.id, permission: '*' })
    await db.insert(userRoles).values({ userId, roleId: role!.id })
  }

  it('wird erkannt, wenn er der einzige ist', async () => {
    const { id } = await createAccount('chefin')
    await makeAdministrator(id, 'Administrator')
    expect(await isLastAdministrator(id)).toBe(true)
  })

  it('ist nicht der letzte, wenn es einen zweiten gibt', async () => {
    const first = await createAccount('chefin')
    const second = await createAccount('vertretung')
    await makeAdministrator(first.id, 'Administrator')
    await makeAdministrator(second.id, 'Zweitadministrator')

    expect(await isLastAdministrator(first.id)).toBe(false)
  })

  it('zählt ein deaktiviertes Konto nicht mit', async () => {
    // Sonst sperrte man sich aus, indem man den einen Administrator
    // deaktiviert und den anderen löscht.
    const first = await createAccount('chefin')
    const second = await createAccount('vertretung')
    await makeAdministrator(first.id, 'Administrator')
    await makeAdministrator(second.id, 'Zweitadministrator')
    await db.update(users).set({ active: false }).where(eq(users.id, second.id))

    expect(await isLastAdministrator(first.id)).toBe(true)
  })
})

describe('Regression', () => {
  it('B-071: es gibt kein eingebautes Ersatzgeheimnis', async () => {
    // Der Vorgänger fiel ohne APP_SECRET auf eine feste Zeichenkette zurück,
    // sodass Sitzungs-Cookies mit öffentlich bekanntem Schlüssel signiert
    // wurden. Die Umgebungsprüfung lässt einen solchen Start nicht mehr zu,
    // und beide Adressen landen in der Herkunftsliste.
    const context = await useAuth().$context
    expect(context.options.secret).not.toContain('dev-only')
    expect(context.trustedOrigins).toContain(TEST_ORIGIN)
  })
})
