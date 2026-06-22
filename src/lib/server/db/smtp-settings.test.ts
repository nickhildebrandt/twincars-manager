import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { smtpSettings } from '$lib/server/db/schema'

/**
 * Smoke tests for the `smtp_settings.password` column after dropping
 * the AES-GCM encryption indirection. The value persisted on write is
 * the value returned on read — no encrypt/decrypt step in between.
 *
 * @group integration
 * @module smtp-settings
 */
describe('smtp_settings.password', () => {
  beforeEach(async () => {
    await db.delete(smtpSettings)
  })

  it('round-trips a plaintext password without transformation', async () => {
    await db
      .insert(smtpSettings)
      .values({
        host: 'smtp.example.com',
        port: 587,
        secure: 'STARTTLS',
        username: 'user@example.com',
        password: 'plain-pa$$word!',
        fromAddress: 'noreply@example.com',
        fromName: 'TwinCars'
      })

    const [row] = await db.select().from(smtpSettings)
    expect(row.password).toBe('plain-pa$$word!')
  })

  it('defaults password to the empty string when omitted', async () => {
    await db
      .insert(smtpSettings)
      .values({
        host: 'smtp.example.com',
        port: 587,
        secure: 'STARTTLS',
        username: '',
        fromAddress: 'noreply@example.com',
        fromName: 'TwinCars'
      })

    const [row] = await db.select().from(smtpSettings)
    expect(row.password).toBe('')
  })

  it('overwrites the stored password on update', async () => {
    const [{ id }] = await db
      .insert(smtpSettings)
      .values({
        host: 'smtp.example.com',
        port: 587,
        secure: 'STARTTLS',
        username: 'user',
        password: 'first',
        fromAddress: 'noreply@example.com',
        fromName: 'TwinCars'
      })
      .returning({ id: smtpSettings.id })

    await db
      .update(smtpSettings)
      .set({ password: 'second' })
      .where(eq(smtpSettings.id, id))

    const [row] = await db.select().from(smtpSettings)
    expect(row.password).toBe('second')
  })
})
