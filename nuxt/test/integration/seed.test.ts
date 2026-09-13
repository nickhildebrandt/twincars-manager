/**
 * The default content the application needs to be usable.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../../server/database/schema/index.ts'
import {
  DEFAULT_LEDGER_CATEGORIES,
  DEFAULT_NUMBER_RANGES,
  LABOUR_ARTICLE_NUMBER,
  seedDefaults,
} from '../../server/database/seed/index.ts'
import { DEFAULT_MAIL_TEMPLATES } from '../../server/database/seed/mail-templates.ts'
import { testDatabaseOptions } from '../setup/db-per-worker'

const sql = postgres(testDatabaseOptions())
const db = drizzle(sql, { schema, casing: 'snake_case' })

let first: Record<string, number>
let second: Record<string, number>

beforeAll(async () => {
  first = await seedDefaults(db)
  second = await seedDefaults(db)
}, 60_000)

describe('Vorgaben anlegen', () => {
  it('legt beim ersten Lauf alles an', () => {
    expect(first.roles).toBe(3)
    expect(first.mailTemplates).toBe(DEFAULT_MAIL_TEMPLATES.length)
    expect(first.ledgerCategories).toBe(DEFAULT_LEDGER_CATEGORIES.length)
    expect(first.numberRanges).toBe(DEFAULT_NUMBER_RANGES.length)
    expect(first.workshopHours).toBe(7)
  })

  it('legt beim zweiten Lauf nichts noch einmal an', () => {
    for (const [name, count] of Object.entries(second)) {
      expect(count, name).toBe(0)
    }
  })

  it('kennt die drei Rollen mit ihren Rechten', async () => {
    const rows = await db.select().from(schema.roles)
    expect(rows.map(r => r.name).sort()).toEqual([
      'Administrator', 'Mitarbeiter', 'Werkstattleiter',
    ])

    const admin = rows.find(r => r.name === 'Administrator')!
    const adminPermissions = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, admin.id))
    expect(adminPermissions.map(p => p.permission)).toEqual(['*'])
  })

  it('gibt dem Werkstattleiter alles außer Einstellungen und Benutzern', async () => {
    const [role] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.name, 'Werkstattleiter'))
    const permissions = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, role!.id))
    const keys = permissions.map(p => p.permission)
    expect(keys).not.toContain('settings')
    expect(keys).not.toContain('users')
    expect(keys).toContain('invoices')
  })

  it('gibt dem Mitarbeiter Stunden nur für sich selbst', async () => {
    const [role] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.name, 'Mitarbeiter'))
    const permissions = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, role!.id))
    const keys = permissions.map(p => p.permission)
    expect(keys).toContain('hours:write_own')
    expect(keys).not.toContain('hours')
  })

  it('legt die acht Mailvorlagen mit deutschem Text an', async () => {
    const rows = await db.select().from(schema.mailTemplates)
    expect(rows).toHaveLength(8)
    for (const row of rows) {
      expect(row.subject.length, row.key).toBeGreaterThan(0)
      expect(row.body, row.key).toMatch(/Grüßen|Grüße/)
    }
  })

  it('legt die Nummernkreise mit ihren Formaten an', async () => {
    const rows = await db.select().from(schema.numberRanges)
    const byKind = new Map(rows.map(r => [r.kind, r.formatTemplate]))
    // Belegnummern sind reine Zähler, damit die Reihe des Vorgängersystems
    // ohne Lücke weiterläuft.
    expect(byKind.get('invoice')).toBe('{N}')
    expect(byKind.get('customer')).toBe('{N}')
    // Neue Bereiche starten bei 1 mit Jahresangabe.
    expect(byKind.get('tire_storage')).toBe('L-{YYYY}-{NNNN}')
    expect(byKind.get('storno')).toBe('S-{N}')
    for (const row of rows) expect(row.nextValue, row.kind).toBe(1)
  })

  it('öffnet werktags und schließt am Wochenende', async () => {
    const rows = await db.select().from(schema.workshopHours)
    expect(rows).toHaveLength(7)
    const closed = rows.filter(r => r.closed).map(r => r.weekday).sort()
    expect(closed).toEqual([0, 6])
  })

  it('legt den Arbeitszeit-Artikel an und verknüpft ihn mit den Einstellungen', async () => {
    const [item] = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.articleNumber, LABOUR_ARTICLE_NUMBER))
    expect(item?.kind).toBe('service')
    expect(item?.unit).toBe('Std.')

    const [settings] = await db.select().from(schema.companySettings)
    expect(settings?.laborItemId).toBe(item!.id)
  })

  it('gibt dem Arbeitszeit-Artikel einen Startpreis', async () => {
    const [item] = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.articleNumber, LABOUR_ARTICLE_NUMBER))
    const versions = await db
      .select()
      .from(schema.itemPriceVersions)
      .where(eq(schema.itemPriceVersions.itemId, item!.id))
    expect(versions).toHaveLength(1)
    expect(Number(versions[0]!.unitPriceNet)).toBe(0)
  })

  it('trennt Einnahmen- und Ausgabenkategorien', async () => {
    const rows = await db.select().from(schema.ledgerCategories)
    expect(rows.filter(r => r.direction === 'income').length).toBeGreaterThan(0)
    expect(rows.filter(r => r.direction === 'expense').length).toBeGreaterThan(0)
  })
})
