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
import { documents, numberRanges } from '../../server/database/schema/index.ts'
import { allocateNumber, issueNumber, peekNumber } from '../../server/utils/numbering.ts'
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
    await allocateNumber(db, 'cost_estimate')

    await expect(db.transaction(async (tx) => {
      await allocateNumber(tx, 'cost_estimate')
      throw new Error('Der Beleg konnte nicht geschrieben werden.')
    })).rejects.toThrow('Der Beleg konnte nicht geschrieben werden.')

    // Die zurückgerollte Nummer wird wieder vergeben. Der Kostenvoranschlag
    // trägt ein Jahresformat, also steht die Zählnummer am Ende.
    expect(await allocateNumber(db, 'cost_estimate')).toMatch(/0002$/)
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

describe('Die Nummer wird beim Ausstellen gezogen', () => {
  it('M-14: ein Entwurf bekommt gar keine Nummer', async () => {
    // Der Vorgänger verbrauchte die Nummer beim Anlegen. Ein gelöschter
    // Entwurf hinterließ dadurch eine Lücke — und Lücken in einer
    // Rechnungsfolge muss man dem Finanzamt erklären.
    const [entwurf] = await db.insert(documents).values({
      type: 'invoice',
      issueDate: '2026-09-13',
    }).returning()

    expect(entwurf!.documentNumber).toBeNull()
    expect(entwurf!.status).toBe('draft')

    await db.delete(documents).where(eq(documents.id, entwurf!.id))
  })

  it('P-02: die Nummer lässt sich nur innerhalb einer Transaktion ziehen', async () => {
    // Die Nummer und der Beleg müssen gemeinsam wirklich werden. Außerhalb
    // einer Transaktion kann das eine gelingen und das andere scheitern.
    await expect(issueNumber(db, 'invoice')).rejects.toThrow(
      'Die Nummer für "invoice" darf nur innerhalb einer Transaktion gezogen werden.',
    )
  })

  it('P-02: zwei gleichzeitige Transaktionen bekommen verschiedene Nummern', async () => {
    // Der entscheidende Fall. Die eine Transaktion hält die Zeile gesperrt, bis
    // sie festschreibt; die andere wartet. Lesen und danach schreiben — was der
    // Vorgänger tat — gäbe beiden dieselbe Rechnungsnummer.
    const nummern = await Promise.all([
      db.transaction(tx => issueNumber(tx, 'invoice')),
      db.transaction(tx => issueNumber(tx, 'invoice')),
      db.transaction(tx => issueNumber(tx, 'invoice')),
    ])
    expect(new Set(nummern).size).toBe(3)
  })

  it('P-02: eine zurückgerollte Ausstellung gibt die Nummer wieder frei', async () => {
    const vorher = await db.transaction(tx => issueNumber(tx, 'invoice'))

    await expect(db.transaction(async (tx) => {
      await issueNumber(tx, 'invoice')
      throw new Error('Der Beleg konnte nicht geschrieben werden.')
    })).rejects.toThrow()

    const nachher = await db.transaction(tx => issueNumber(tx, 'invoice'))
    expect(Number(nachher)).toBe(Number(vorher) + 1)
  })
})
