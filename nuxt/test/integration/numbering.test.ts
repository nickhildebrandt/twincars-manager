/**
 * Handing out numbers.
 *
 * B-304: the predecessor consumed a document number before the insert and
 * outside any transaction. A failure downstream left a gap, and gaps in an
 * invoice sequence have to be explained to the tax office. Worse, reading and
 * writing the counter in two steps could hand the same number to two requests.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { numberRanges } from '../../server/database/schema/index.ts'
import { allocateNumber, peekNumber } from '../../server/utils/numbering.ts'
import { DEFAULT_NUMBER_RANGES } from '../../server/database/seed/index.ts'
import { openTestDatabase } from '../setup/drizzle'

const { db, close } = openTestDatabase()
afterAll(close)

beforeEach(async () => {
  await db.delete(numberRanges)
  await db.insert(numberRanges).values(
    DEFAULT_NUMBER_RANGES.map(range => ({ ...range })),
  )
})

describe('allocateNumber', () => {
  it('gibt die erste Nummer eines Kreises aus', async () => {
    await db.update(numberRanges)
      .set({ formatTemplate: 'RE-{YYYY}-{NNNN}' })
      .where(eq(numberRanges.kind, 'invoice'))

    const number = await allocateNumber(db, 'invoice', new Date('2026-09-13T12:00:00Z'))
    expect(number).toBe('RE-2026-0001')
  })

  it('zählt bei jedem Aufruf weiter', async () => {
    const first = await allocateNumber(db, 'work_order')
    const second = await allocateNumber(db, 'work_order')
    expect(first).not.toBe(second)
  })

  it('gibt unter zehn gleichzeitigen Aufrufen zehn verschiedene Nummern aus', async () => {
    // Der entscheidende Fall: zwei Rechnungen mit derselben Nummer sind ein
    // Fehler, den man später nicht mehr reparieren kann.
    const numbers = await Promise.all(
      Array.from({ length: 10 }, () => allocateNumber(db, 'invoice')),
    )
    expect(new Set(numbers).size).toBe(10)
  })

  it('vergibt die zehn Nummern lückenlos', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 10 }, () => allocateNumber(db, 'customer')),
    )
    expect(numbers.map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('lässt keine Lücke, wenn die Transaktion scheitert', async () => {
    await allocateNumber(db, 'offer')

    await expect(db.transaction(async (tx) => {
      await allocateNumber(tx, 'offer')
      throw new Error('Der Beleg konnte nicht geschrieben werden.')
    })).rejects.toThrow('Der Beleg konnte nicht geschrieben werden.')

    // Die zurückgerollte Nummer wird wieder vergeben.
    expect(await allocateNumber(db, 'offer')).toBe('2')
  })

  it('meldet einen fehlenden Nummernkreis, statt eine Nummer zu erfinden', async () => {
    await db.delete(numberRanges).where(eq(numberRanges.kind, 'tire'))
    await expect(allocateNumber(db, 'tire')).rejects.toThrow('Kein Nummernkreis für "tire" vorhanden.')
  })
})

describe('peekNumber', () => {
  it('zeigt die nächste Nummer, ohne sie zu verbrauchen', async () => {
    const preview = await peekNumber(db, 'invoice')
    expect(await allocateNumber(db, 'invoice')).toBe(preview)
  })

  it('meldet einen fehlenden Kreis als null', async () => {
    await db.delete(numberRanges).where(eq(numberRanges.kind, 'storno'))
    expect(await peekNumber(db, 'storno')).toBeNull()
  })
})

describe('Regression', () => {
  it('B-304: eine gescheiterte Belegerstellung hinterlässt keine Nummernlücke', async () => {
    // Der Vorgänger verbrauchte die Nummer vor dem Einfügen und außerhalb
    // jeder Transaktion. Scheiterte danach etwas, blieb eine Lücke in der
    // Rechnungsfolge — und Lücken muss man dem Finanzamt erklären.
    const first = await allocateNumber(db, 'invoice')

    await expect(db.transaction(async (tx) => {
      await allocateNumber(tx, 'invoice')
      throw new Error('Die Positionen konnten nicht geschrieben werden.')
    })).rejects.toThrow()

    const next = await allocateNumber(db, 'invoice')
    expect(Number(next)).toBe(Number(first) + 1)
  })
})
