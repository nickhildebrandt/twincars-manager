/**
 * The central value lists.
 *
 * B-011: the predecessor kept two label maps that disagreed with each other —
 * `order_confirmation` was "Auftrag" in one and "Auftragsbestätigung" in the
 * other — and a document type without an entry leaked its English value into
 * the interface. B-335, B-411: the columns behind them had no constraint, so a
 * service could write any string at all.
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import * as domain from '#shared/domain'
import {
  documentStatuses,
  documentTypes,
  itemKinds,
  labelOf,
  optionsOf,
  paymentMethods,
  tireSeasons,
} from '#shared/domain'
import type { Domain } from '#shared/domain'
import * as schemas from '#shared/schemas/domain'
import { DEFAULT_NUMBER_RANGES } from '../../server/database/seed/index.ts'

/** Every exported value list, by name. */
const domains = Object.entries(domain).filter(
  (entry): entry is [string, Domain<string>] =>
    typeof entry[1] === 'object' && entry[1] !== null && 'values' in entry[1] && 'labels' in entry[1],
)

describe('jede Werteliste', () => {
  it('ist nicht leer', () => {
    expect(domains.length).toBeGreaterThan(20)
  })

  it.each(domains)('%s hat für jeden Wert eine deutsche Bezeichnung', (_name, list) => {
    for (const value of list.values) {
      expect(list.labels[value], value).toBeTruthy()
    }
  })

  it.each(domains)('%s hat keine doppelten Werte', (_name, list) => {
    expect(new Set(list.values).size).toBe(list.values.length)
  })

  it.each(domains)('%s trägt keine englische Bezeichnung durch', (_name, list) => {
    // Eine Bezeichnung, die genau dem Code entspricht, ist keine Übersetzung —
    // genau so leckte beim Vorgänger „credit_note" in die Oberfläche.
    const untranslated = list.values.filter(
      value => list.labels[value] === value && !/^[A-ZÄÖÜ]/.test(value),
    )
    expect(untranslated).toEqual([])
  })
})

describe('labelOf', () => {
  it('nennt die deutsche Bezeichnung', () => {
    expect(labelOf(documentTypes, 'cost_estimate')).toBe('Kostenvoranschlag')
    expect(labelOf(documentStatuses, 'storno')).toBe('Stornorechnung')
    expect(labelOf(paymentMethods, 'cash')).toBe('Bar')
  })

  it.each([null, undefined, '', 'credit_note', 'irgendwas'])(
    'zeigt für %s einen Gedankenstrich statt des Rohwerts',
    (value) => {
      expect(labelOf(documentTypes, value)).toBe('—')
    },
  )
})

describe('optionsOf', () => {
  it('liefert Wert und Bezeichnung in der erklärten Reihenfolge', () => {
    expect(optionsOf(itemKinds)).toEqual([
      { value: 'article', label: 'Artikel' },
      { value: 'service', label: 'Leistung' },
      { value: 'material', label: 'Material' },
      { value: 'pass_through', label: 'Durchlaufposten' },
    ])
  })
})

describe('die Schemata kommen aus denselben Listen', () => {
  const pairs: [string, v.GenericSchema, Domain<string>][] = [
    ['Belegart', schemas.documentTypeSchema, domain.documentTypes],
    ['Belegstatus', schemas.documentStatusSchema, domain.documentStatuses],
    ['Zahlungsart', schemas.paymentMethodSchema, domain.paymentMethods],
    ['Artikelart', schemas.itemKindSchema, domain.itemKinds],
    ['Saison', schemas.tireSeasonSchema, domain.tireSeasons],
    ['Nummernkreis', schemas.numberKindSchema, domain.numberKinds],
  ]

  it.each(pairs)('%s nimmt jeden erklärten Wert an', (_name, schema, list) => {
    for (const value of list.values) {
      expect(v.safeParse(schema, value).success, value).toBe(true)
    }
  })

  it.each(pairs)('%s lehnt einen unbekannten Wert ab', (_name, schema) => {
    expect(v.safeParse(schema, 'gibtsnicht').success).toBe(false)
  })

  it('erklärt in der Ablehnung, was erlaubt ist — auf Deutsch', () => {
    const result = v.safeParse(schemas.documentTypeSchema, 'credit_note')
    expect(result.success).toBe(false)
    const message = result.issues![0]!.message
    expect(message).toContain('Belegart')
    expect(message).toContain('Rechnung')
    expect(message).toContain('Kostenvoranschlag')
  })
})

describe('die Vokabeln sind vereinheitlicht', () => {
  it('kennt nur eine Schreibweise für die Reifensaison', () => {
    // Der Vorgänger schrieb im Katalog „Sommer" und in der Einlagerung
    // „summer" — dieselbe Sache in zwei Vokabularen (B-011).
    expect(tireSeasons.values).toEqual(['summer', 'winter', 'allseason'])
    expect(tireSeasons.labels.summer).toBe('Sommer')
  })

  it('kennt nur eine Schreibweise für das Ende eines Importlaufs', () => {
    // eBay meldete „success", der Access-Import „completed".
    expect(domain.importRunStatuses.values).toEqual(['running', 'success', 'failed'])
  })

  it('führt Zahlungsarten als Code, nicht als deutsche Beschriftung', () => {
    // Beim Vorgänger stand „Überweisung" als Wert in der Spalte und damit auch
    // in jeder SQL-Abfrage.
    for (const value of paymentMethods.values) {
      expect(value).toMatch(/^[a-z_]+$/)
    }
  })

  it('kennt keine Eskalationsstufen bei der Zahlungserinnerung', () => {
    expect(domain.messageKinds.values).toContain('reminder')
    expect(domain.messageKinds.values).not.toContain('reminder_2')
  })

  it('M-15: es gibt nur Kostenvoranschlag und Rechnung', () => {
    // Das Angebot ist rechtlich verbindlich, der Kostenvoranschlag eine
    // Schätzung mit rund 15 % zulässiger Überschreitung. In der Werkstatt ist
    // immer der Kostenvoranschlag gemeint. Die Auftragsbestätigung schrieb nie
    // jemand.
    expect(documentTypes.values).toEqual(['cost_estimate', 'invoice'])
    expect(domain.numberKinds.values).not.toContain('offer')
    expect(domain.numberKinds.values).not.toContain('order_confirmation')
  })

  it('M-16: es gibt genau zwei Zahlarten, und nur eine geht ins Kassenbuch', () => {
    expect(paymentMethods.values).toEqual(['cash', 'card'])
    expect(domain.CASH_BOOK_METHODS).toEqual(['cash'])
  })

  it('M-34: kein Versandstatus behauptet eine Zustellung', () => {
    // Über den eigenen Postausgang ist nur feststellbar, dass der Server die
    // Mail angenommen hat. Alles andere wäre eine Behauptung.
    expect(domain.messageStatuses.values).toEqual(['wartend', 'angenommen', 'abgelehnt', 'fehler'])
    for (const label of Object.values(domain.messageStatuses.labels)) {
      expect(label.toLowerCase()).not.toContain('zugestellt')
    }
  })

  it('M-25: eine Buchung kommt aus der Anwendung oder von Hand', () => {
    expect(domain.ledgerSources.values).toEqual(['anwendung', 'manuell'])
  })
})

describe('die Nummernkreise stehen an genau einer Stelle', () => {
  it('deckt der Seed jede erklärte Art ab', () => {
    // B-137: beim Vorgänger lagen die Vorgaben in Seed, Dienst und Migration
    // parallel und liefen auseinander.
    const seeded = DEFAULT_NUMBER_RANGES.map(range => range.kind).sort()
    expect(seeded).toEqual([...domain.numberKinds.values].sort())
  })
})

describe('Regression', () => {
  it('B-011: es gibt genau eine Quelle für Beschriftungen', () => {
    // Der Vorgänger hatte zwei Karten, die sich widersprachen: die Suche nannte
    // dieselbe Belegart anders als die Statusliste. `credit_note` fehlte in der
    // Statusliste ganz und leckte als englischer Rohwert in die Oberfläche. Die
    // Reifensaison hatte sogar eine dritte, eigene Karte in der Suche.
    expect(labelOf(documentTypes, 'cost_estimate')).toBe('Kostenvoranschlag')
    expect(labelOf(domain.messageKinds, 'cost_estimate')).toBe('Kostenvoranschlag')

    // Ein unbekannter Wert erreicht die Oberfläche nie als Rohwert.
    expect(labelOf(documentTypes, 'credit_note')).toBe('—')

    // Und die Artikelarten, die der Vorgänger in der Suche pauschal „Artikel"
    // nannte, sind jetzt benannt.
    expect(labelOf(domain.itemLineKinds, 'material')).toBe('Material')
    expect(labelOf(domain.itemLineKinds, 'pass_through')).toBe('Durchlaufposten')
    expect(labelOf(domain.itemLineKinds, 'vehicle')).toBe('Fahrzeug')

    // Eine Saison, eine Schreibweise, eine Beschriftung.
    expect(labelOf(tireSeasons, 'summer')).toBe('Sommer')
  })
})
