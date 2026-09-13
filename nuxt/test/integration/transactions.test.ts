/**
 * Transactions.
 *
 * The predecessor had none — not a single one in 33 000 lines of service code.
 * Every multi-step write could leave half its work behind: a document without
 * positions, a cancellation without its counter-entry, a consumed number
 * without a document (B-304). `withTransaction` is mandatory as soon as more
 * than one statement writes.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { customers, vehicles } from '../../server/database/schema/index.ts'
import { openTestDatabase } from '../setup/drizzle'

const { db, close } = openTestDatabase()
afterAll(close)

beforeEach(async () => {
  await db.delete(customers)
})

const customerNumber = 'TX-0001'

describe('eine gescheiterte Transaktion hinterlässt nichts', () => {
  it('rollt den Kunden zurück, wenn das Fahrzeug scheitert', async () => {
    await expect(db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({ customerNumber, lastName: 'Rückabwicklung' })
        .returning()

      expect(customer).toBeDefined()

      // Ein Fahrzeug an einem Kunden, den es nicht gibt: der Fremdschlüssel
      // schlägt fehl — nachdem die erste Anweisung bereits geschrieben hat.
      await tx.insert(vehicles).values({
        customerId: '00000000-0000-4000-8000-000000000000',
        make: 'VW',
        model: 'Golf',
      })
    })).rejects.toThrow()

    const left = await db.select().from(customers).where(eq(customers.customerNumber, customerNumber))
    expect(left).toEqual([])
  })

  it('rollt auch bei einem Fehler in der Anwendung zurück', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.insert(customers).values({ customerNumber, lastName: 'Fachlicher Abbruch' })
      throw new Error('Der Vorgang wurde abgebrochen.')
    })).rejects.toThrow('Der Vorgang wurde abgebrochen.')

    const left = await db.select().from(customers).where(eq(customers.customerNumber, customerNumber))
    expect(left).toEqual([])
  })

  it('schreibt alles, wenn nichts scheitert', async () => {
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({ customerNumber, lastName: 'Erfolg' })
        .returning()
      await tx.insert(vehicles).values({
        customerId: customer!.id,
        make: 'VW',
        model: 'Golf',
      })
    })

    const [customer] = await db.select().from(customers).where(eq(customers.customerNumber, customerNumber))
    expect(customer?.lastName).toBe('Erfolg')

    const cars = await db.select().from(vehicles).where(eq(vehicles.customerId, customer!.id))
    expect(cars).toHaveLength(1)
  })

  it('sieht die eigene Zwischenarbeit innerhalb der Transaktion', async () => {
    const seen = await db.transaction(async (tx) => {
      await tx.insert(customers).values({ customerNumber, lastName: 'Zwischenstand' })
      const rows = await tx.select().from(customers).where(eq(customers.customerNumber, customerNumber))
      return rows.length
    })
    expect(seen).toBe(1)
  })
})
