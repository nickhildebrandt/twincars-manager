// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

/**
 * Integration tests for the `createUserWithCredential` helper used by
 * the setup wizard and the admin "Benutzer & Rollen" settings UI.
 *
 * The crucial invariant exercised here is the username casing round-trip:
 * the better-auth username plugin lowercases the username on sign-in
 * (`signInUsername` does `normalizer(username)`), so our direct
 * insert path **must** lowercase on write — otherwise sign-in for any
 * username that wasn't typed in pure lowercase would silently fail.
 *
 * @group integration
 * @module auth-users
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from './db/client'
import { accounts, companySettings, sessions, users } from './db/schema'
import { auth } from './auth'
import {
  createUserWithCredential,
  deleteUserSessions,
  isUserActive,
  isUsernameDeactivated,
  normaliseUsername
} from './auth-users'

async function resetDb() {
  await db.delete(sessions)
  await db.delete(accounts)
  await db.delete(users)
  await db.delete(companySettings)
}

describe('auth-users', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('normaliseUsername', () => {
    it('lowercases and trims the input', () => {
      expect(normaliseUsername('  TestAdmin  ')).toBe('testadmin')
    })

    it('is idempotent for already-lowercase input', () => {
      expect(normaliseUsername('admin')).toBe('admin')
    })
  })

  describe('createUserWithCredential', () => {
    it('writes a user row with the lowercased username and synthesizes the email', async () => {
      await createUserWithCredential({
        username: 'TestAdmin',
        name: 'Test Admin',
        password: 'testpassword123'
      })

      const [u] = await db.select().from(users)
      expect(u.username).toBe('testadmin')
      expect(u.displayUsername).toBe('TestAdmin')
      expect(u.email).toBe('testadmin@twincars.local')
      expect(u.name).toBe('Test Admin')
    })

    it('writes a credential account row with a non-empty password hash', async () => {
      const { id } = await createUserWithCredential({
        username: 'admin',
        name: 'Administrator',
        password: 'supersecret'
      })

      const [a] = await db.select().from(accounts)
      expect(a.userId).toBe(id)
      expect(a.providerId).toBe('credential')
      expect(a.password).toBeTruthy()
      // better-auth's scrypt format is "<saltHex>:<keyHex>" — the salt
      // is 16 bytes (32 hex chars) and the key 64 bytes (128 hex chars).
      const parts = (a.password as string).split(':')
      expect(parts).toHaveLength(2)
      expect(parts[0]!.length).toBe(32)
      expect(parts[1]!.length).toBe(128)
    })

    it('verifies the round-trip: a freshly hashed password validates against the same internal verifier', async () => {
      await createUserWithCredential({
        username: 'roundtrip',
        name: 'Round Trip',
        password: 'roundtrippass123'
      })

      const [a] = await db.select().from(accounts)
      const ctx = await auth.$context
      const ok = await ctx.password.verify({
        hash: a.password as string,
        password: 'roundtrippass123'
      })
      expect(ok).toBe(true)

      const bad = await ctx.password.verify({
        hash: a.password as string,
        password: 'wrong-password'
      })
      expect(bad).toBe(false)
    })

    it('rejects usernames with characters the username plugin would later refuse', async () => {
      await expect(
        createUserWithCredential({
          username: 'has space',
          name: 'Test',
          password: 'testpassword123'
        })
      ).rejects.toThrow(/Buchstaben/)
    })

    it('rejects usernames that are too short', async () => {
      await expect(
        createUserWithCredential({
          username: 'ab',
          name: 'Test',
          password: 'testpassword123'
        })
      ).rejects.toThrow(/3 und 64/)
    })

    it('rejects two users with the same username regardless of input casing', async () => {
      await createUserWithCredential({
        username: 'collide',
        name: 'First',
        password: 'pw12345678'
      })
      await expect(
        createUserWithCredential({
          username: 'COLLIDE',
          name: 'Second',
          password: 'pw12345678'
        })
      ).rejects.toThrow()
    })
  })

  describe('deactivation helpers', () => {
    it('isUserActive: true for an active user, false for inactive / unknown', async () => {
      const { id } = await createUserWithCredential({
        username: 'activeuser',
        name: 'Active',
        password: 'pw12345678'
      })
      expect(await isUserActive(id)).toBe(true)

      await db.update(users).set({ active: false }).where(eq(users.id, id))
      expect(await isUserActive(id)).toBe(false)

      // Unknown id fails closed.
      expect(await isUserActive('u_does-not-exist')).toBe(false)
    })

    it('isUsernameDeactivated: true only for a deactivated account; false for active / unknown', async () => {
      const { id } = await createUserWithCredential({
        username: 'Switcher',
        name: 'Switcher',
        password: 'pw12345678'
      })
      // Active account → not deactivated. Casing must not matter (the
      // sign-in POST carries whatever the user typed).
      expect(await isUsernameDeactivated('SWITCHER')).toBe(false)

      await db.update(users).set({ active: false }).where(eq(users.id, id))
      expect(await isUsernameDeactivated('switcher')).toBe(true)

      // Unknown username falls through to normal invalid-credentials path.
      expect(await isUsernameDeactivated('nobody')).toBe(false)
    })

    it('deleteUserSessions removes only the target user’s sessions', async () => {
      const a = await createUserWithCredential({
        username: 'sessa',
        name: 'A',
        password: 'pw12345678'
      })
      const b = await createUserWithCredential({
        username: 'sessb',
        name: 'B',
        password: 'pw12345678'
      })
      const mkSession = (userId: string) =>
        db
          .insert(sessions)
          .values({
            id: `s_${randomUUID()}`,
            userId,
            token: `tok_${randomUUID()}`,
            expiresAt: new Date(Date.now() + 1_000_000)
          })
      await mkSession(a.id)
      await mkSession(a.id)
      await mkSession(b.id)

      await deleteUserSessions(a.id)

      const left = await db.select({ userId: sessions.userId }).from(sessions)
      expect(left).toEqual([{ userId: b.id }])
    })
  })
})
