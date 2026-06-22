// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

/**
 * Security-focused integration tests for the user + role management
 * remote layer.
 *
 * Exercises every guard branch (anonymous, missing permission, last
 * admin, Administrator role) plus the happy paths against a fresh
 * pg-mem database. `$app/server` is replaced with passthrough
 * `query`/`command` wrappers and a controllable `getRequestEvent()`;
 * `$lib/server/auth` is faked so `auth.api.signUpEmail` performs a
 * plain INSERT against the test db rather than going through the real
 * better-auth machinery.
 *
 * @group integration
 * @module users
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string } | null,
    session: null as unknown,
    permissions: new Set<string>()
  }
}

vi.mock('$app/server', async () => {
  const valibot = await import('valibot')
  type Fn = (input?: unknown) => Promise<unknown>
  type Schema = Parameters<typeof valibot.parse>[0]

  const validate = (schema: Schema | undefined, input: unknown) => {
    if (!schema) return input
    return valibot.parse(schema, input)
  }

  // A query call should return a Promise-like that ALSO carries a
  // `.refresh()` method — production code uses both
  // `await listFoo({...})` and `await listFoo({...}).refresh()`.
  const callQuery = (schema: Schema | undefined, impl: Fn, input?: unknown) => {
    const promise = (async () => impl(validate(schema, input)))()
    return Object.assign(promise, { refresh: () => Promise.resolve() })
  }
  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) => callQuery(schema, impl, input)
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  const makeCommand = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, { __: { type: 'command' as const } })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      // `query` is overloaded: `query(fn)` or `query(schema, fn)`.
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schema: unknown, fn: Fn) => makeCommand(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

// Short-circuit the Vite plugin's auto-injected post-amble. The real
// `init_remote_functions` walks every export and re-tags `fn.__.id`;
// pulling it in transitively loads SvelteKit client paths that need
// bundler-defined globals like `__SVELTEKIT_PATHS_BASE__` which Vitest
// never defines.
vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

vi.mock('$lib/server/auth', async () => {
  const { db } = await import('$lib/server/db/client')
  const { users, accounts } = await import('$lib/server/db/schema')
  return {
    auth: {
      api: {
        signUpEmail: async ({
          body
        }: {
          body: {
            email: string
            password: string
            name: string
            username: string
          }
        }) => {
          const id = `u_${randomUUID()}`
          await db
            .insert(users)
            .values({
              id,
              name: body.name,
              email: body.email,
              username: body.username,
              displayUsername: body.username
            })
          // Stand-in credential row so password updates have something
          // to update; matches the shape better-auth would create.
          await db
            .insert(accounts)
            .values({
              id: `a_${randomUUID()}`,
              userId: id,
              accountId: id,
              providerId: 'credential',
              password: `hashed:${body.password}`
            })
          return { user: { id, name: body.name, email: body.email } }
        }
      },
      $context: Promise.resolve({
        password: { hash: async (plain: string) => `hashed:${plain}` }
      })
    }
  }
})

// Helper: SvelteKit's `error()` throws an `HttpError` instance whose
// message lives on `err.body.message`, not on `err.message`. `toThrow`
// matches against `err.message`, so we expose a helper that asserts
// against the curated body the user would actually see.
async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number,
  messageMatch?: RegExp | string
): Promise<void> {
  let caught: unknown = null
  try {
    await fn()
  } catch (err) {
    caught = err
  }
  if (caught === null) {
    throw new Error('expected the call to throw, but it resolved')
  }
  const err = caught as { status?: number; body?: { message?: string } }
  expect(err.status).toBe(status)
  if (messageMatch) {
    const msg = err.body?.message ?? ''
    if (messageMatch instanceof RegExp) {
      expect(msg).toMatch(messageMatch)
    } else {
      expect(msg).toContain(messageMatch)
    }
  }
}

import { db } from '$lib/server/db/client'
import {
  accounts,
  rolePermissions,
  roles,
  sessions,
  userRoles,
  users
} from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import {
  createRoleRemote,
  createUserRemote,
  deleteRoleRemote,
  deleteUserRemote,
  getUserRemote,
  listRolesRemote,
  listUsersRemote,
  setUserActiveRemote,
  updateRoleRemote,
  updateUserRemote
} from './users.remote'

const ADMIN_ROLE_NAME = 'Administrator'

async function resetDb() {
  await db.delete(sessions)
  await db.delete(userRoles)
  await db.delete(rolePermissions)
  await db.delete(roles)
  await db.delete(accounts)
  await db.delete(users)
}

async function seedAdminRole(): Promise<string> {
  const [row] = await db
    .insert(roles)
    .values({ name: ADMIN_ROLE_NAME, description: 'Voller Zugriff' })
    .returning({ id: roles.id })
  await db
    .insert(rolePermissions)
    .values({ roleId: row.id, permission: WILDCARD_PERMISSION })
  return row.id
}

async function seedUserRow(name = 'Test User'): Promise<string> {
  const id = `u_${randomUUID()}`
  await db
    .insert(users)
    .values({ id, name, email: `${id}@twincars.local`, username: id })
  return id
}

function authAs(opts: { permissions?: string[]; userId?: string } = {}) {
  mockRequestEvent.locals.user = {
    id: opts.userId ?? 'caller-id',
    name: 'Caller'
  }
  mockRequestEvent.locals.permissions = new Set(opts.permissions ?? [])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

describe('users.remote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Authentication guards (401-equivalent)                           */
  /* ──────────────────────────────────────────────────────────────── */

  describe('rejects anonymous callers', () => {
    it('listUsersRemote throws when not logged in', async () => {
      await expect(listUsersRemote({ page: 1, size: 25 })).rejects.toThrow()
    })

    it('getUserRemote throws when not logged in', async () => {
      await expect(
        getUserRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })

    it('createUserRemote throws when not logged in', async () => {
      await expect(
        createUserRemote({
          username: 'newuser',
          name: 'New User',
          password: 'password123',
          roleIds: []
        })
      ).rejects.toThrow()
    })

    it('updateUserRemote throws when not logged in', async () => {
      await expect(
        updateUserRemote({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'X'
        })
      ).rejects.toThrow()
    })

    it('deleteUserRemote throws when not logged in', async () => {
      await expect(
        deleteUserRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })

    it('listRolesRemote throws when not logged in', async () => {
      await expect(listRolesRemote()).rejects.toThrow()
    })

    it('createRoleRemote throws when not logged in', async () => {
      await expect(
        createRoleRemote({ name: 'New', permissions: [] })
      ).rejects.toThrow()
    })

    it('updateRoleRemote throws when not logged in', async () => {
      await expect(
        updateRoleRemote({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'X'
        })
      ).rejects.toThrow()
    })

    it('deleteRoleRemote throws when not logged in', async () => {
      await expect(
        deleteRoleRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Permission guards (403-equivalent)                               */
  /* ──────────────────────────────────────────────────────────────── */

  describe('rejects callers without the required permission', () => {
    beforeEach(() => {
      // Authenticated, but without the `users` module — every user/role
      // operation must refuse (per-module model: no module = no access).
      authAs({ permissions: ['vehicles'] })
    })

    it('createUserRemote refuses without the users module', async () => {
      await expect(
        createUserRemote({
          username: 'newuser',
          name: 'New User',
          password: 'password123',
          roleIds: []
        })
      ).rejects.toThrow()
    })

    it('updateUserRemote refuses without the users module', async () => {
      await expect(
        updateUserRemote({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'X'
        })
      ).rejects.toThrow()
    })

    it('deleteUserRemote refuses without the users module', async () => {
      await expect(
        deleteUserRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })

    it('createRoleRemote refuses without the users module', async () => {
      await expect(
        createRoleRemote({ name: 'New Role', permissions: [] })
      ).rejects.toThrow()
    })

    it('updateRoleRemote refuses without the users module', async () => {
      await expect(
        updateRoleRemote({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'X'
        })
      ).rejects.toThrow()
    })

    it('deleteRoleRemote refuses without the users module', async () => {
      await expect(
        deleteRoleRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })

    it('queries also refuse when the caller lacks the users module', async () => {
      authAs({ permissions: ['vehicles'] })
      await expect(listUsersRemote({ page: 1, size: 25 })).rejects.toThrow()
      await expect(
        getUserRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
      await expect(listRolesRemote()).rejects.toThrow()
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* Happy paths — caller has wildcard                                */
  /* ──────────────────────────────────────────────────────────────── */

  describe('happy paths with full permissions', () => {
    beforeEach(() => {
      authAs({ permissions: [WILDCARD_PERMISSION] })
    })

    it('createUserRemote creates a user and assigns the requested roles', async () => {
      const [role1] = await db
        .insert(roles)
        .values({ name: 'Sachbearbeiter' })
        .returning({ id: roles.id })
      const [role2] = await db
        .insert(roles)
        .values({ name: 'Buchhaltung' })
        .returning({ id: roles.id })

      const result = await createUserRemote({
        username: 'newuser',
        name: 'New User',
        password: 'password123',
        roleIds: [role1.id, role2.id]
      })

      expect(result.id).toBeTruthy()
      const [persisted] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.id))
      expect(persisted.name).toBe('New User')
      expect(persisted.username).toBe('newuser')
      expect(persisted.email).toBe('newuser@twincars.local')

      const assignedRoles = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, result.id))
      expect(assignedRoles.map((r) => r.roleId).sort()).toEqual(
        [role1.id, role2.id].sort()
      )
    })

    it('listUsersRemote paginates and filters by username/name/email', async () => {
      // Seed three users directly so we control their fields.
      const seed = async (username: string, name: string, email: string) => {
        const id = `u_${randomUUID()}`
        await db.insert(users).values({ id, username, name, email })
        return id
      }
      await seed('alice', 'Alice Admin', 'alice@twincars.local')
      await seed('bob', 'Bob Buyer', 'bob@twincars.local')
      await seed('carol', 'Carol Clerk', 'carol@twincars.local')

      const all = await listUsersRemote({ page: 1, size: 25 })
      expect(all.total).toBe(3)
      expect(all.items).toHaveLength(3)
      expect(all.pageCount).toBe(1)

      const page1 = await listUsersRemote({ page: 1, size: 10, q: 'bob' })
      expect(page1.total).toBe(1)
      expect(page1.items[0].username).toBe('bob')

      const byName = await listUsersRemote({ page: 1, size: 10, q: 'Clerk' })
      expect(byName.total).toBe(1)
      expect(byName.items[0].name).toBe('Carol Clerk')

      const byEmail = await listUsersRemote({
        page: 1,
        size: 10,
        q: 'alice@twincars'
      })
      expect(byEmail.total).toBe(1)
      expect(byEmail.items[0].username).toBe('alice')
    })

    it('getUserRemote returns the user with role ids', async () => {
      const userId = await seedUserRow('Detail User')
      const [role] = await db
        .insert(roles)
        .values({ name: 'Werkstatt' })
        .returning({ id: roles.id })
      await db.insert(userRoles).values({ userId, roleId: role.id })

      const result = await getUserRemote({ id: userId })
      expect(result.id).toBe(userId)
      expect(result.name).toBe('Detail User')
      expect(result.roleIds).toEqual([role.id])
    })

    it('getUserRemote throws 404 for an unknown id', async () => {
      await expect(
        getUserRemote({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow()
    })

    it('updateUserRemote replaces the role set when roleIds is provided', async () => {
      const userId = await seedUserRow('Update Me')
      const [oldRole] = await db
        .insert(roles)
        .values({ name: 'Old Role' })
        .returning({ id: roles.id })
      const [newRole] = await db
        .insert(roles)
        .values({ name: 'New Role' })
        .returning({ id: roles.id })
      await db.insert(userRoles).values({ userId, roleId: oldRole.id })

      await updateUserRemote({
        id: userId,
        name: 'Renamed',
        roleIds: [newRole.id]
      })

      const [persisted] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
      expect(persisted.name).toBe('Renamed')

      const assigned = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
      expect(assigned.map((r) => r.roleId)).toEqual([newRole.id])
    })

    it('deleteUserRemote removes a normal user', async () => {
      const userId = await seedUserRow('Doomed')
      await deleteUserRemote({ id: userId })
      const remaining = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
      expect(remaining).toEqual([])
    })

    it('deleteUserRemote refuses to delete the last admin', async () => {
      const adminRoleId = await seedAdminRole()
      const onlyAdminId = await seedUserRow('Sole Admin')
      await db
        .insert(userRoles)
        .values({ userId: onlyAdminId, roleId: adminRoleId })

      await expectHttpError(
        () => deleteUserRemote({ id: onlyAdminId }),
        409,
        /letzte Administrator/i
      )

      // Still present.
      const [stillThere] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, onlyAdminId))
      expect(stillThere.id).toBe(onlyAdminId)
    })

    it('deleteUserRemote allows deletion when another admin remains', async () => {
      const adminRoleId = await seedAdminRole()
      const admin1 = await seedUserRow('Admin 1')
      const admin2 = await seedUserRow('Admin 2')
      await db.insert(userRoles).values([
        { userId: admin1, roleId: adminRoleId },
        { userId: admin2, roleId: adminRoleId }
      ])

      await deleteUserRemote({ id: admin1 })
      const remaining = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, admin1))
      expect(remaining).toEqual([])
    })

    it('listRolesRemote returns roles with their permission arrays', async () => {
      const [r1] = await db
        .insert(roles)
        .values({ name: 'A-Reader', description: 'liest' })
        .returning({ id: roles.id })
      const [r2] = await db
        .insert(roles)
        .values({ name: 'B-Writer' })
        .returning({ id: roles.id })
      await db.insert(rolePermissions).values([
        { roleId: r1.id, permission: 'customers' },
        { roleId: r2.id, permission: 'customers' },
        { roleId: r2.id, permission: 'vehicles' }
      ])

      const result = await listRolesRemote()
      const byName = new Map(result.map((r) => [r.name, r]))
      expect(byName.get('A-Reader')?.permissions).toEqual(['customers'])
      expect(byName.get('B-Writer')?.permissions.sort()).toEqual([
        'customers',
        'vehicles'
      ])
    })

    it('createRoleRemote accepts a known permission set', async () => {
      const result = await createRoleRemote({
        name: 'Limited',
        description: 'Kunden + Fahrzeuge',
        permissions: ['customers', 'vehicles']
      })
      expect(result.id).toBeTruthy()
      const perms = await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, result.id))
      expect(perms.map((p) => p.permission).sort()).toEqual([
        'customers',
        'vehicles'
      ])
    })

    it('createRoleRemote rejects unknown permission keys', async () => {
      await expect(
        createRoleRemote({
          name: 'Bad',
          permissions: ['customers', 'not_a_real:perm']
        })
      ).rejects.toThrow()
    })

    it('createRoleRemote accepts the wildcard', async () => {
      const result = await createRoleRemote({
        name: 'Super',
        permissions: [WILDCARD_PERMISSION]
      })
      const perms = await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, result.id))
      expect(perms.map((p) => p.permission)).toEqual([WILDCARD_PERMISSION])
    })

    it('updateRoleRemote replaces the permission set when provided', async () => {
      const [role] = await db
        .insert(roles)
        .values({ name: 'Mutable' })
        .returning({ id: roles.id })
      await db.insert(rolePermissions).values([
        { roleId: role.id, permission: 'customers' },
        { roleId: role.id, permission: 'vehicles' }
      ])

      await updateRoleRemote({ id: role.id, permissions: ['vehicles'] })

      const perms = await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))
      expect(perms.map((p) => p.permission)).toEqual(['vehicles'])
    })

    it('deleteRoleRemote refuses to delete the Administrator role', async () => {
      const adminRoleId = await seedAdminRole()
      await expectHttpError(
        () => deleteRoleRemote({ id: adminRoleId }),
        409,
        /Administrator-Rolle/i
      )
      const [stillThere] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.id, adminRoleId))
      expect(stillThere.id).toBe(adminRoleId)
    })

    it('deleteRoleRemote allows deletion of a normal role', async () => {
      const [role] = await db
        .insert(roles)
        .values({ name: 'Disposable' })
        .returning({ id: roles.id })
      await deleteRoleRemote({ id: role.id })
      const remaining = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.id, role.id))
      expect(remaining).toEqual([])
    })
  })

  /* ──────────────────────────────────────────────────────────────── */
  /* User deactivation (setUserActiveRemote)                          */
  /* ──────────────────────────────────────────────────────────────── */

  describe('setUserActiveRemote', () => {
    const seedSession = async (userId: string) => {
      const id = `s_${randomUUID()}`
      await db
        .insert(sessions)
        .values({
          id,
          userId,
          token: `tok_${randomUUID()}`,
          expiresAt: new Date(Date.now() + 1_000_000)
        })
      return id
    }

    it('requires the users module', async () => {
      authAs({ permissions: ['vehicles'] })
      const userId = await seedUserRow()
      await expect(
        setUserActiveRemote({ id: userId, active: false })
      ).rejects.toThrow()
    })

    it('deactivates a user and force-deletes their sessions', async () => {
      authAs({ permissions: ['users'] })
      const userId = await seedUserRow()
      await seedSession(userId)
      await setUserActiveRemote({ id: userId, active: false })

      const [row] = await db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, userId))
      expect(row.active).toBe(false)
      const remainingSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId))
      expect(remainingSessions).toEqual([])
    })

    it('reactivates a user', async () => {
      authAs({ permissions: ['users'] })
      const userId = await seedUserRow()
      await db.update(users).set({ active: false }).where(eq(users.id, userId))
      await setUserActiveRemote({ id: userId, active: true })
      const [row] = await db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, userId))
      expect(row.active).toBe(true)
    })

    it('refuses to deactivate the last wildcard admin', async () => {
      authAs({ permissions: ['users'] })
      const adminRoleId = await seedAdminRole()
      const adminUserId = await seedUserRow('Sole Admin')
      await db
        .insert(userRoles)
        .values({ userId: adminUserId, roleId: adminRoleId })

      await expectHttpError(
        () => setUserActiveRemote({ id: adminUserId, active: false }),
        409,
        /letzte Administrator/i
      )
      const [row] = await db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, adminUserId))
      expect(row.active).toBe(true)
    })

    it('allows deactivating an admin when another admin remains', async () => {
      authAs({ permissions: ['users'] })
      const adminRoleId = await seedAdminRole()
      const adminA = await seedUserRow('Admin A')
      const adminB = await seedUserRow('Admin B')
      await db.insert(userRoles).values([
        { userId: adminA, roleId: adminRoleId },
        { userId: adminB, roleId: adminRoleId }
      ])
      await setUserActiveRemote({ id: adminA, active: false })
      const [row] = await db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, adminA))
      expect(row.active).toBe(false)
    })

    it('404 for an unknown user', async () => {
      authAs({ permissions: ['users'] })
      await expectHttpError(
        () =>
          setUserActiveRemote({
            id: '00000000-0000-0000-0000-000000000000',
            active: false
          }),
        404
      )
    })
  })
})
