/**
 * Die Auswahlen, gegen eine echte Datenbank.
 *
 * B-116: für die Auswahlen des Vorgängers gab es **keine** Integrationstests —
 * weder für die Suchfelder noch für den Archivfilter noch für die Wächter.
 * Regressionen an der Suchlogik fielen niemandem auf.
 *
 * Geprüft wird hier das, was sich nur an einer Datenbank zeigt: dass wirklich
 * serverseitig gesucht und geblättert wird, dass Archiviertes wegbleibt, dass
 * der Preis in derselben Abfrage kommt und dass eine Kennzeichensuche über
 * alle Kennzeichen eines Fahrzeugs geht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import type { EventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { installNitroGlobals, TEST_ORIGIN } from '../setup/nitro-globals'

installNitroGlobals()

const {
  customers,
  documents,
  employees,
  itemPriceVersions,
  items,
  suppliers,
  tirePriceVersions,
  tires,
  vehicleLicensePlateVersions,
  vehicles,
} = await import('../../server/database/schema/index.ts')

const {
  pickCustomers,
  pickDocuments,
  pickEmployees,
  pickItems,
  pickSuppliers,
  pickTires,
  pickVehicles,
} = await import('../../server/services/picker-service.ts')

const { closeDatabase } = await import('../../server/utils/db.ts')
const { PAGE_SIZE } = await import('#shared/schemas/pagination')

const { openTestDatabase } = await import('../setup/drizzle')

const { db, close } = openTestDatabase()

/**
 * Räumt die Stammdaten dieser Datei weg — in Abhängigkeitsrichtung.
 *
 * Seit M-38 sperrt **jeder** Verweis, auch der der eigenen Teile: nichts geht
 * mehr still mit. Wer löschen will, räumt die Teile ausdrücklich weg. Genau so
 * arbeitet der Löschdienst später auch, nur in einer Transaktion.
 */
async function clearBusinessData(): Promise<void> {
  await db.delete(itemPriceVersions)
  await db.delete(tirePriceVersions)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(documents)
  await db.delete(vehicles)
  await db.delete(customers)
  await db.delete(items)
  await db.delete(tires)
  await db.delete(employees)
  await db.delete(suppliers)
}

afterAll(async () => {
  // Aufräumen in Abhängigkeitsrichtung: das Fahrzeug sperrt den Kunden (M-05),
  // also geht es zuerst. Nachfolgende Testdateien desselben Arbeiters finden
  // sonst eine Datenbank vor, aus der sie nichts mehr löschen können.
  await clearBusinessData()
  await close()
  await closeDatabase()
})

beforeAll(async () => {
  await clearBusinessData()

  // 300 Kunden — deutlich mehr als eine Seite fasst.
  await db.insert(customers).values(
    Array.from({ length: 300 }, (_, index) => ({
      customerNumber: `K-${String(index + 1).padStart(4, '0')}`,
      lastName: `Testkunde ${String(index + 1).padStart(4, '0')}`,
      city: index % 2 === 0 ? 'Ulm' : 'Neu-Ulm',
    })),
  )

  await db.insert(customers).values([
    { customerNumber: 'K-FIRMA', company: 'Meier GmbH', lastName: 'Meier', city: 'Ulm' },
    { customerNumber: 'K-ARCHIV', lastName: 'Archiviert', archived: true },
    { customerNumber: 'K-UMLAUT', lastName: 'Müller', city: 'Söflingen' },
  ])

  const [customer] = await db.select().from(customers)
    .where(eq(customers.customerNumber, 'K-FIRMA')).limit(1)

  const [golf] = await db.insert(vehicles).values({
    customerId: customer!.id,
    make: 'VW',
    model: 'Golf',
    vin: 'WVWZZZ1KZAW000001',
    firstRegistration: '2019-04-12',
    status: 'kundenfahrzeug',
  }).returning()

  await db.insert(vehicles).values([
    { make: 'Opel', model: 'Vivaro', status: 'bestand' },
    { make: 'Audi', model: 'A3', status: 'kundenfahrzeug', archived: true },
  ])

  // Zwei Kennzeichen am selben Fahrzeug — gesucht wird über beide.
  await db.insert(vehicleLicensePlateVersions).values([
    { vehicleId: golf!.id, licensePlate: 'UL-AB 123', validFrom: '2020-01-01' },
    { vehicleId: golf!.id, licensePlate: 'UL-XY 999', validFrom: '2024-06-01' },
  ])

  const [oil] = await db.insert(items).values({
    articleNumber: 'A-0001',
    description: 'Ölwechsel',
    kind: 'service',
    unit: 'Std.',
  }).returning()

  await db.insert(items).values({
    articleNumber: 'A-0002',
    description: 'Bremsbeläge',
    kind: 'material',
  })

  // Zwei Preisstände: der ältere gilt, der künftige noch nicht.
  await db.insert(itemPriceVersions).values([
    { itemId: oil!.id, validFrom: '2020-01-01', unitPriceNet: 4500 },
    { itemId: oil!.id, validFrom: '2099-01-01', unitPriceNet: 9900 },
  ])

  await db.insert(suppliers).values([
    { name: 'Knoll', city: 'Ulm', customerNumberAtSupplier: '4711' },
    { name: 'Alt und weg', city: 'Ulm', archived: true },
  ])

  const [winter] = await db.insert(tires).values({
    articleNumber: 'R-0001',
    brand: 'Continental',
    model: 'WinterContact TS 870',
    width: 205,
    aspectRatio: 55,
    construction: 'R',
    diameterInch: 16,
    season: 'winter',
  }).returning()

  await db.insert(tirePriceVersions).values({
    tireId: winter!.id,
    validFrom: '2020-01-01',
    unitPriceNet: 8900,
  })

  // Ein Reifen ohne hinterlegten Preis — die Unterzeile muss auch dann stimmen.
  await db.insert(tires).values({
    articleNumber: 'R-0002',
    brand: 'Nokian',
    model: 'Seasonproof',
    width: 195,
    aspectRatio: 65,
    construction: 'R',
    diameterInch: 15,
    season: 'allseason',
  })

  await db.insert(employees).values([
    { personnelNumber: 'M-001', firstName: 'Anna', lastName: 'Schuster', position: 'Kfz-Meisterin' },
    { personnelNumber: 'M-002', firstName: 'Bernd', lastName: 'Ausgeschieden', archived: true },
  ])

  await db.insert(documents).values([
    {
      customerId: customer!.id,
      documentNumber: 'RE-2026-0001',
      type: 'invoice',
      issueDate: '2026-01-15',
      grossTotal: 11_900,
    },
    {
      customerId: customer!.id,
      documentNumber: null,
      type: 'invoice',
      issueDate: '2026-02-01',
      grossTotal: 0,
    },
  ])
})

describe('Es wird auf dem Server gesucht und geblättert', () => {
  it('B-116: die Auswahlen haben überhaupt einen Integrationstest', async () => {
    // Für die Auswahlen des Vorgängers gab es keinen einzigen — weder für die
    // Suchfelder noch für den Archivfilter noch für die Wächter. Regressionen
    // an der Suchlogik fielen niemandem auf. Dieser Test hält fest, dass jede
    // der sieben Auswahlen hier wirklich gegen eine Datenbank läuft.
    const results = await Promise.all([
      pickCustomers({ page: 1 }, db),
      pickVehicles({ page: 1 }, db),
      pickItems({ page: 1 }, db),
      pickTires({ page: 1 }, db),
      pickEmployees({ page: 1 }, db),
      pickSuppliers({ page: 1 }, db),
      pickDocuments({ page: 1 }, db),
    ])

    for (const result of results) {
      expect(result.size).toBe(PAGE_SIZE)
      expect(result.items.length).toBeLessThanOrEqual(PAGE_SIZE)
      expect(result.total).toBeGreaterThan(0)
    }
  })

  it('liefert nie mehr als eine Seite', async () => {
    // Der eigentliche Punkt: bei 300 Kunden gehen 25 über die Leitung, nicht 300.
    const result = await pickCustomers({ page: 1 }, db)
    expect(result.items).toHaveLength(PAGE_SIZE)
    expect(result.total).toBeGreaterThan(300)
    expect(result.pageCount).toBeGreaterThan(1)
  })

  it('liefert auf der zweiten Seite andere Einträge', async () => {
    const first = await pickCustomers({ page: 1 }, db)
    const second = await pickCustomers({ page: 2 }, db)
    const ids = [...first.items, ...second.items].map(option => option.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('zählt beim Suchen nur die Treffer', async () => {
    const result = await pickCustomers({ page: 1, q: 'Meier' }, db)
    expect(result.total).toBe(1)
    expect(result.items[0]?.label).toBe('Meier GmbH')
  })

  it('sucht ohne Rücksicht auf Groß- und Kleinschreibung', async () => {
    const lower = await pickCustomers({ page: 1, q: 'meier' }, db)
    const upper = await pickCustomers({ page: 1, q: 'MEIER' }, db)
    expect(lower.total).toBe(upper.total)
    expect(lower.total).toBe(1)
  })

  it('findet auch über Ort und Kundennummer', async () => {
    expect((await pickCustomers({ page: 1, q: 'Söflingen' }, db)).total).toBe(1)
    expect((await pickCustomers({ page: 1, q: 'K-UMLAUT' }, db)).total).toBe(1)
  })
})

describe('Archiviertes bleibt weg', () => {
  it('zeigt keinen archivierten Kunden', async () => {
    // Ein archivierter Kunde soll nicht versehentlich auf einer neuen Rechnung
    // landen — deshalb erscheint er in keiner Auswahl.
    expect((await pickCustomers({ page: 1, q: 'Archiviert' }, db)).total).toBe(0)
  })

  it('zeigt kein archiviertes Fahrzeug', async () => {
    expect((await pickVehicles({ page: 1, q: 'A3' }, db)).total).toBe(0)
  })

  it('zeigt keinen archivierten Lieferanten', async () => {
    expect((await pickSuppliers({ page: 1, q: 'Alt und weg' }, db)).total).toBe(0)
  })
})

describe('Fahrzeuge', () => {
  it('B-086: findet über jedes Kennzeichen, das das Fahrzeug je trug', async () => {
    // Beim Vorgänger stand diese Suche dreimal kopiert da, jeweils als
    // Vorabfrage mit anschließendem `IN` über womöglich tausende Kennungen.
    const alt = await pickVehicles({ page: 1, q: 'UL-AB' }, db)
    const neu = await pickVehicles({ page: 1, q: 'UL-XY' }, db)
    expect(alt.total).toBe(1)
    expect(neu.total).toBe(1)
    expect(alt.items[0]?.id).toBe(neu.items[0]?.id)
  })

  it('zeigt das aktuell gültige Kennzeichen an', async () => {
    const result = await pickVehicles({ page: 1, q: 'Golf' }, db)
    expect(result.items[0]?.sublabel).toContain('UL-XY 999')
  })

  it('nennt die Erstzulassung deutsch, wenn es eine gibt', async () => {
    const mit = await pickVehicles({ page: 1, q: 'Golf' }, db)
    expect(mit.items[0]?.sublabel).toContain('12.04.2019')

    // Und lässt sie weg, wenn keine hinterlegt ist — statt „null" zu zeigen.
    const ohne = await pickVehicles({ page: 1, q: 'Vivaro' }, db)
    expect(ohne.items[0]?.sublabel ?? '').not.toContain('null')
  })

  it('lässt ohne Kundenkennung den Geltungsbereich „kunde" wirkungslos', async () => {
    // Eine halb ausgefüllte Einschränkung darf keine fremden Fahrzeuge zeigen
    // und auch nicht abbrechen — sie schränkt eben nicht ein.
    const result = await pickVehicles({ page: 1, scope: 'kunde' }, db)
    expect(result.total).toBeGreaterThan(0)
  })

  it('findet über die Fahrgestellnummer', async () => {
    expect((await pickVehicles({ page: 1, q: 'WVWZZZ1KZ' }, db)).total).toBe(1)
  })

  it('schränkt auf die Fahrzeuge eines Kunden ein', async () => {
    const [customer] = await db.select().from(customers)
      .where(eq(customers.customerNumber, 'K-FIRMA')).limit(1)

    const result = await pickVehicles(
      { page: 1, scope: 'kunde', customerId: customer!.id },
      db,
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.label).toBe('VW Golf')
  })

  it('schränkt auf den Bestand ein', async () => {
    const result = await pickVehicles({ page: 1, scope: 'bestand' }, db)
    expect(result.items.map(option => option.label)).toEqual(['Opel Vivaro'])
  })

  it('B-225: der Bestand hängt an einem geprüften Statusfeld', async () => {
    // Beim Vorgänger stand der Zustand eines Inserats ohne Prüfregel in der
    // Tabelle, und jede Liste filterte anders: ein reserviertes Fahrzeug war
    // auf der Website zu sehen, aber über die Auswahl nicht verkaufbar. Jetzt
    // entscheidet ein Feld mit Prüfregel, und alle lesen dasselbe.
    await expect(
      db.insert(vehicles).values({ make: 'Test', model: 'Ungültig', status: 'irgendwas' }),
    ).rejects.toThrow()

    const bestand = await pickVehicles({ page: 1, scope: 'bestand' }, db)
    for (const option of bestand.items) {
      const [row] = await db.select({ status: vehicles.status })
        .from(vehicles).where(eq(vehicles.id, option.id)).limit(1)
      expect(row?.status).toBe('bestand')
    }
  })
})

describe('Artikel', () => {
  it('B-084: der gültige Preis kommt in derselben Abfrage', async () => {
    // Der Vorgänger lud ihn je Zeile nach: bis zu hundert zusätzliche
    // Abfragen für eine Seite.
    const result = await pickItems({ page: 1, q: 'Ölwechsel' }, db)
    expect(result.items[0]?.sublabel).toContain('45,00')
  })

  it('nimmt den künftigen Preis noch nicht', async () => {
    // Ein Preis, der ab 2099 gilt, gilt heute nicht. Genau dafür gibt es die
    // Preisversionen statt eines Änderungsprotokolls (M-01).
    const result = await pickItems({ page: 1, q: 'Ölwechsel' }, db)
    expect(result.items[0]?.sublabel).not.toContain('99,00')
  })

  it('kommt ohne hinterlegten Preis aus', async () => {
    const result = await pickItems({ page: 1, q: 'Bremsbeläge' }, db)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.sublabel).not.toContain('€')
  })

  it('listet ohne Suchbegriff alles', async () => {
    expect((await pickItems({ page: 1 }, db)).total).toBe(2)
  })
})

describe('B-083: eine unsinnige Seitenzahl erzeugt keinen Serverfehler', () => {
  it('liefert für eine Seite jenseits des Endes eine leere Liste', async () => {
    // Beim Vorgänger ergab `page=0` einen negativen Versatz, die Datenbank
    // brach ab, und der Nutzer las „Ein interner Fehler ist aufgetreten."
    const result = await pickCustomers({ page: 99_999 }, db)
    expect(result.items).toEqual([])
    expect(result.total).toBeGreaterThan(0)
  })
})

describe('Reifen', () => {
  it('findet über die zusammengesetzte Größe', async () => {
    // In der Tabelle stehen drei Zahlen; gesucht wird nach „205/55 R16".
    const result = await pickTires({ page: 1, q: '205/55 R16' }, db)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.label).toContain('Continental')
  })

  it('nennt Größe, Saison und Preis in der Unterzeile', async () => {
    const result = await pickTires({ page: 1, q: 'Continental' }, db)
    const sublabel = result.items[0]?.sublabel ?? ''
    expect(sublabel).toContain('205/55 R16')
    expect(sublabel).toContain('Winter')
    expect(sublabel).toContain('89,00')
  })

  it('kommt ohne hinterlegten Preis aus', async () => {
    const result = await pickTires({ page: 1, q: 'Nokian' }, db)
    const sublabel = result.items[0]?.sublabel ?? ''
    expect(sublabel).toContain('195/65 R15')
    expect(sublabel).toContain('Ganzjahres')
    expect(sublabel).not.toContain('€')
  })

  it('listet ohne Suchbegriff alles', async () => {
    expect((await pickTires({ page: 1 }, db)).total).toBe(2)
  })
})

describe('Lieferanten', () => {
  it('listet ohne Suchbegriff alles Nichtarchivierte', async () => {
    const result = await pickSuppliers({ page: 1 }, db)
    expect(result.items.map(option => option.label)).toEqual(['Knoll'])
  })

  it('nennt Ort und Kundennummer beim Lieferanten in der Unterzeile', async () => {
    const result = await pickSuppliers({ page: 1, q: 'Knoll' }, db)
    expect(result.items[0]?.sublabel).toContain('Ulm')
    expect(result.items[0]?.sublabel).toContain('4711')
  })
})

describe('Mitarbeiter', () => {
  it('M-12: zeigt keinen deaktivierten Mitarbeiter mehr zur Auswahl', async () => {
    // Deaktiviert, nicht gelöscht: er bleibt überall stehen, wo er schon
    // eingetragen ist, wird aber nirgends mehr neu ausgewählt.
    expect((await pickEmployees({ page: 1, q: 'Ausgeschieden' }, db)).total).toBe(0)
    expect((await pickEmployees({ page: 1, q: 'Schuster' }, db)).total).toBe(1)
  })

  it('listet ohne Suchbegriff alle Aktiven', async () => {
    const result = await pickEmployees({ page: 1 }, db)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.label).toBe('Schuster, Anna')
  })
})

describe('Belege', () => {
  it('findet über die Belegnummer', async () => {
    const result = await pickDocuments({ page: 1, q: 'RE-2026-0001' }, db)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.label).toBe('Rechnung RE-2026-0001')
  })

  it('M-14: nennt einen Beleg ohne Nummer einen Entwurf', async () => {
    // Die Nummer wird erst beim Ausstellen gezogen. Bis dahin steht dort
    // „Entwurf" und keine Lücke — sonst rätselt der Bediener, was fehlt.
    const result = await pickDocuments({ page: 1 }, db)
    expect(result.items.map(option => option.label)).toContain('Rechnung Entwurf')
  })

  it('listet ohne Einschränkung alles', async () => {
    expect((await pickDocuments({ page: 1 }, db)).total).toBe(2)
  })

  it('schränkt auf die Belege eines Kunden ein', async () => {
    const [customer] = await db.select().from(customers)
      .where(eq(customers.customerNumber, 'K-FIRMA')).limit(1)

    expect((await pickDocuments({ page: 1, customerId: customer!.id }, db)).total).toBe(2)
  })
})

/* ── Über HTTP, mit Wächter ──────────────────────────────────────────────
   Ab hier laufen die echten Endpoint-Module in einer kleinen h3-Anwendung,
   damit Wächter, Valibot und Statuscodes so greifen wie im Betrieb. */

const endpoints: Record<string, EventHandler> = {
  customers: (await import('../../server/api/pickers/customers.get.ts')).default,
  vehicles: (await import('../../server/api/pickers/vehicles.get.ts')).default,
  items: (await import('../../server/api/pickers/items.get.ts')).default,
  tires: (await import('../../server/api/pickers/tires.get.ts')).default,
  employees: (await import('../../server/api/pickers/employees.get.ts')).default,
  suppliers: (await import('../../server/api/pickers/suppliers.get.ts')).default,
  documents: (await import('../../server/api/pickers/documents.get.ts')).default,
}

/** Welches Recht der jeweilige Endpoint verlangt, und welches nicht genügt. */
const REQUIRED: Record<string, { granting: string[], area: string }> = {
  customers: { granting: ['customers'], area: 'Kunden' },
  vehicles: { granting: ['vehicles'], area: 'Fahrzeuge' },
  items: { granting: ['items', 'orders'], area: 'Leistungen und Artikel oder Aufträge' },
  tires: { granting: ['tires'], area: 'Reifen und Reifenlager' },
  employees: { granting: ['employees', 'orders'], area: 'Mitarbeiter oder Aufträge' },
  suppliers: { granting: ['suppliers'], area: 'Lieferanten' },
  documents: { granting: ['invoices'], area: 'Rechnungen' },
}

const names = Object.keys(endpoints)

/**
 * Die Anwendung. Das Recht kommt aus einem Kopfzeilen-Feld, damit jeder Fall
 * ohne Anmeldung durchgespielt werden kann — die Anmeldung selbst hat ihren
 * eigenen Test (`auth-middleware.test.ts`).
 */
const app = toWebHandler((() => {
  const application = createApp()

  application.use(defineEventHandler((event) => {
    const granted = event.node.req.headers['x-test-permissions']
    if (typeof granted !== 'string') return
    event.context.auth = {
      userId: '00000000-0000-0000-0000-000000000001',
      username: 'pruefer',
      displayName: 'Prüfer',
      permissions: new Set(granted === '' ? [] : granted.split(',')),
    }
  }))

  application.use(defineEventHandler((event) => {
    const name = (event.path.split('?')[0] ?? '').replace('/api/pickers/', '')
    const handler = endpoints[name]
    if (handler) return handler(event)
  }))

  return application
})())

const call = (path: string, permissions?: string) =>
  app(new Request(`${TEST_ORIGIN}${path}`, {
    headers: permissions === undefined ? {} : { 'x-test-permissions': permissions },
  }))

describe('Jeder Picker verlangt ein Recht', () => {
  it.each(names)('/%s antwortet ohne Sitzung mit 401', async (name) => {
    const response = await call(`/api/pickers/${name}`)
    expect(response.status).toBe(401)
  })

  it.each(names)('/%s antwortet mit fremdem Recht mit 403', async (name) => {
    // `posts` ist mit Absicht ein Recht, das keine Auswahl öffnet.
    const response = await call(`/api/pickers/${name}`, 'posts')
    expect(response.status).toBe(403)

    const body = await response.json() as { message?: string, statusMessage?: string }
    const message = body.message ?? body.statusMessage ?? ''
    expect(message).toBe(`Sie haben keine Berechtigung für ${REQUIRED[name]!.area}.`)
  })

  it.each(names)('/%s öffnet sich mit dem passenden Recht', async (name) => {
    for (const permission of REQUIRED[name]!.granting) {
      const response = await call(`/api/pickers/${name}`, permission)
      expect(response.status, `${name} mit ${permission}`).toBe(200)
    }
  })

  it.each(names)('/%s öffnet sich auch mit dem Platzhalter', async (name) => {
    expect((await call(`/api/pickers/${name}`, '*')).status).toBe(200)
  })
})

describe('Über HTTP wird serverseitig gesucht und geblättert', () => {
  it('liefert 25 von über 300 Kunden', async () => {
    const response = await call('/api/pickers/customers?page=1', 'customers')
    const body = await response.json() as {
      items: unknown[]
      total: number
      size: number
      pageCount: number
    }
    expect(body.items).toHaveLength(PAGE_SIZE)
    expect(body.size).toBe(PAGE_SIZE)
    expect(body.total).toBeGreaterThan(300)
    expect(body.pageCount).toBe(Math.ceil(body.total / PAGE_SIZE))
  })

  it('sucht mit dem Begriff aus der Abfrage', async () => {
    const response = await call('/api/pickers/customers?q=Meier', 'customers')
    const body = await response.json() as { total: number }
    expect(body.total).toBe(1)
  })

  it('B-083: weist eine Seitenzahl von 0 mit 422 und deutschem Satz ab', async () => {
    // Beim Vorgänger erzeugte das einen negativen Versatz und einen 500er.
    const response = await call('/api/pickers/customers?page=0', 'customers')
    expect(response.status).toBe(422)

    const body = await response.json() as { data?: { fields?: Record<string, string> } }
    const fields = body.data?.fields ?? {}
    expect(Object.keys(fields)).toContain('page')
    expect(fields.page).toMatch(/Seite/i)
  })

  it('weist einen unbekannten Geltungsbereich bei Fahrzeugen ab', async () => {
    const response = await call('/api/pickers/vehicles?scope=quatsch', 'vehicles')
    expect(response.status).toBe(422)
  })

  it('nimmt den Geltungsbereich „bestand" entgegen', async () => {
    const response = await call('/api/pickers/vehicles?scope=bestand', 'vehicles')
    const body = await response.json() as { items: { label: string }[] }
    expect(body.items.map(option => option.label)).toEqual(['Opel Vivaro'])
  })

  it('B-082: weist eine unsinnige Kundenkennung ab, statt sie zu suchen', async () => {
    const response = await call('/api/pickers/vehicles?scope=kunde&customerId=abc', 'vehicles')
    expect(response.status).toBe(422)
  })
})
