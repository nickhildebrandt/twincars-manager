/**
 * Die Modelländerungen aus der Durchsicht am 13.09.2026.
 *
 * Der Betriebsinhaber ist die fertige Entitätsübersicht durchgegangen und hat
 * festgelegt, was am Modell anders sein muss. Jede Kennung aus
 * [09-modellaenderungen.md](../../../docs/rewrite/09-modellaenderungen.md)
 * braucht einen Nachweis; `pnpm test:modell` besteht darauf.
 *
 * Hier stehen die, die sich an der Datenbank zeigen. Die übrigen liegen bei
 * dem Paket, das sie umsetzt.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { testDatabaseOptions } from '../setup/db-per-worker'
import { DEFAULT_NUMBER_RANGES } from '../../server/database/seed/index.ts'

const sql = postgres(testDatabaseOptions())
afterAll(() => sql.end({ timeout: 5 }))

/** Die Löschregel einer Beziehung, in Worten. */
async function ruleOf(table: string, column: string): Promise<string | undefined> {
  const rows = await sql<{ rule: string }[]>`
    SELECT c.confdeltype::text AS rule
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.conrelid = ${table}::regclass AND a.attname = ${column}
  `
  return { a: 'sperrt', r: 'sperrt sofort', c: 'geht mit', n: 'Verweis entfällt' }[rows[0]?.rule ?? '']
}

const columnsOf = async (table: string) => {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name
  `
  return rows.map(row => row.column_name)
}

const tableExists = async (table: string) => {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
  `
  return rows.length > 0
}

beforeEach(async () => {
  // In Abhängigkeitsrichtung: der Radsatz sperrt das Fahrzeug (M-05, P-12),
  // das Fahrzeug sperrt den Kunden (M-05). Wer von hinten aufräumt, räumt gar
  // nicht auf.
  await sql`DELETE FROM audit_log`
  await sql`DELETE FROM wheel_sets`
  await sql`DELETE FROM vehicles`
  await sql`DELETE FROM customers`
})

describe('Übergreifend', () => {
  it('M-01: es gibt ein Ereignisprotokoll und keine weiteren Versionstabellen', async () => {
    // Das Protokoll beantwortet „wer hat was geändert" — Vergangenheit, Beweis.
    // Eine Version beantwortet „was gilt ab wann" — auch Zukunft, fachliche
    // Wahrheit. Preise werden bei jeder Belegposition abgefragt; sie aus einem
    // Änderungsprotokoll rückwärts zu rekonstruieren wäre die falsche Antwort.
    expect(await tableExists('audit_log')).toBe(true)

    const versionTables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%\\_versions'
      ORDER BY table_name
    `
    expect(versionTables.map(row => row.table_name)).toEqual([
      'employee_salary_versions',
      'item_price_versions',
      'tire_price_versions',
      'vehicle_license_plate_versions',
    ])
  })

  it('M-01: ein Protokolleintrag nennt Zeitpunkt, Person, Datensatz und Felder', async () => {
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (id, name, email) VALUES ('u-protokoll', 'Anna Chefin', 'a@twincars.local')
      RETURNING id
    `
    await sql`
      INSERT INTO audit_log (user_id, user_name, entity, entity_id, action, changes)
      VALUES (${user!.id}, 'Anna Chefin', 'customers', 'c-1', 'geaendert',
              ${sql.json([{ field: 'city', before: 'Ulm', after: 'Neu-Ulm' }])})
    `

    const [entry] = await sql<{ at: string, user_name: string, changes: unknown[] }[]>`
      SELECT at, user_name, changes FROM audit_log WHERE entity_id = 'c-1'
    `
    expect(entry!.at).toBeTruthy()
    expect(entry!.user_name).toBe('Anna Chefin')
    expect(entry!.changes).toEqual([{ field: 'city', before: 'Ulm', after: 'Neu-Ulm' }])

    await sql`DELETE FROM users WHERE id = 'u-protokoll'`
  })

  it('M-01: das Protokoll überlebt den gelöschten Benutzer', async () => {
    // Ginge der Eintrag mit dem Konto, verschwände mit einem ausgeschiedenen
    // Mitarbeiter die Spur seiner Änderungen. Deshalb kein Fremdschlüssel —
    // der Name steht als Kopie im Eintrag.
    await sql`INSERT INTO users (id, name, email) VALUES ('u-weg', 'Weg', 'w@twincars.local')`
    await sql`
      INSERT INTO audit_log (user_id, user_name, entity, entity_id, action)
      VALUES ('u-weg', 'Weg', 'customers', 'c-2', 'angelegt')
    `

    await sql`DELETE FROM users WHERE id = 'u-weg'`

    const [entry] = await sql<{ user_name: string }[]>`
      SELECT user_name FROM audit_log WHERE entity_id = 'c-2'
    `
    expect(entry?.user_name).toBe('Weg')
  })
})

describe('Kunden & Fahrzeuge', () => {
  it('M-05: das Fahrzeug kennt seinen Zustand im Betrieb', async () => {
    const [vehicle] = await sql<{ status: string }[]>`
      INSERT INTO vehicles (make, model) VALUES ('VW', 'Golf') RETURNING status
    `
    expect(vehicle!.status).toBe('kundenfahrzeug')

    await expect(sql`
      INSERT INTO vehicles (make, model, status) VALUES ('VW', 'Golf', 'irgendwas')
    `).rejects.toThrow()

    for (const status of ['kundenfahrzeug', 'bestand', 'verkauft']) {
      await sql`INSERT INTO vehicles (make, model, status) VALUES ('VW', 'Golf', ${status})`
    }
  })

  it('M-06: es gibt eine Halter-Historie neben der Kennzeichenhistorie', async () => {
    expect(await tableExists('vehicle_owner_history')).toBe(true)
    expect(await columnsOf('vehicle_owner_history')).toEqual(expect.arrayContaining([
      'vehicle_id', 'customer_id', 'customer_name', 'owner_from', 'owner_until',
    ]))
  })

  it('M-06: ein Eintrag behält den Namen des damaligen Halters', async () => {
    // Wird der Kunde später gelöscht, steht immer noch im Fahrzeug, wem es
    // gehörte. Ein leerer Zeitstrahl wäre eine verlorene Auskunft.
    const [customer] = await sql<{ id: string }[]>`
      INSERT INTO customers (customer_number, last_name) VALUES ('M06-1', 'Vorbesitzer')
      RETURNING id
    `
    const [vehicle] = await sql<{ id: string }[]>`
      INSERT INTO vehicles (make, model, status) VALUES ('VW', 'Golf', 'bestand') RETURNING id
    `
    await sql`
      INSERT INTO vehicle_owner_history (vehicle_id, customer_id, customer_name, owner_from)
      VALUES (${vehicle!.id}, ${customer!.id}, 'Vorbesitzer', '2019-04-01')
    `

    await sql`DELETE FROM customers WHERE id = ${customer!.id}`

    const [entry] = await sql<{ customer_name: string, customer_id: string | null }[]>`
      SELECT customer_name, customer_id FROM vehicle_owner_history
      WHERE vehicle_id = ${vehicle!.id}
    `
    expect(entry?.customer_name).toBe('Vorbesitzer')
    expect(entry?.customer_id).toBeNull()
  })
})

describe('Werkstatt & Aufträge', () => {
  it('M-08: es gibt nur eine Richtung zwischen Auftrag und Beleg', async () => {
    // Zwei Verweise für dieselbe Verbindung können auseinanderlaufen. Der
    // Beleg zeigt auf den Auftrag; der Auftrag hat keine Rechnungsspalte mehr.
    expect(await columnsOf('work_orders')).not.toContain('invoice_id')
    expect(await columnsOf('documents')).toContain('work_order_id')
    expect(await ruleOf('documents', 'work_order_id')).toBe('sperrt')
  })

  it('M-11: mehrere Mitarbeiter können an einer Position arbeiten', async () => {
    expect(await tableExists('work_order_item_assignees')).toBe(true)
    expect(await tableExists('work_order_assignees')).toBe(false)
    // Der sperrende Einzelverweis ist weg: eine Position gehört nicht genau
    // einem Mitarbeiter.
    expect(await columnsOf('work_order_items')).not.toContain('employee_id')
  })

  it('M-11: die Zuweisung hängt an der Position, nicht am Auftrag', async () => {
    const keys = await sql<{ column_name: string }[]>`
      SELECT a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'p' AND c.conrelid = 'work_order_item_assignees'::regclass
      ORDER BY a.attname
    `
    expect(keys.map(row => row.column_name)).toEqual(['employee_id', 'work_order_item_id'])
  })
})

describe('Reifen', () => {
  it('M-17: der Radsatz gehört zum Fahrzeug, nicht zum Kunden', async () => {
    expect(await tableExists('wheel_sets')).toBe(true)
    expect(await tableExists('tire_storage')).toBe(false)

    const columns = await columnsOf('wheel_sets')
    expect(columns).toContain('vehicle_id')
    expect(columns).not.toContain('customer_id')
    expect(columns).toEqual(expect.arrayContaining(['state', 'storage_place', 'profile_mm']))
  })

  it('M-17: ein Radsatz ist entweder montiert oder eingelagert', async () => {
    const [vehicle] = await sql<{ id: string }[]>`
      INSERT INTO vehicles (make, model) VALUES ('VW', 'Golf') RETURNING id
    `
    await sql`
      INSERT INTO wheel_sets (set_number, vehicle_id, state, season)
      VALUES ('RS-1', ${vehicle!.id}, 'montiert', 'summer')
    `
    await expect(sql`
      INSERT INTO wheel_sets (set_number, vehicle_id, state)
      VALUES ('RS-2', ${vehicle!.id}, 'irgendwo')
    `).rejects.toThrow()
  })

  it('M-19: die Wechsel-Erinnerung hängt am Radsatz, nicht am Kunden', async () => {
    // Am Kunden war unklar, welches Fahrzeug gemeint ist, wenn jemand zwei hat.
    const columns = await columnsOf('tire_reminder_log')
    expect(columns).toContain('wheel_set_id')
    expect(columns).not.toContain('customer_id')
    expect(await ruleOf('tire_reminder_log', 'wheel_set_id')).toBe('geht mit')
  })
})

describe('Stammdaten', () => {
  it('M-22: die Firmeneinstellung kennt vier Standardartikel', async () => {
    // Fest verdrahtet müsste bei jeder Preisänderung der Entwickler ran.
    const columns = await columnsOf('company_settings')
    expect(columns).toEqual(expect.arrayContaining([
      'labor_item_id',
      'tire_change_item_id',
      'wheel_balance_item_id',
      'tire_storage_item_id',
    ]))
  })

  it('M-22: ein Standardartikel lässt sich nicht unter der Einstellung wegziehen', async () => {
    for (const column of ['labor_item_id', 'tire_change_item_id', 'wheel_balance_item_id', 'tire_storage_item_id']) {
      expect(await ruleOf('company_settings', column), column).toBe('sperrt')
    }
  })
})

describe('Belege', () => {
  it('M-29: ein importierter Beleg behält seine Originalnummer', async () => {
    // Importierte Belege laufen nicht in den neuen Zähler. Sonst kollidierten
    // acht bis zehn Jahre Altbestand mit der ersten neuen Rechnung.
    const columns = await columnsOf('documents')
    expect(columns).toContain('legacy_document_number')
    expect(columns).toContain('imported')

    await sql`
      INSERT INTO documents (type, issue_date, legacy_document_number, imported)
      VALUES ('invoice', '2018-06-04', 'R-2018-0421', true)
    `
    const [row] = await sql<{ document_number: string | null, imported: boolean }[]>`
      SELECT document_number, imported FROM documents WHERE legacy_document_number = 'R-2018-0421'
    `
    // Er trägt keine neue Nummer — die alte ist die Nummer.
    expect(row?.document_number).toBeNull()
    expect(row?.imported).toBe(true)

    await sql`DELETE FROM documents WHERE legacy_document_number = 'R-2018-0421'`
  })

  it('M-29: der neue Zähler kennt Angebot und Auftragsbestätigung nicht mehr', async () => {
    const kinds = DEFAULT_NUMBER_RANGES.map(range => range.kind)
    expect(kinds).not.toContain('offer')
    expect(kinds).not.toContain('order_confirmation')
    expect(kinds).toContain('cost_estimate')
    expect(kinds).toContain('invoice')

    // Und die Datenbank nimmt genau diese an.
    await sql`DELETE FROM number_ranges`
    for (const range of DEFAULT_NUMBER_RANGES) {
      await sql`
        INSERT INTO number_ranges (kind, format_template)
        VALUES (${range.kind}, ${range.formatTemplate})
      `
    }
    await expect(sql`
      INSERT INTO number_ranges (kind, format_template) VALUES ('offer', '{N}')
    `).rejects.toThrow()
  })
})
