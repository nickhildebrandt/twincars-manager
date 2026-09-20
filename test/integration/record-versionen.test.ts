/**
 * Zeitstrahl und Rücksprung für jeden versionierten Datensatz (M-45).
 *
 * Festgelegt am 20.09.2026: „Ziel ist ein wiederverwendbares Feature für
 * Versionierung mit Zeitstrahl und gegebenenfalls Rücksprung, keine
 * Einzellösung."
 *
 * Geprüft wird deshalb nicht nur, **dass** es für Kunden funktioniert, sondern
 * dass es für zwei völlig verschiedene Datensätze dieselbe Mechanik ist — und
 * dass ein Rücksprung nie etwas verliert.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { installNitroGlobals } from '../setup/nitro-globals'

installNitroGlobals()

const { customers, recordVersions, vehicles } = await import('../../server/database/schema/index.ts')

const {
  changedFieldsBetween,
  latestVersionOf,
  recordVersion,
  restoreVersion,
  versionAt,
  versionsOf,
} = await import('../../server/services/record-version-service.ts')

const { useDatabase, closeDatabase, withTransaction } = await import('../../server/utils/db.ts')

const db = useDatabase()

afterAll(() => closeDatabase())

beforeEach(async () => {
  await db.delete(recordVersions)
  await db.delete(vehicles)
  await db.delete(customers)
})

let counter = 0
const nextNumber = () => `K-${String(++counter).padStart(5, '0')}`

async function aCustomer(fields: Record<string, unknown> = {}) {
  const [row] = await db.insert(customers).values({
    customerNumber: nextNumber(),
    lastName: 'Mustermann',
    street: 'Hauptstraße 1',
    city: 'Ulm',
    ...fields,
  }).returning()
  return row!
}

async function aVehicle(fields: Record<string, unknown> = {}) {
  const [row] = await db.insert(vehicles).values({
    make: 'VW',
    model: 'Golf',
    mileageKm: 120_000,
    ...fields,
  }).returning()
  return row!
}

/* ── Stände schreiben ──────────────────────────────────────────────────── */

describe('M-45: jeder Speichervorgang hinterlässt einen Stand', () => {
  it('M-45: der erste Stand ist Version 1', async () => {
    const customer = await aCustomer()
    expect(await recordVersion('customers', customer.id, customer, {}, db)).toBe(1)
  })

  it('M-45: jeder weitere Stand zählt hoch', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)
    await recordVersion('customers', customer.id, { ...customer, city: 'Neu-Ulm' }, {}, db)
    expect(await recordVersion('customers', customer.id, customer, {}, db)).toBe(3)
  })

  it('M-45: zwei Datensätze zählen getrennt', async () => {
    const one = await aCustomer()
    const two = await aCustomer()
    await recordVersion('customers', one.id, one, {}, db)
    await recordVersion('customers', one.id, one, {}, db)

    expect(await recordVersion('customers', two.id, two, {}, db)).toBe(1)
    expect(await latestVersionOf('customers', one.id, db)).toBe(2)
  })

  it('M-45: zwei Arten zählen getrennt, auch bei gleicher Kennung', async () => {
    // Der Zähler hängt an (Art, Kennung), nicht an der Kennung allein.
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)
    await recordVersion('vehicles', customer.id, { make: 'VW' }, {}, db)

    expect(await latestVersionOf('customers', customer.id, db)).toBe(1)
    expect(await latestVersionOf('vehicles', customer.id, db)).toBe(1)
  })

  it('M-45: der Stand trägt, wer ihn erzeugt hat, und warum', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {
      userName: 'Anna Schmitt',
      note: 'Anschrift nach Umzug berichtigt',
    }, db)

    const [stand] = await versionsOf('customers', customer.id, db)
    expect(stand?.changedByName).toBe('Anna Schmitt')
    expect(stand?.note).toBe('Anschrift nach Umzug berichtigt')
  })

  it('M-45: Kennung und Zeitstempel stehen nicht im Stand', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)

    const [stand] = await versionsOf('customers', customer.id, db)
    expect(stand?.data.id).toBeUndefined()
    expect(stand?.data.createdAt).toBeUndefined()
    expect(stand?.data.updatedAt).toBeUndefined()
    expect(stand?.data.lastName).toBe('Mustermann')
  })

  it('M-45: Passwörter und Schlüssel stehen nie in einem Stand', async () => {
    // Dieselbe Liste wie im Protokoll und beim Schnappschuss — sie steht
    // einmal in `server/utils/record-state.ts`, damit die Lücke nicht an drei
    // Stellen getrennt geschlossen werden muss.
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, {
      lastName: 'Mustermann',
      smtpPassword: 'geheim',
      ebayAccessToken: 'auch geheim',
    }, {}, db)

    const [stand] = await versionsOf('customers', customer.id, db)
    expect(stand?.data).toEqual({ lastName: 'Mustermann' })
  })

  it('M-45: der Stand überlebt seinen Datensatz', async () => {
    // Kein Fremdschlüssel, und das mit Absicht: ein Stand, der mit seinem
    // Datensatz verschwindet, ist keiner.
    const vehicle = await aVehicle()
    await recordVersion('vehicles', vehicle.id, vehicle, {}, db)
    await db.delete(vehicles).where(eq(vehicles.id, vehicle.id))

    expect((await versionsOf('vehicles', vehicle.id, db)).length).toBe(1)
  })

  it('M-45: dieselbe Version zweimal wird abgewiesen', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)

    await expect(db.insert(recordVersions).values({
      entity: 'customers',
      entityId: customer.id,
      version: 1,
      data: {},
    })).rejects.toThrow()
  })

  it('M-45: eine unbekannte Art wird abgewiesen', async () => {
    const customer = await aCustomer()
    await expect(db.insert(recordVersions).values({
      entity: 'irgendwas',
      entityId: customer.id,
      version: 1,
      data: {},
    })).rejects.toThrow()
  })

  it('M-45: ein Rücksprung aus einem späteren Stand ist unmöglich', async () => {
    const customer = await aCustomer()
    await expect(db.insert(recordVersions).values({
      entity: 'customers',
      entityId: customer.id,
      version: 2,
      restoredFromVersion: 5,
      data: {},
    })).rejects.toThrow()
  })
})

/* ── Zeitstrahl ────────────────────────────────────────────────────────── */

describe('M-45: der Zeitstrahl', () => {
  it('M-45: zeigt den neuesten Stand zuerst', async () => {
    const customer = await aCustomer()
    for (const city of ['Ulm', 'Neu-Ulm', 'Senden']) {
      await recordVersion('customers', customer.id, { ...customer, city }, {}, db)
    }

    const timeline = await versionsOf('customers', customer.id, db)
    expect(timeline.map(row => row.version)).toEqual([3, 2, 1])
    expect(timeline[0]?.data.city).toBe('Senden')
  })

  it('M-45: nennt einen einzelnen Stand', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, { ...customer, city: 'Ulm' }, {}, db)
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)

    expect((await versionAt('customers', customer.id, 1, db)).data.city).toBe('Ulm')
  })

  it('M-45: ein Stand, den es nicht gibt, ist ein 404 mit deutschem Satz', async () => {
    const customer = await aCustomer()
    await expect(versionAt('customers', customer.id, 9, db)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('M-45: ohne Stände ist der Zeitstrahl leer und der Zähler 0', async () => {
    const customer = await aCustomer()
    expect(await versionsOf('customers', customer.id, db)).toEqual([])
    expect(await latestVersionOf('customers', customer.id, db)).toBe(0)
  })

  it('M-45: nennt je Schritt die geänderten Felder', async () => {
    const before = { lastName: 'Mustermann', city: 'Ulm', phone: '0731 1' }
    const after = { lastName: 'Mustermann', city: 'Senden', phone: '0731 2' }
    expect(changedFieldsBetween(before, after)).toEqual(['city', 'phone'])
  })

  it('M-45: meldet keine Änderung, wo keine ist', () => {
    const state = { lastName: 'Mustermann', notes: null }
    expect(changedFieldsBetween(state, { ...state })).toEqual([])
  })

  it('M-45: ein neu hinzugekommenes Feld gilt als Änderung', () => {
    expect(changedFieldsBetween({ a: 1 }, { a: 1, b: 2 })).toEqual(['b'])
  })
})

/* ── Rücksprung ────────────────────────────────────────────────────────── */

describe('M-45: einen früheren Stand wieder aufnehmen', () => {
  /** Schreibt einen Kundenstand zurück — so, wie es der Kundendienst täte. */
  const applyCustomer = (id: string) => async (data: Record<string, unknown>, tx: never) =>
    void await (tx as unknown as typeof db)
      .update(customers)
      .set({ city: data.city as string, street: data.street as string })
      .where(eq(customers.id, id))

  it('M-45: setzt den alten Stand als neuen, aktuellen obendrauf', async () => {
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await db.update(customers).set({ city: 'Senden' }).where(eq(customers.id, customer.id))
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)

    const neu = await restoreVersion('customers', customer.id, 1, applyCustomer(customer.id))

    expect(neu).toBe(3)
    const [row] = await db.select().from(customers).where(eq(customers.id, customer.id))
    expect(row?.city).toBe('Ulm')
  })

  it('P-29: der Zeitstrahl bleibt lückenlos und verliert nichts', async () => {
    // Der Kern der Zusage: nichts wird überschrieben, nichts gelöscht. Der
    // zurückgenommene Stand bleibt stehen.
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)
    await restoreVersion('customers', customer.id, 1, applyCustomer(customer.id))

    const timeline = await versionsOf('customers', customer.id, db)
    expect(timeline.map(row => row.version)).toEqual([3, 2, 1])
    expect(timeline.map(row => row.data.city)).toEqual(['Ulm', 'Senden', 'Ulm'])
  })

  it('M-45: der Rücksprung ist als solcher erkennbar', async () => {
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)
    await restoreVersion('customers', customer.id, 1, applyCustomer(customer.id), {
      userName: 'Anna Schmitt',
    })

    const [neuester] = await versionsOf('customers', customer.id, db)
    expect(neuester?.restoredFromVersion).toBe(1)
    expect(neuester?.note).toBe('Stand 1 wieder aufgenommen')
    expect(neuester?.changedByName).toBe('Anna Schmitt')
  })

  it('M-45: zweimal zurückspringen geht und bleibt nachvollziehbar', async () => {
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)

    await restoreVersion('customers', customer.id, 1, applyCustomer(customer.id))
    await restoreVersion('customers', customer.id, 2, applyCustomer(customer.id))

    const timeline = await versionsOf('customers', customer.id, db)
    expect(timeline.map(row => row.version)).toEqual([4, 3, 2, 1])
    expect(timeline.map(row => row.restoredFromVersion)).toEqual([2, 1, null, null])

    const [row] = await db.select().from(customers).where(eq(customers.id, customer.id))
    expect(row?.city).toBe('Senden')
  })

  it('M-45: den aktuellen Stand wiederherzustellen wird abgewiesen', async () => {
    // Ein Zeitstrahl, der denselben Zustand zweimal hintereinander führt,
    // erzählt nichts.
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)

    await expect(restoreVersion('customers', customer.id, 1, applyCustomer(customer.id)))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('M-45: ein Stand, den es nicht gibt, wird abgewiesen', async () => {
    const customer = await aCustomer()
    await recordVersion('customers', customer.id, customer, {}, db)

    await expect(restoreVersion('customers', customer.id, 7, applyCustomer(customer.id)))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('M-45: scheitert das Zurückschreiben, bleibt alles, wie es war', async () => {
    // Datensatz und Zeitstrahl hängen an derselben Transaktion. Ein halb
    // zurückgesprungener Datensatz wäre schlimmer als gar keiner.
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await db.update(customers).set({ city: 'Senden' }).where(eq(customers.id, customer.id))
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)

    await expect(restoreVersion('customers', customer.id, 1, async () => {
      throw new Error('Zurückschreiben ging schief')
    })).rejects.toThrow(/schief/)

    expect(await latestVersionOf('customers', customer.id, db)).toBe(2)
    const [row] = await db.select().from(customers).where(eq(customers.id, customer.id))
    expect(row?.city).toBe('Senden')
  })

  it('M-45: dieselbe Mechanik trägt einen völlig anderen Datensatz', async () => {
    // Das eigentliche Ziel: keine Einzellösung. Derselbe Dienst, dieselben
    // Aufrufe, ein Fahrzeug statt eines Kunden.
    const vehicle = await aVehicle({ mileageKm: 120_000 })
    await recordVersion('vehicles', vehicle.id, vehicle, {}, db)
    await recordVersion('vehicles', vehicle.id, { ...vehicle, mileageKm: 135_000 }, {}, db)

    const neu = await restoreVersion('vehicles', vehicle.id, 1, async (data, tx) => {
      await (tx as unknown as typeof db)
        .update(vehicles)
        .set({ mileageKm: data.mileageKm as number })
        .where(eq(vehicles.id, vehicle.id))
    })

    expect(neu).toBe(3)
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, vehicle.id))
    expect(row?.mileageKm).toBe(120_000)
  })

  it('M-45: läuft in einer vorhandenen Transaktion mit, statt eine eigene zu öffnen', async () => {
    // Der Speicherpfad eines Moduls hat seine Transaktion schon. Eine zweite
    // darin wäre keine Verschachtelung, sondern ein zweiter Zustand.
    const customer = await aCustomer({ city: 'Ulm' })
    await recordVersion('customers', customer.id, customer, {}, db)
    await db.update(customers).set({ city: 'Senden' }).where(eq(customers.id, customer.id))
    await recordVersion('customers', customer.id, { ...customer, city: 'Senden' }, {}, db)

    await expect(withTransaction(async (tx) => {
      await restoreVersion('customers', customer.id, 1, applyCustomer(customer.id), {}, tx)
      throw new Error('Abbruch nach dem Rücksprung')
    })).rejects.toThrow(/Abbruch/)

    // Die äußere Transaktion ist zurückgerollt — also auch der Rücksprung.
    expect(await latestVersionOf('customers', customer.id, db)).toBe(2)
    const [row] = await db.select().from(customers).where(eq(customers.id, customer.id))
    expect(row?.city).toBe('Senden')
  })
})
