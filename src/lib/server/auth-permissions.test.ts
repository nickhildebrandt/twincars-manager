import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  ALL_PERMISSIONS,
  MODULE_PERMISSIONS,
  WILDCARD_PERMISSION,
  hasPermission,
  loadUserPermissions
} from './auth-permissions'
import { db } from './db/client'
import { rolePermissions, roles, userRoles, users } from './db/schema'
import { randomUUID } from 'node:crypto'

/**
 * Unit + integration tests for the RBAC helpers.
 *
 * @group integration
 * @module auth-permissions
 */
describe('auth-permissions', () => {
  describe('hasPermission', () => {
    it('returns true when the set contains the exact key', () => {
      expect(hasPermission(new Set(['customers']), 'customers')).toBe(true)
    })

    it('returns false for an unrelated key', () => {
      expect(hasPermission(new Set(['customers']), 'vehicles')).toBe(false)
    })

    it('returns true when the set contains the wildcard, regardless of key', () => {
      expect(
        hasPermission(new Set([WILDCARD_PERMISSION]), 'anything:any')
      ).toBe(true)
    })

    it('returns false for an empty set', () => {
      expect(hasPermission(new Set(), 'customers')).toBe(false)
    })
  })

  describe('ALL_PERMISSIONS', () => {
    it('contains every key listed under MODULE_PERMISSIONS', () => {
      const expected = Object.values(MODULE_PERMISSIONS).flat()
      expect(new Set(ALL_PERMISSIONS)).toEqual(new Set(expected))
    })

    it('includes the canonical hours:write_own self-logging key', () => {
      expect(ALL_PERMISSIONS).toContain('hours:write_own')
    })

    it('includes admin-level keys for settings + users', () => {
      expect(ALL_PERMISSIONS).toContain('settings')
      expect(ALL_PERMISSIONS).toContain('users')
    })
  })

  describe('loadUserPermissions', () => {
    beforeEach(async () => {
      await db.delete(userRoles)
      await db.delete(rolePermissions)
      await db.delete(roles)
      await db.delete(users)
    })

    const seedUser = async () => {
      const id = `u_${randomUUID()}`
      await db
        .insert(users)
        .values({
          id,
          name: 'Test User',
          email: `${id}@example.com`,
          username: id
        })
      return id
    }

    const seedRole = async (name: string, perms: string[]) => {
      const [row] = await db.insert(roles).values({ name }).returning()
      for (const permission of perms) {
        await db.insert(rolePermissions).values({ roleId: row.id, permission })
      }
      return row.id
    }

    it('returns an empty set for an unknown user', async () => {
      const perms = await loadUserPermissions(`u_${randomUUID()}`)
      expect(perms.size).toBe(0)
    })

    it('returns an empty set for a user without roles', async () => {
      const userId = await seedUser()
      const perms = await loadUserPermissions(userId)
      expect(perms.size).toBe(0)
    })

    it('returns the permissions of the assigned role', async () => {
      const userId = await seedUser()
      const roleId = await seedRole('Sachbearbeiter', ['customers', 'vehicles'])
      await db.insert(userRoles).values({ userId, roleId })
      const perms = await loadUserPermissions(userId)
      expect(perms.has('customers')).toBe(true)
      expect(perms.has('vehicles')).toBe(true)
      expect(perms.has('suppliers')).toBe(false)
    })

    it('merges permissions across multiple roles', async () => {
      const userId = await seedUser()
      const readerId = await seedRole('Reader', ['customers'])
      const writerId = await seedRole('Writer', ['vehicles'])
      await db.insert(userRoles).values([
        { userId, roleId: readerId },
        { userId, roleId: writerId }
      ])
      const perms = await loadUserPermissions(userId)
      expect(perms.has('customers')).toBe(true)
      expect(perms.has('vehicles')).toBe(true)
    })

    it('includes the wildcard when granted', async () => {
      const userId = await seedUser()
      const adminId = await seedRole('Administrator', [WILDCARD_PERMISSION])
      await db.insert(userRoles).values({ userId, roleId: adminId })
      const perms = await loadUserPermissions(userId)
      expect(perms.has(WILDCARD_PERMISSION)).toBe(true)
      expect(hasPermission(perms, 'anything:goes')).toBe(true)
    })
  })
})
