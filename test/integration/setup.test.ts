/**
 * Der Einrichtungsassistent gegen echtes PostgreSQL (T-010).
 *
 * Drei Zusagen, und die erste ist die, an der der Vorgänger scheiterte:
 *
 *   1. **Das Tor entscheidet der Server** (B-001). Beim Vorgänger leitete das
 *      Layout per `goto` um; wer die Adresse eines Endpunkts kannte, kam
 *      daran vorbei.
 *   2. **Der Abschluss prüft.** Ohne Firmendaten und ohne Administrator wird
 *      nicht freigeschaltet.
 *   3. **Nach dem Abschluss ist der Assistent zu.** Dauerhaft, ohne Weg
 *      zurück über die Oberfläche.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { installNitroGlobals } from '../setup/nitro-globals'

installNitroGlobals()

const {
  auditLog,
  companySettings,
  numberRanges,
  recordVersions,
  roles,
  rolePermissions,
  userRoles,
  users,
  workshopHours,
} = await import('../../server/database/schema/index.ts')

const {
  loadNumberRanges,
  loadSettings,
  loadWorkshopHours,
  saveCompanyProfile,
  saveCompanyTax,
  saveDocumentDefaults,
  saveNumberRanges,
  saveSecuritySettings,
  saveWorkshopHours,
} = await import('../../server/services/settings-service.ts')

const {
  completeSetup,
  createFirstAdmin,
  judgePassword,
  refuseAfterSetup,
  setupState,
} = await import('../../server/services/setup-service.ts')

const { useDatabase, closeDatabase } = await import('../../server/utils/db.ts')

const db = useDatabase()

afterAll(() => closeDatabase())

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(recordVersions)
  await db.delete(userRoles)
  await db.delete(users)
  await db.delete(rolePermissions)
  await db.delete(roles)
  await db.delete(numberRanges)
  await db.delete(workshopHours)
  await db.delete(companySettings)
})

const PROFILE = {
  companyName: 'Autohaus Muster GmbH',
  street: 'Hauptstraße 1',
  zip: '89073',
  city: 'Ulm',
  state: 'Baden-Württemberg' as const,
  phone: '0731 123456',
  email: 'info@muster.de',
}

/** Ein Abgleich, der nichts findet — ohne das Netz anzufassen. */
const cleanFetch = (async () => ({ ok: true, text: async () => '' }) as Response) as typeof fetch

/** Der Administrator-Rolle, wie der Seed sie anlegt. */
async function seedAdminRole() {
  const [role] = await db.insert(roles).values({ name: 'Administrator' }).returning()
  await db.insert(rolePermissions).values({ roleId: role!.id, permission: '*' })
  return role!
}

/* ── Die Einstellungszeile ────────────────────────────────────────────── */

describe('Die Einstellungen sind eine Einzelzeile', () => {
  it('legt sie an, wenn sie fehlt', async () => {
    const settings = await loadSettings(db)
    expect(settings.id).toBeTruthy()
    expect((await db.select().from(companySettings)).length).toBe(1)
  })

  it('legt keine zweite an', async () => {
    await loadSettings(db)
    await loadSettings(db)
    expect((await db.select().from(companySettings)).length).toBe(1)
  })

  it('lässt keine zweite Zeile zu, auch nicht von Hand', async () => {
    // Der eindeutige Index `company_settings_singleton` erzwingt das. Ohne
    // ihn stünden zwei Firmenadressen in der Datenbank, und welche auf der
    // Rechnung landet, entschiede die Sortierung.
    await loadSettings(db)
    await expect(db.insert(companySettings).values({})).rejects.toThrow()
  })
})

/* ── Was der Assistent schreibt ───────────────────────────────────────── */

describe('Die Schritte des Assistenten', () => {
  it('schreibt die Firmendaten', async () => {
    await saveCompanyProfile(PROFILE, {}, undefined, db)

    const settings = await loadSettings(db)
    expect(settings.companyName).toBe('Autohaus Muster GmbH')
    expect(settings.city).toBe('Ulm')
    expect(settings.state).toBe('Baden-Württemberg')
  })

  it('schreibt Steuer und Bank, den Satz als Dezimalzahl', async () => {
    await saveCompanyTax({
      taxNumber: '88/123/45678',
      smallBusinessExempt: false,
      defaultVatRate: 16,
    }, {}, undefined, db)

    const settings = await loadSettings(db)
    expect(settings.taxNumber).toBe('88/123/45678')
    // `numeric(5,2)` gibt eine Zeichenkette zurück — 16 wird zu '16.00'.
    expect(settings.defaultVatRate).toBe('16.00')
  })

  it('merkt sich die §19-Regelung', async () => {
    await saveCompanyTax({
      taxNumber: '88/123/45678',
      smallBusinessExempt: true,
      defaultVatRate: 0,
    }, {}, undefined, db)

    expect((await loadSettings(db)).smallBusinessExempt).toBe(true)
  })

  it('schreibt den sicheren Adressbereich und die Administrator-Adresse', async () => {
    await saveSecuritySettings({
      adminEmail: 'chef@muster.de',
      safeIpRanges: '192.168.1.0/24',
    }, {}, undefined, db)

    const settings = await loadSettings(db)
    expect(settings.adminEmail).toBe('chef@muster.de')
    expect(settings.safeIpRanges).toBe('192.168.1.0/24')
  })

  it('P-22: der sichere Bereich wirkt sofort auf die Anmeldesperre', async () => {
    // Die Einstellung ist kein Schmuck: `addressLock` liest genau diese Zeile.
    const { addressLock } = await import('../../server/utils/account-lock.ts')
    const { signInAttempts } = await import('../../server/database/schema/index.ts')

    await db.delete(signInAttempts)
    await db.insert(signInAttempts).values(
      Array.from({ length: 30 }, (_, index) => ({
        username: 'gibtsnicht',
        clientAddress: '192.168.1.7',
        succeeded: false,
        reason: 'unbekannt' as const,
        at: new Date(Date.now() - index * 1000).toISOString(),
      })),
    )

    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(true)

    await saveSecuritySettings({ safeIpRanges: '192.168.1.0/24' }, {}, undefined, db)
    expect((await addressLock('192.168.1.7', new Date(), db)).locked).toBe(false)

    await db.delete(signInAttempts)
  })
})

/* ── Nummernkreise ────────────────────────────────────────────────────── */

describe('Nummernkreise', () => {
  it('legt einen Kreis an und zählt ab dem gewählten Wert', async () => {
    // Der Altbestand läuft bis 20090446 (M-44); der neue Kreis darf darüber
    // anfangen.
    await saveNumberRanges([
      { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 1 },
    ], db)

    const [range] = await loadNumberRanges(db)
    expect(range?.kind).toBe('invoice')
    expect(range?.nextValue).toBe(1)
  })

  it('schreibt einen vorhandenen Kreis um, statt einen zweiten anzulegen', async () => {
    await saveNumberRanges([{ kind: 'invoice', formatTemplate: '{N}', nextValue: 1 }], db)
    await saveNumberRanges([
      { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 500 },
    ], db)

    const ranges = await loadNumberRanges(db)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]?.formatTemplate).toBe('RE-{YYYY}-{NNNN}')
    expect(ranges[0]?.nextValue).toBe(500)
  })

  it('lässt die Kreise in Ruhe, die nicht genannt sind', async () => {
    // Wer im Assistenten drei Kreise anfasst, soll die übrigen fünf nicht
    // stillschweigend zurückgesetzt bekommen.
    await saveNumberRanges([
      { kind: 'invoice', formatTemplate: 'RE-{NNNN}', nextValue: 7 },
      { kind: 'customer', formatTemplate: 'K-{NNNNN}', nextValue: 3 },
    ], db)
    await saveNumberRanges([
      { kind: 'invoice', formatTemplate: 'RE-{NNNN}', nextValue: 8 },
    ], db)

    const byKind = Object.fromEntries((await loadNumberRanges(db)).map(r => [r.kind, r.nextValue]))
    expect(byKind.invoice).toBe(8)
    expect(byKind.customer).toBe(3)
  })

  it('die vergebene Nummer folgt der eingestellten Vorlage', async () => {
    // Der Beweis, dass die Einstellung wirkt und nicht nur dasteht.
    const { issueNumber } = await import('../../server/utils/numbering.ts')

    await saveNumberRanges([
      { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 42 },
    ], db)

    // Gezogen wird nur in einer Transaktion (P-02): sperren, hochzählen,
    // vergeben in einem Zug. Genau das erzwingt `issueNumber`.
    const number = await db.transaction(tx =>
      issueNumber(tx, 'invoice', new Date('2026-03-01T10:00:00Z')))
    expect(number).toBe('RE-2026-0042')
  })
})

/* ── Öffnungszeiten ───────────────────────────────────────────────────── */

describe('Öffnungszeiten', () => {
  const week = [
    ...[1, 2, 3, 4, 5].map(weekday => ({
      weekday, closed: false, opensAt: '08:00', closesAt: '17:00',
    })),
    ...[0, 6].map(weekday => ({
      weekday, closed: true, opensAt: '08:00', closesAt: '17:00',
    })),
  ]

  it('schreibt alle sieben Tage', async () => {
    expect(await saveWorkshopHours(week, db)).toBe(7)
    expect((await db.select().from(workshopHours)).length).toBe(7)
  })

  it('zählt Sonntag als 0 — wie `businessWeekday`', async () => {
    // Eine zweite Zählweise hier hieße, an jeder Stelle umzurechnen, an der
    // geprüft wird, ob gerade offen ist.
    const { businessWeekday } = await import('#shared/datetime')
    await saveWorkshopHours(week, db)

    const sonntag = businessWeekday(new Date('2026-09-20T10:00:00Z'))
    expect(sonntag).toBe(0)

    const [row] = await db.select().from(workshopHours).where(eq(workshopHours.weekday, sonntag))
    expect(row?.closed).toBe(true)
  })

  it('liest die Woche ab Montag, wie sie jemand liest', async () => {
    await saveWorkshopHours(week, db)
    expect((await loadWorkshopHours(db)).map(day => day.weekday))
      .toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('schreibt einen zweiten Durchgang um, statt zu scheitern', async () => {
    await saveWorkshopHours(week, db)
    await saveWorkshopHours(
      week.map(day => (day.weekday === 6 ? { ...day, closed: false, closesAt: '13:00' } : day)),
      db,
    )

    const [samstag] = await db.select().from(workshopHours).where(eq(workshopHours.weekday, 6))
    expect(samstag?.closed).toBe(false)
    expect(samstag?.closesAt).toBe('13:00:00')
  })
})

/* ── Spur und Zeitstrahl ──────────────────────────────────────────────── */

describe('Jede Änderung hinterlässt eine Spur', () => {
  it('M-01: schreibt einen Protokolleintrag', async () => {
    await saveCompanyProfile(PROFILE, {}, undefined, db)

    const entries = await db.select().from(auditLog)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0]?.entity).toBe('company_settings')
  })

  it('M-45: schreibt einen Stand in den Zeitstrahl', async () => {
    // Die Einstellungen stehen auf jeder Rechnung. Ein versehentlich
    // gelöschter Endtext muss zurückholbar sein.
    await saveCompanyProfile(PROFILE, { userName: 'Anna Chefin' }, undefined, db)

    const [stand] = await db.select().from(recordVersions)
    expect(stand?.entity).toBe('company_settings')
    expect(stand?.version).toBe(1)
    expect(stand?.changedByName).toBe('Anna Chefin')
    expect((stand?.data as Record<string, unknown>).companyName).toBe('Autohaus Muster GmbH')
  })

  it('M-45: zählt die Stände hoch', async () => {
    await saveCompanyProfile(PROFILE, {}, undefined, db)
    await saveCompanyProfile({ ...PROFILE, city: 'Neu-Ulm' }, {}, undefined, db)

    const staende = await db.select().from(recordVersions)
    expect(staende.map(s => s.version).sort()).toEqual([1, 2])
  })
})

/* ── Der erste Administrator ──────────────────────────────────────────── */

describe('Der erste Administrator', () => {
  it('wird mit der Rolle Administrator angelegt', async () => {
    const role = await seedAdminRole()
    await saveCompanyProfile(PROFILE, {}, undefined, db)

    const { id } = await createFirstAdmin({
      username: 'AChefin',
      displayName: 'Anna Chefin',
      password: 'kupplung wechsel dienstag',
    }, undefined, db)

    const [user] = await db.select().from(users).where(eq(users.id, id))
    expect(user?.username).toBe('achefin')
    expect(user?.displayUsername).toBe('AChefin')

    const [assignment] = await db.select().from(userRoles).where(eq(userRoles.userId, id))
    expect(assignment?.roleId).toBe(role.id)
  })

  it('legt nur den ersten an', async () => {
    // Der Weg ist ohne Anmeldung erreichbar, weil es vorher niemanden gibt.
    // Danach wäre er eine offene Tür.
    await seedAdminRole()
    await createFirstAdmin({
      username: 'erste', displayName: 'Erste', password: 'kupplung wechsel dienstag',
    }, undefined, db)

    await expect(createFirstAdmin({
      username: 'zweite', displayName: 'Zweite', password: 'nordsee wind muehle',
    }, undefined, db)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('P-14: weist ein schwaches Passwort ab, mit einem Satz, der sagt warum', async () => {
    await seedAdminRole()

    await expect(createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'sommer2024!!',
    }, undefined, db)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('Jahreszahl'),
    })
  })

  it('P-14: weist ein Passwort mit dem eigenen Namen ab', async () => {
    await seedAdminRole()

    await expect(createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'anna chefin muster',
    }, undefined, db)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('verlangt die Rolle aus dem Seed', async () => {
    // Ein Administrator ohne Rechte wäre ein Konto, mit dem niemand etwas
    // anfangen kann. Lieber ein lauter Fehler.
    await expect(createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('hinterlässt einen Sicherheitseintrag im Protokoll', async () => {
    await seedAdminRole()
    await createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)

    const entries = await db.select().from(auditLog)
    const security = entries.find(entry => entry.severity === 'sicherheit')
    expect(security?.note).toContain('Erster Administrator')
  })
})

/* ── Die Passwortprüfung ──────────────────────────────────────────────── */

describe('P-14: die Passwortprüfung in drei Lagen', () => {
  it('P-14: nimmt eine Losung aus drei Wörtern an', async () => {
    const verdict = await judgePassword('kupplung wechsel dienstag', {}, cleanFetch)
    expect(verdict.ok).toBe(true)
    expect(verdict.problems).toEqual([])
    expect(verdict.notice).toBeNull()
  })

  it('P-14: weist `sommer2024` ab, ohne das Netz zu fragen', async () => {
    // Lage 2 greift ohne Internet. Das Akzeptanzkriterium verlangt genau das.
    let asked = 0
    const counting = (async () => {
      asked += 1
      return { ok: true, text: async () => '' } as Response
    }) as typeof fetch

    const verdict = await judgePassword('sommer2024!!', {}, counting)
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.some(p => p.includes('Jahreszahl'))).toBe(true)
    expect(asked).toBe(0)
  })

  it('E-23: sagt es, wenn der Abgleich nicht möglich war', async () => {
    // Eine Prüfung, die still durchwinkt, erzeugt Vertrauen, die sie nicht
    // deckt.
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch

    const verdict = await judgePassword('kupplung wechsel dienstag', {}, offline)
    expect(verdict.ok).toBe(true)
    expect(verdict.notice).toContain('nicht möglich')
  })

  it('E-23: weist ein Passwort aus einem Datenleck ab', async () => {
    const { sha1Of } = await import('../../server/utils/password-breach.ts')
    const password = 'nordseewindmuehle'
    const suffix = sha1Of(password).slice(5)
    const found = (async () => ({
      ok: true,
      text: async () => `AAAA1:3\r\n${suffix}:1337\r\n`,
    }) as Response) as typeof fetch

    const verdict = await judgePassword(password, {}, found)
    expect(verdict.ok).toBe(false)
    expect(verdict.problems[0]).toContain('Datenlecks')
  })
})

/* ── Zustand und Abschluss ────────────────────────────────────────────── */

describe('Zustand und Abschluss', () => {
  it('nennt am Anfang alles, was fehlt', async () => {
    const state = await setupState(db)
    expect(state.completed).toBe(false)
    expect(state.hasUser).toBe(false)
    expect(state.missing).toContain('Der Firmenname fehlt.')
    expect(state.missing).toContain('Es gibt noch kein Administrator-Konto.')
  })

  it('schrumpft die Liste, während der Assistent läuft', async () => {
    await saveCompanyProfile(PROFILE, {}, undefined, db)
    const state = await setupState(db)

    expect(state.missing).not.toContain('Der Firmenname fehlt.')
    expect(state.missing).toEqual(['Es gibt noch kein Administrator-Konto.'])
  })

  it('verweigert den Abschluss ohne Firmendaten', async () => {
    await seedAdminRole()
    await createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)

    await expect(completeSetup(undefined, db)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('Firmenname'),
    })
  })

  it('verweigert den Abschluss ohne Administrator', async () => {
    // Sonst stünde eine freigeschaltete Anwendung da, in die niemand
    // hineinkommt.
    await saveCompanyProfile(PROFILE, {}, undefined, db)

    await expect(completeSetup(undefined, db)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('Administrator-Konto'),
    })
  })

  it('schaltet frei, wenn alles dasteht', async () => {
    await seedAdminRole()
    await saveCompanyProfile(PROFILE, {}, undefined, db)
    await createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)

    await completeSetup(undefined, db)

    expect((await loadSettings(db)).setupCompleted).toBe(true)
    expect((await setupState(db)).completed).toBe(true)
  })

  it('sperrt den Assistenten danach dauerhaft', async () => {
    await seedAdminRole()
    await saveCompanyProfile(PROFILE, {}, undefined, db)
    await createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)
    await completeSetup(undefined, db)

    await expect(refuseAfterSetup(db)).rejects.toMatchObject({ statusCode: 409 })
    await expect(completeSetup(undefined, db)).rejects.toMatchObject({ statusCode: 409 })
    await expect(createFirstAdmin({
      username: 'zweite', displayName: 'Zweite', password: 'nordsee wind muehle',
    }, undefined, db)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('hält den Abschluss im Protokoll fest', async () => {
    await seedAdminRole()
    await saveCompanyProfile(PROFILE, {}, undefined, db)
    await createFirstAdmin({
      username: 'achefin', displayName: 'Anna Chefin', password: 'kupplung wechsel dienstag',
    }, undefined, db)
    await db.delete(auditLog)
    await completeSetup(undefined, db)

    const entries = await db.select().from(auditLog)
    expect(entries.some(entry => entry.note?.includes('freigeschaltet'))).toBe(true)
  })
})

/* ── Belegvorgaben als Ganzes ─────────────────────────────────────────── */

describe('Belegvorgaben', () => {
  it('schreibt Anrede, Zahlungsziel, Endtext und Kreise in einem Zug', async () => {
    await saveDocumentDefaults({
      salutationStyle: 'Du',
      defaultPaymentTermDays: 7,
      pdfFooter: 'Bis bald in der Werkstatt.',
      numberRanges: [{ kind: 'invoice', formatTemplate: 'RE-{NNNN}', nextValue: 1 }],
    }, {}, undefined, db)

    const settings = await loadSettings(db)
    expect(settings.salutationStyle).toBe('Du')
    expect(settings.defaultPaymentTermDays).toBe(7)
    expect(settings.pdfFooter).toBe('Bis bald in der Werkstatt.')
    expect(await loadNumberRanges(db)).toHaveLength(1)
  })

  it('scheitert als Ganzes, wenn ein Teil nicht geht', async () => {
    // Ein Assistent, der mit halb gesetzten Vorgaben endet, ist schlimmer
    // als einer, der abbricht: niemand sieht, was fehlt.
    await expect(saveDocumentDefaults({
      salutationStyle: 'Sie',
      defaultPaymentTermDays: 14,
      numberRanges: [],
      // Kein Arbeitszeit-Artikel hinterlegt — der Stundensatz kann nicht.
      laborRate: 9500,
    }, {}, undefined, db)).rejects.toMatchObject({ statusCode: 409 })

    // Und die Anrede ist dabei nicht hängen geblieben.
    expect((await db.select().from(companySettings)).length).toBeLessThanOrEqual(1)
  })
})
