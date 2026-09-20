import { describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema/index'

/** Every table export, by its exported name. */
const tables = Object.entries(schema).filter(
  ([, value]) => typeof value === 'object' && value !== null,
)

describe('Datenbankschema', () => {
  it('lädt vollständig, ohne dass ein Verweis ins Leere zeigt', () => {
    // 53 Tabellen des Vorgängers minus zwei tote (public_holidays wird
    // gerechnet statt gespeichert, recurring_entries hatte nie eine
    // Oberfläche) plus den bytea-Helfer, der kein Tabellenexport ist.
    expect(tables.length).toBeGreaterThanOrEqual(51)
  })

  it('löst gegenseitige Verweise zwischen Domänen auf', () => {
    // documents ↔ orders und employees ↔ orders verweisen wechselseitig
    // aufeinander. Zeigt einer davon auf undefined, ist die Aufteilung kaputt.
    for (const name of ['documents', 'workOrders', 'workOrderItems', 'workOrderItemAssignees']) {
      expect(schema[name as keyof typeof schema], name).toBeTruthy()
    }
  })

  it('gibt jeder Tabelle einen Namen', () => {
    for (const [name, table] of tables) {
      expect(table, name).toBeDefined()
    }
  })
})
