/**
 * Wie ein Datensatz in einer Auswahl heißt.
 *
 * B-087: der Vorgänger versprach eine einzige Quelle und baute die
 * Beschriftungen trotzdem an sechs Stellen im Servercode zusammen. Die Liste
 * zeigte dann einen Namen, die Selbstauswahl nach dem Anlegen suchte einen
 * anderen.
 */
import { describe, expect, it } from 'vitest'
import {
  customerLabel,
  customerSublabel,
  documentLabel,
  documentSublabel,
  employeeLabel,
  employeeSublabel,
  itemLabel,
  itemSublabel,
  supplierLabel,
  supplierSublabel,
  tireLabel,
  tireSublabel,
  vehicleLabel,
  vehicleSublabel,
} from '#shared/picker-labels'

describe('Kunde', () => {
  it('nennt eine Firma bei ihrem Namen', () => {
    expect(customerLabel({ company: 'Meier GmbH', lastName: 'Meier' })).toBe('Meier GmbH')
  })

  it('nennt eine Person mit Nachname zuerst', () => {
    // Gesucht wird nach dem Nachnamen, also steht er vorn.
    expect(customerLabel({ lastName: 'Müller', firstName: 'Anna' })).toBe('Müller, Anna')
  })

  it('fällt auf die Kundennummer zurück', () => {
    expect(customerLabel({ customerNumber: 'K-0815' })).toBe('K-0815')
  })

  it('lässt niemanden ohne Beschriftung', () => {
    expect(customerLabel({})).toBe('Ohne Namen')
  })

  it('lässt weg, was fehlt, statt Trennzeichen zu häufen', () => {
    expect(customerSublabel({ customerNumber: 'K-1', city: 'Ulm' })).toBe('K-1 · Ulm')
    expect(customerSublabel({ customerNumber: 'K-1' })).toBe('K-1')
    expect(customerSublabel({})).toBe('')
  })

  it('behandelt Leerzeichen wie nichts', () => {
    expect(customerLabel({ company: '   ', lastName: 'Müller' })).toBe('Müller')
  })
})

describe('Fahrzeug', () => {
  it('nennt Marke und Modell', () => {
    expect(vehicleLabel({ make: 'VW', model: 'Golf' })).toBe('VW Golf')
  })

  it('zeigt Kennzeichen und Fahrgestellnummer darunter', () => {
    expect(vehicleSublabel({ licensePlate: 'UL-AB 123', vin: 'WVW...' }))
      .toBe('UL-AB 123 · WVW...')
  })
})

describe('Artikel und Reifen', () => {
  it('nennt den Artikel bei seiner Bezeichnung', () => {
    expect(itemLabel({ description: 'Ölwechsel' })).toBe('Ölwechsel')
    expect(itemSublabel({ articleNumber: 'A-12', unit: 'Std.' })).toBe('A-12 · Std.')
  })

  it('nennt den Reifen mit Marke, Modell, Größe und Saison', () => {
    expect(tireLabel({ brand: 'Continental', model: 'WinterContact' }))
      .toBe('Continental WinterContact')
    expect(tireSublabel({ size: '205/55 R16', seasonLabel: 'Winter' }))
      .toBe('205/55 R16 · Winter')
  })
})

describe('Mitarbeiter und Lieferant', () => {
  it('nennt den Mitarbeiter mit Nachname zuerst', () => {
    expect(employeeLabel({ lastName: 'Schmidt', firstName: 'Jan' })).toBe('Schmidt, Jan')
    expect(employeeSublabel({ personnelNumber: 'P-7', jobTitle: 'Kfz-Meister' }))
      .toBe('P-7 · Kfz-Meister')
  })

  it('nennt den Lieferanten bei seinem Namen', () => {
    expect(supplierLabel({ name: 'Knoll' })).toBe('Knoll')
    expect(supplierSublabel({ city: 'Ulm', customerNumberAtSupplier: '4711' }))
      .toBe('Ulm · 4711')
  })
})

describe('Beleg', () => {
  it('nennt Art und Nummer', () => {
    expect(documentLabel({ typeLabel: 'Rechnung', documentNumber: '2026-0042' }))
      .toBe('Rechnung 2026-0042')
  })

  it('M-14: nennt einen Entwurf einen Entwurf, statt eine Lücke zu zeigen', () => {
    // Ein Entwurf trägt noch keine Nummer — sie wird erst beim Ausstellen
    // gezogen. „Rechnung " mit leerer Stelle wäre eine schlechte Auskunft.
    expect(documentLabel({ typeLabel: 'Rechnung', documentNumber: null }))
      .toBe('Rechnung Entwurf')
  })

  it('zeigt Datum, Kunde und Betrag darunter', () => {
    expect(documentSublabel({
      issueDate: '04.03.2026',
      customerLabel: 'Meier GmbH',
      totalLabel: '1.234,56 €',
    })).toBe('04.03.2026 · Meier GmbH · 1.234,56 €')
  })
})

describe('Eine einzige Quelle für die Beschriftungen', () => {
  // Beim Vorgänger standen die Formate für Mitarbeiter, Lieferanten, Belege,
  // Artikel und Reifen **im Servercode**, obwohl diese Datei in ihrer Doku
  // „single source of truth" versprach. Die Liste zeigte damit einen Namen,
  // und die Selbstauswahl nach dem Anlegen suchte einen anderen.

  it('B-087: führt für jede Art einen Bauer, für beide Zeilen', async () => {
    const labels = await import('#shared/picker-labels')
    for (const entity of [
      'customer',
      'vehicle',
      'item',
      'tire',
      'employee',
      'supplier',
      'document',
    ]) {
      expect(labels, `${entity}Label`).toHaveProperty(`${entity}Label`)
      expect(labels, `${entity}Sublabel`).toHaveProperty(`${entity}Sublabel`)
    }
  })

  it('B-087: der Dienst baut keine Beschriftung selbst', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      fileURLToPath(new URL('../../server/services/picker-service.ts', import.meta.url)),
      'utf8',
    )

    // Der Dienst ruft die Bauer auf — er setzt keine Zeichenketten zusammen.
    expect(source).toContain('from \'#shared/picker-labels\'')
    for (const line of source.split('\n')) {
      if (!/^\s+label:/.test(line)) continue
      expect(line, line.trim()).toMatch(/Label\(/)
    }
  })
})
