/**
 * Integration tests for `seedDefaults` — focused on the work-order
 * additions: the `work_order` number range, the idempotent
 * "Arbeitszeit" labor item + `company_settings.labor_item_id` link,
 * and the `orders` permission on the seeded roles.
 *
 * @group integration
 * @module seed-defaults
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { eq } from 'drizzle-orm'
import { db } from './client'
import {
  companySettings,
  itemPriceVersions,
  items,
  numberRanges,
  rolePermissions,
  roles
} from './schema'
import { seedDefaults, seedLaborItem } from './seed-defaults'

const permissionsOf = async (roleName: string): Promise<string[]> => {
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1)
  if (!role) return []
  const rows = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, role.id))
  return rows.map((r) => r.permission)
}

describe('seedDefaults (work-order additions)', () => {
  beforeEach(async () => {
    await db.delete(itemPriceVersions)
    await db.delete(rolePermissions)
    await db.delete(roles)
    await db.delete(numberRanges)
    await db.delete(items)
    await db.delete(companySettings)
  })

  it('seeds the work_order number range with the AU template', async () => {
    await seedDefaults()
    const [range] = await db
      .select()
      .from(numberRanges)
      .where(eq(numberRanges.kind, 'work_order'))
    expect(range?.formatTemplate).toBe('AU-{YYYY}-{NNNN}')
    expect(range?.nextValue).toBe(1)
  })

  it('creates the Arbeitszeit item with a zero price and links it in settings', async () => {
    await seedDefaults()
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.articleNumber, 'ARBEIT'))
    expect(item?.description).toBe('Arbeitszeit')
    expect(item?.kind).toBe('service')
    expect(item?.unit).toBe('Std.')

    const versions = await db
      .select()
      .from(itemPriceVersions)
      .where(eq(itemPriceVersions.itemId, item.id))
    expect(versions).toHaveLength(1)
    expect(Number(versions[0].unitPriceNet)).toBe(0)

    const [settings] = await db.select().from(companySettings).limit(1)
    expect(settings?.laborItemId).toBe(item.id)
  })

  it('is idempotent — a second run neither duplicates the item nor rewrites the price', async () => {
    await seedDefaults()
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.articleNumber, 'ARBEIT'))
    // Operator raised the rate in the meantime.
    await db
      .insert(itemPriceVersions)
      .values({ itemId: item.id, validFrom: '2099-01-01', unitPriceNet: '80' })

    await seedDefaults()
    const laborItems = await db
      .select()
      .from(items)
      .where(eq(items.articleNumber, 'ARBEIT'))
    expect(laborItems).toHaveLength(1)
    const versions = await db
      .select()
      .from(itemPriceVersions)
      .where(eq(itemPriceVersions.itemId, item.id))
    expect(versions).toHaveLength(2)
  })

  it('does not relink labor_item_id once it is set', async () => {
    await seedDefaults()
    const [settings] = await db.select().from(companySettings).limit(1)
    const [other] = await db
      .insert(items)
      .values({
        articleNumber: 'ARBEIT-2',
        description: 'Eigene Arbeitszeit',
        kind: 'service'
      })
      .returning()
    await db
      .update(companySettings)
      .set({ laborItemId: other.id })
      .where(eq(companySettings.id, settings.id))

    await seedLaborItem()
    const [after] = await db.select().from(companySettings).limit(1)
    expect(after.laborItemId).toBe(other.id)
  })

  it('grants orders to Mitarbeiter and (via flatMap) Werkstattleiter', async () => {
    await seedDefaults()
    expect(await permissionsOf('Mitarbeiter')).toContain('orders')
    expect(await permissionsOf('Werkstattleiter')).toContain('orders')
    expect(await permissionsOf('Administrator')).toContain('*')
  })
})
