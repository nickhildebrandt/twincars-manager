/**
 * Belegketten und Abhängigkeits-Schnappschüsse (M-41, M-42, M-43).
 *
 * Zwei Zusagen werden hier geprüft, und beide hängen zusammen:
 *
 *   1. Ein vertragswirksamer Beleg **entwickelt sich in Ständen**. Alle Stände
 *      bleiben, genau einer gilt, und der Zeitstrahl geht zurück.
 *   2. Beim Ausstellen wird der Stand aller Verweise **abgeschrieben**. Ändert
 *      sich später die Kundenanschrift oder das Kennzeichen, fällt das auf,
 *      statt still das Bild der Vergangenheit zu verfälschen.
 *
 * Geprüft wird gegen echtes PostgreSQL: die entscheidenden Zusagen aus M-41
 * stehen als Indizes und Prüfbedingungen in der Datenbank, nicht im Code. Eine
 * Zusage, die nur der Code einhält, hält irgendwann jemand nicht ein.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { installNitroGlobals } from '../setup/nitro-globals'

installNitroGlobals()

const {
  companySettings,
  customers,
  documentSnapshots,
  documents,
  vehicleLicensePlateVersions,
  vehicleOwnerHistory,
  vehicleSales,
  vehicles,
} = await import('../../server/database/schema/index.ts')

const {
  driftOf,
  documentsHolding,
  snapshotOf,
  snapshotsOf,
  takeSnapshots,
} = await import('../../server/services/snapshot-service.ts')

const { useDatabase, closeDatabase } = await import('../../server/utils/db.ts')

const db = useDatabase()

afterAll(() => closeDatabase())

beforeEach(async () => {
  await db.delete(documentSnapshots)
  await db.delete(vehicleOwnerHistory)
  await db.delete(vehicleSales)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(documents)
  await db.delete(vehicles)
  await db.delete(customers)
  await db.delete(companySettings)
})

/* ── Bausteine ─────────────────────────────────────────────────────────── */

let counter = 0
const nextNumber = () => `K-${String(++counter).padStart(5, '0')}`

async function aCustomer(fields: Record<string, unknown> = {}) {
  const [row] = await db.insert(customers).values({
    customerNumber: nextNumber(),
    lastName: 'Mustermann',
    street: 'Hauptstraße 1',
    zip: '89073',
    city: 'Ulm',
    ...fields,
  }).returning()
  return row!
}

async function aVehicle(fields: Record<string, unknown> = {}) {
  const [row] = await db.insert(vehicles).values({
    make: 'VW',
    model: 'Golf',
    vin: 'WVWZZZ1KZAW000001',
    mileageKm: 120_000,
    ...fields,
  }).returning()
  return row!
}

/** Ein Beleg als erster Stand seiner Kette. */
async function aDocument(fields: Record<string, unknown> = {}) {
  const [row] = await db.insert(documents).values({
    type: 'cost_estimate',
    issueDate: '2026-03-01',
    ...fields,
  }).returning()
  return row!
}

/**
 * Der nächste Stand derselben Kette.
 *
 * Genau so, wie der Belegdienst es später tun wird — und die **Reihenfolge ist
 * vorgeschrieben**: erst den alten Stand ablösen, dann den neuen anlegen.
 *
 * Andersherum gäbe es einen Augenblick mit zwei gültigen Ständen, und der
 * bedingte Index weist ihn sofort ab. Das ist keine Umständlichkeit, sondern
 * der Beweis, dass die Zusage greift: selbst innerhalb einer Transaktion kann
 * es die Lage „zwei gültige Stände" nicht geben.
 */
async function nextVersion(previous: typeof documents.$inferSelect, fields: Record<string, unknown> = {}) {
  return db.transaction(async (tx) => {
    await tx.update(documents)
      .set({ supersededAt: new Date().toISOString() })
      .where(eq(documents.id, previous.id))

    const [created] = await tx.insert(documents).values({
      type: previous.type,
      issueDate: previous.issueDate,
      chainId: previous.chainId,
      version: previous.version + 1,
      replacesDocumentId: previous.id,
      ...fields,
    }).returning()

    return created!
  })
}

/**
 * Prüft, dass die Datenbank mit **dieser** Bedingung abweist.
 *
 * Der Treiber packt die eigentliche Meldung in `cause`; oben steht nur die
 * Abfrage. Ohne diese Auspackung prüfte der Test bloß „irgendetwas ging
 * schief" — und das ginge auch bei einem Tippfehler im Spaltennamen gut.
 */
async function rejectedBy(work: Promise<unknown>, constraint: string): Promise<void> {
  try {
    await work
  }
  catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause
    expect(cause?.constraint_name).toBe(constraint)
    return
  }
  throw new Error(`Erwartet wurde eine Abweisung durch „${constraint}" — es ging durch.`)
}

/* ── M-41: die Belegkette ──────────────────────────────────────────────── */

describe('M-41: ein Beleg entwickelt sich in Ständen', () => {
  it('M-41: der erste Stand bekommt eine eigene Kette und die Version 1', async () => {
    const first = await aDocument()
    expect(first.version).toBe(1)
    expect(first.chainId).toBeTruthy()
    expect(first.supersededAt).toBeNull()
    expect(first.replacesDocumentId).toBeNull()
    expect(first.versionNote).toBeNull()
  })

  it('M-41: zwei Belege haben verschiedene Ketten', async () => {
    const one = await aDocument()
    const two = await aDocument()
    expect(one.chainId).not.toBe(two.chainId)
  })

  it('M-41: der nächste Stand erbt die Kette und zählt hoch', async () => {
    const first = await aDocument()
    const second = await nextVersion(first, { versionNote: 'Positionen nachgetragen' })

    expect(second.chainId).toBe(first.chainId)
    expect(second.version).toBe(2)
    expect(second.replacesDocumentId).toBe(first.id)
    expect(second.versionNote).toBe('Positionen nachgetragen')
  })

  it('M-41: der frühere Stand bleibt stehen', async () => {
    // Der Kern der Zusage: nichts wird überschrieben. Aus
    // Dokumentationsgründen bleibt jeder Stand lesbar.
    const first = await aDocument({ notes: 'erster Wurf' })
    await nextVersion(first)

    const [kept] = await db.select().from(documents).where(eq(documents.id, first.id))
    expect(kept?.notes).toBe('erster Wurf')
    expect(kept?.supersededAt).not.toBeNull()
  })

  it('M-41: die Kette lässt sich in beide Richtungen ablaufen', async () => {
    // Rückwärts steht der Zeiger in der Zeile, vorwärts wird er gesucht. Der
    // Zeitstrahl braucht beides, gespeichert wird nur eines.
    const v1 = await aDocument()
    const v2 = await nextVersion(v1)
    const v3 = await nextVersion(v2)

    expect(v3.replacesDocumentId).toBe(v2.id)
    expect(v2.replacesDocumentId).toBe(v1.id)

    const [nachfolger] = await db.select()
      .from(documents)
      .where(eq(documents.replacesDocumentId, v1.id))
    expect(nachfolger?.id).toBe(v2.id)
  })

  it('M-41: ein Stand kann nur einmal ersetzt werden', async () => {
    // Sonst verzweigte die Kette, und „gültig ist der letzte" hätte zwei
    // Antworten.
    const v1 = await aDocument()
    await nextVersion(v1)

    await rejectedBy(db.insert(documents).values({
      type: 'cost_estimate',
      issueDate: '2026-03-04',
      chainId: v1.chainId,
      version: 3,
      replacesDocumentId: v1.id,
      supersededAt: new Date().toISOString(),
    }), 'documents_replaces_idx')
  })

  it('M-41: Version 1 ersetzt nichts, jede weitere ersetzt genau einen Stand', async () => {
    const first = await aDocument()

    await rejectedBy(aDocument({ version: 2 }), 'documents_replaces_check')
    await rejectedBy(
      aDocument({ replacesDocumentId: first.id }),
      'documents_replaces_check',
    )
  })

  it('P-24: gültig ist immer der letzte Stand, frühere bleiben unverändert', async () => {
    const v1 = await aDocument()
    const v2 = await nextVersion(v1)
    await nextVersion(v2)

    const current = await db.select()
      .from(documents)
      .where(eq(documents.chainId, v1.chainId))
    const gueltig = current.filter(row => row.supersededAt === null)

    expect(current.length).toBe(3)
    expect(gueltig.length).toBe(1)
    expect(gueltig[0]?.version).toBe(3)
  })

  it('P-24: die Datenbank lässt keine zwei gültigen Stände einer Kette zu', async () => {
    // Die wichtigste Zusage, und sie steht als bedingter Index in der
    // Datenbank — nicht als Prüfung im Dienst. Ein Dienst lässt sich umgehen.
    const first = await aDocument()

    await rejectedBy(db.insert(documents).values({
      type: 'cost_estimate',
      issueDate: '2026-03-02',
      chainId: first.chainId,
      version: 2,
      replacesDocumentId: first.id,
    }), 'documents_chain_current_idx')
  })

  it('M-41: dieselbe Version zweimal in einer Kette wird abgewiesen', async () => {
    const first = await aDocument()
    await nextVersion(first)

    await rejectedBy(db.insert(documents).values({
      type: 'cost_estimate',
      issueDate: '2026-03-03',
      chainId: first.chainId,
      version: 2,
      replacesDocumentId: first.id,
      supersededAt: new Date().toISOString(),
    }), 'documents_chain_version_idx')
  })

  it('M-41: eine Version unter 1 gibt es nicht', async () => {
    const first = await aDocument()
    await rejectedBy(
      aDocument({ version: 0, replacesDocumentId: first.id }),
      'documents_version_check',
    )
  })

  it('M-41: die Kette gilt für Kostenvoranschläge wie für Rechnungen', async () => {
    // „Für Kostenvoranschläge gilt genau dasselbe."
    for (const type of ['cost_estimate', 'invoice'] as const) {
      const v1 = await aDocument({ type })
      const v2 = await nextVersion(v1)
      expect(v2.type).toBe(type)
      expect(v2.version).toBe(2)
    }
  })

  it('M-41: ein früherer Stand lässt sich nicht löschen, solange ein späterer auf ihn zeigt', async () => {
    // M-38 in dieser Kette: der Verweis sperrt.
    const v1 = await aDocument()
    await nextVersion(v1)

    await rejectedBy(db.delete(documents).where(eq(documents.id, v1.id)), 'documents_replaces_fk')
  })

  it('M-41: die Kette überlebt, wenn der gültige Stand storniert wird', async () => {
    // Eine stornierte Rechnung bleibt der letzte Stand ihrer Kette, bis eine
    // neue ausgestellt wird. „Keine Kette ohne gültigen Stand" heißt nicht
    // „keine Kette ohne offene Rechnung".
    const v1 = await aDocument({ type: 'invoice', status: 'cancelled' })

    const current = await db.select().from(documents).where(eq(documents.chainId, v1.chainId))
    expect(current.filter(row => row.supersededAt === null).length).toBe(1)
  })
})

/* ── M-42: der Schnappschuss ───────────────────────────────────────────── */

describe('M-42: beim Ausstellen wird der Stand der Verweise abgeschrieben', () => {
  it('M-42: Kunde, Fahrzeug und Firma werden abgeschrieben', async () => {
    await db.insert(companySettings).values({ companyName: 'TwinCars', taxNumber: '88/123/45678' })
    const customer = await aCustomer()
    const vehicle = await aVehicle()
    const document = await aDocument({ customerId: customer.id, vehicleId: vehicle.id })

    expect(await takeSnapshots(document.id, db)).toBe(3)

    const taken = await snapshotsOf(document.id, db)
    expect(taken.map(row => row.entity).sort()).toEqual(['company_settings', 'customers', 'vehicles'])
  })

  it('M-42: ohne Fahrzeug wird kein Fahrzeug abgeschrieben', async () => {
    const customer = await aCustomer()
    const document = await aDocument({ customerId: customer.id })

    await takeSnapshots(document.id, db)
    const taken = await snapshotsOf(document.id, db)
    expect(taken.map(row => row.entity)).toEqual(['customers'])
  })

  it('M-42: der Schnappschuss enthält die Anschrift von damals', async () => {
    const customer = await aCustomer({ street: 'Hauptstraße 1', city: 'Ulm' })
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    const [taken] = await snapshotsOf(document.id, db)
    expect(taken?.data.street).toBe('Hauptstraße 1')
    expect(taken?.data.city).toBe('Ulm')
    expect(taken?.entityId).toBe(customer.id)
  })

  it('M-42: das Kennzeichen wird mit abgeschrieben, obwohl es nicht am Fahrzeug steht', async () => {
    // Der Kennzeichenwechsel ist genau der Fall, für den es diesen Vergleich
    // gibt. Läge das Kennzeichen nicht im Schnappschuss, fiele er als
    // einziger nicht auf.
    const vehicle = await aVehicle()
    await db.insert(vehicleLicensePlateVersions).values({
      vehicleId: vehicle.id,
      validFrom: '2020-01-01',
      licensePlate: 'UL-AB 123',
    })
    const document = await aDocument({ vehicleId: vehicle.id })
    await takeSnapshots(document.id, db)

    const [taken] = await snapshotsOf(document.id, db)
    expect(taken?.data.licensePlate).toBe('UL-AB 123')
  })

  it('M-42: ein Kennzeichen, das erst in Zukunft gilt, zählt noch nicht', async () => {
    const vehicle = await aVehicle()
    await db.insert(vehicleLicensePlateVersions).values([
      { vehicleId: vehicle.id, validFrom: '2020-01-01', licensePlate: 'UL-AB 123' },
      { vehicleId: vehicle.id, validFrom: '2099-01-01', licensePlate: 'UL-XY 999' },
    ])
    const document = await aDocument({ vehicleId: vehicle.id })
    await takeSnapshots(document.id, db)

    const [taken] = await snapshotsOf(document.id, db)
    expect(taken?.data.licensePlate).toBe('UL-AB 123')
  })

  it('P-25: zweimal abschreiben ändert nichts — die Abschrift von damals gilt', async () => {
    const customer = await aCustomer({ city: 'Ulm' })
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    await db.update(customers).set({ city: 'Neu-Ulm' }).where(eq(customers.id, customer.id))
    expect(await takeSnapshots(document.id, db)).toBe(0)

    const [taken] = await snapshotsOf(document.id, db)
    expect(taken?.data.city).toBe('Ulm')
  })

  it('M-42: derselbe Beleg bekommt je Art nur einen Schnappschuss', async () => {
    const customer = await aCustomer()
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    await rejectedBy(db.insert(documentSnapshots).values({
      documentId: document.id,
      entity: 'customers',
      entityId: customer.id,
      data: {},
    }), 'document_snapshots_document_entity_idx')
  })

  it('M-42: eine unbekannte Art wird abgewiesen', async () => {
    const document = await aDocument()
    await rejectedBy(db.insert(documentSnapshots).values({
      documentId: document.id,
      entity: 'irgendwas',
      data: {},
    }), 'document_snapshots_entity_check')
  })

  it('M-42: Passwörter und Schlüssel werden nie abgeschrieben', async () => {
    // Dieselbe Lücke wie im Protokoll, an einer zweiten Stelle. Sie wird an
    // beiden Stellen mit derselben Liste geschlossen.
    const copy = snapshotOf({
      lastName: 'Mustermann',
      passwordHash: 'geheim',
      smtpPassword: 'auch geheim',
      ebayAccessToken: 'ebenfalls',
      apiToken: 'nein',
    })

    expect(copy).toEqual({ lastName: 'Mustermann' })
  })

  it('M-42: Kennung und Zeitstempel stehen nicht in der Abschrift', async () => {
    const copy = snapshotOf({ id: 'x', createdAt: 'y', updatedAt: 'z', city: 'Ulm' })
    expect(copy).toEqual({ city: 'Ulm' })
  })

  it('M-42: ein Datum wird als Zeichenkette abgelegt, nicht als Objekt', async () => {
    // Sonst steht in `jsonb` je nach Treiber etwas anderes, und der Vergleich
    // meldet einen Unterschied, wo keiner ist.
    const copy = snapshotOf({ signedAt: new Date('2026-03-01T10:00:00Z') })
    expect(copy.signedAt).toBe('2026-03-01T10:00:00.000Z')
  })
})

/* ── M-42: was sich seither geändert hat ───────────────────────────────── */

describe('M-42: die Anwendung sagt, was sich seit dem Ausstellen geändert hat', () => {
  it('M-42: unverändert meldet nichts', async () => {
    const customer = await aCustomer()
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    expect(await driftOf(document.id, db)).toEqual([])
  })

  it('M-42: ein Umzug des Kunden wird gemeldet, mit altem und neuem Wert', async () => {
    const customer = await aCustomer({ street: 'Hauptstraße 1', city: 'Ulm' })
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    await db.update(customers)
      .set({ street: 'Bahnhofstraße 9', city: 'Neu-Ulm' })
      .where(eq(customers.id, customer.id))

    const drift = await driftOf(document.id, db)
    expect(drift.length).toBe(1)
    expect(drift[0]?.entity).toBe('customers')
    expect(drift[0]?.entityLabel).toBe('Kunde')

    const fields = Object.fromEntries(drift[0]!.changes.map(change => [change.field, change]))
    expect(fields.street?.before).toBe('Hauptstraße 1')
    expect(fields.street?.after).toBe('Bahnhofstraße 9')
    expect(fields.city?.after).toBe('Neu-Ulm')
  })

  it('M-42: die Meldung trägt deutsche Feldnamen', async () => {
    const customer = await aCustomer({ street: 'Hauptstraße 1' })
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)
    await db.update(customers).set({ street: 'Bahnhofstraße 9' }).where(eq(customers.id, customer.id))

    const drift = await driftOf(document.id, db)
    expect(drift[0]?.changes.map(change => change.label)).toContain('Straße')
  })

  it('M-42: ein Kennzeichenwechsel wird gemeldet', async () => {
    const vehicle = await aVehicle()
    await db.insert(vehicleLicensePlateVersions).values({
      vehicleId: vehicle.id, validFrom: '2020-01-01', licensePlate: 'UL-AB 123',
    })
    const document = await aDocument({ vehicleId: vehicle.id })
    await takeSnapshots(document.id, db)

    await db.insert(vehicleLicensePlateVersions).values({
      vehicleId: vehicle.id, validFrom: '2026-06-01', licensePlate: 'UL-XY 999',
    })

    const drift = await driftOf(document.id, db)
    expect(drift.length).toBe(1)
    expect(drift[0]?.entity).toBe('vehicles')

    const plate = drift[0]!.changes.find(change => change.field === 'licensePlate')
    expect(plate?.before).toBe('UL-AB 123')
    expect(plate?.after).toBe('UL-XY 999')
    expect(plate?.label).toBe('Kennzeichen')
  })

  it('M-42: eine geänderte Steuernummer der Firma wird gemeldet', async () => {
    await db.insert(companySettings).values({ companyName: 'TwinCars', taxNumber: '88/123/45678' })
    const document = await aDocument()
    await takeSnapshots(document.id, db)

    await db.update(companySettings).set({ taxNumber: '88/999/00000' })

    const drift = await driftOf(document.id, db)
    expect(drift[0]?.entity).toBe('company_settings')
    expect(drift[0]?.entityLabel).toBe('Firma')
  })

  it('M-42: mehrere geänderte Verweise werden getrennt gemeldet', async () => {
    await db.insert(companySettings).values({ companyName: 'TwinCars' })
    const customer = await aCustomer({ city: 'Ulm' })
    const vehicle = await aVehicle({ mileageKm: 120_000 })
    const document = await aDocument({ customerId: customer.id, vehicleId: vehicle.id })
    await takeSnapshots(document.id, db)

    await db.update(customers).set({ city: 'Neu-Ulm' }).where(eq(customers.id, customer.id))
    await db.update(vehicles).set({ mileageKm: 135_000 }).where(eq(vehicles.id, vehicle.id))

    const drift = await driftOf(document.id, db)
    expect(drift.map(row => row.entity).sort()).toEqual(['customers', 'vehicles'])
  })

  it('M-42: ein Beleg ohne Schnappschuss meldet nichts', async () => {
    const document = await aDocument()
    expect(await driftOf(document.id, db)).toEqual([])
  })

  it('M-42: vom Kunden aus ist zu sehen, welche Belege seinen alten Stand tragen', async () => {
    const customer = await aCustomer()
    const one = await aDocument({ customerId: customer.id })
    const two = await aDocument({ customerId: customer.id })
    await takeSnapshots(one.id, db)
    await takeSnapshots(two.id, db)

    const holding = await documentsHolding('customers', customer.id, db)
    expect(holding.sort()).toEqual([one.id, two.id].sort())
  })

  it('P-25: ein Schnappschuss sperrt das Löschen seines Belegs', async () => {
    const customer = await aCustomer()
    const document = await aDocument({ customerId: customer.id })
    await takeSnapshots(document.id, db)

    await rejectedBy(db.delete(documents).where(eq(documents.id, document.id)), 'document_snapshots_document_id_documents_id_fk')
  })
})

/* ── M-43: der Verbleib des Fahrzeugs ──────────────────────────────────── */

describe('M-43: wohin ein Fahrzeug ging, steht fest', () => {
  it('P-26: ein Verkauf an einen Kunden braucht einen Kunden', async () => {
    const vehicle = await aVehicle()
    await rejectedBy(db.insert(vehicleSales).values({
      vehicleId: vehicle.id,
      exitKind: 'kunde',
      saleDate: '2026-04-01',
      salesPriceGross: 950_000,
    }), 'vehicle_sales_customer_check')
  })

  it('P-26: ein Export braucht keinen Kunden, sagt aber wohin', async () => {
    // Der Fall, den der Vorgänger gar nicht aufschreiben konnte: das Fahrzeug
    // hörte einfach auf, eine Geschichte zu haben.
    const vehicle = await aVehicle()
    const [sale] = await db.insert(vehicleSales).values({
      vehicleId: vehicle.id,
      exitKind: 'export',
      buyerName: 'Auto Handel Kowalski',
      buyerAddress: 'ul. Główna 5, 00-001 Warszawa',
      destination: 'Export nach Polen',
      saleDate: '2026-04-01',
      salesPriceGross: 650_000,
    }).returning()

    expect(sale?.customerId).toBeNull()
    expect(sale?.destination).toBe('Export nach Polen')
    expect(sale?.buyerName).toBe('Auto Handel Kowalski')
  })

  it('M-43: eine unbekannte Abgangsart wird abgewiesen', async () => {
    const vehicle = await aVehicle()
    await rejectedBy(db.insert(vehicleSales).values({
      vehicleId: vehicle.id,
      exitKind: 'verschenkt',
      saleDate: '2026-04-01',
      salesPriceGross: 0,
    }), 'vehicle_sales_exit_kind_check')
  })

  it('M-43: der Halterwechsel nennt seinen Grund', async () => {
    const vehicle = await aVehicle()
    const customer = await aCustomer()
    const [entry] = await db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      customerId: customer.id,
      customerName: 'Mustermann',
      customerAddress: 'Hauptstraße 1, 89073 Ulm',
      reason: 'ankauf',
      ownerFrom: '2026-01-15',
    }).returning()

    expect(entry?.reason).toBe('ankauf')
    expect(entry?.customerAddress).toBe('Hauptstraße 1, 89073 Ulm')
  })

  it('M-43: ohne Angabe ist der Grund ein Halterwechsel', async () => {
    const vehicle = await aVehicle()
    const [entry] = await db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      ownerFrom: '2026-01-15',
    }).returning()

    expect(entry?.reason).toBe('halterwechsel')
  })

  it('M-43: ein unbekannter Grund wird abgewiesen', async () => {
    const vehicle = await aVehicle()
    await rejectedBy(db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      reason: 'weil',
      ownerFrom: '2026-01-15',
    }), 'vehicle_owner_history_reason_check')
  })

  it('M-43: ein Zeitraum, der vor seinem Beginn endet, wird abgewiesen', async () => {
    const vehicle = await aVehicle()
    await rejectedBy(db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      ownerFrom: '2026-01-15',
      ownerUntil: '2025-12-01',
    }), 'vehicle_owner_history_period_check')
  })

  it('M-43: der Halterwechsel nennt den Beleg, aus dem er hervorging', async () => {
    const vehicle = await aVehicle()
    const invoice = await aDocument({ type: 'invoice' })
    const [entry] = await db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      reason: 'verkauf',
      documentId: invoice.id,
      ownerFrom: '2026-02-01',
    }).returning()

    expect(entry?.documentId).toBe(invoice.id)
  })

  it('M-43: die Anschrift von damals überlebt den Umzug des Halters', async () => {
    // Beim Kunden zählt der Stand zum Zeitpunkt — nicht die Historie des
    // Kundendatensatzes.
    const vehicle = await aVehicle()
    const customer = await aCustomer({ city: 'Ulm' })
    await db.insert(vehicleOwnerHistory).values({
      vehicleId: vehicle.id,
      customerId: customer.id,
      customerName: 'Mustermann',
      customerAddress: 'Hauptstraße 1, 89073 Ulm',
      reason: 'halterwechsel',
      ownerFrom: '2020-01-01',
      ownerUntil: '2026-01-01',
    })

    await db.update(customers).set({ city: 'Neu-Ulm', zip: '89231' }).where(eq(customers.id, customer.id))

    const [entry] = await db.select().from(vehicleOwnerHistory)
    expect(entry?.customerAddress).toBe('Hauptstraße 1, 89073 Ulm')
  })
})
