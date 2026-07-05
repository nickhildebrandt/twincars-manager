// @vitest-environment node
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi
} from 'vitest'

/**
 * Integration tests for the SMTP settings upsert service against an
 * in-memory pg-mem database: insert path, keep-password-on-empty
 * update semantics and encryption at rest.
 *
 * @group integration
 * @module smtp-settings-service
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { smtpSettings } from '$lib/server/db/schema'
import { decryptSecret, isEncryptedSecret } from '$lib/server/crypto'
import { upsertSmtpSettings } from './smtp-settings-service'

const validInput = {
  host: 'smtp.example.com',
  port: 587,
  secure: 'STARTTLS' as const,
  username: 'mailer',
  password: 'super-geheim!',
  fromAddress: 'noreply@twincast.de',
  fromName: 'TwinCast',
  replyTo: null
}

describe('smtp-settings-service — upsertSmtpSettings', () => {
  beforeAll(() => {
    vi.stubEnv('APP_ENCRYPTION_KEY', 'test-encryption-key-please-rotate')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })
  beforeEach(async () => {
    await db.delete(smtpSettings)
  })

  it('inserts a fresh row with the password AES-256-GCM encrypted', async () => {
    await upsertSmtpSettings(validInput)
    const rows = await db.select().from(smtpSettings)
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row.host).toBe('smtp.example.com')
    expect(row.port).toBe(587)
    expect(row.secure).toBe('STARTTLS')
    expect(row.username).toBe('mailer')
    expect(row.fromAddress).toBe('noreply@twincast.de')
    expect(row.fromName).toBe('TwinCast')
    expect(row.replyTo).toBeNull()
    expect(row.verified).toBe(false)
    // Never plaintext at rest.
    expect(row.password).not.toBe('super-geheim!')
    expect(isEncryptedSecret(row.password)).toBe(true)
    expect(decryptSecret(row.password)).toBe('super-geheim!')
  })

  it('stores an empty string when inserting without a password', async () => {
    await upsertSmtpSettings({ ...validInput, password: '' })
    const [row] = await db.select().from(smtpSettings)
    expect(row.password).toBe('')
  })

  it('updates the existing row instead of inserting a second one', async () => {
    await upsertSmtpSettings(validInput)
    await upsertSmtpSettings({
      ...validInput,
      host: 'mail.other.example',
      port: 465,
      secure: 'TLS',
      replyTo: 'antwort@twincast.de'
    })
    const rows = await db.select().from(smtpSettings)
    expect(rows).toHaveLength(1)
    expect(rows[0].host).toBe('mail.other.example')
    expect(rows[0].port).toBe(465)
    expect(rows[0].secure).toBe('TLS')
    expect(rows[0].replyTo).toBe('antwort@twincast.de')
  })

  it('keeps the stored encrypted password when the update input is empty', async () => {
    await upsertSmtpSettings(validInput)
    const [before] = await db.select().from(smtpSettings)
    await upsertSmtpSettings({ ...validInput, password: '' })
    const [after] = await db.select().from(smtpSettings)
    // Byte-identical ciphertext: the stored secret was not re-written.
    expect(after.password).toBe(before.password)
    expect(decryptSecret(after.password)).toBe('super-geheim!')
  })

  it('re-encrypts when a new password is supplied on update', async () => {
    await upsertSmtpSettings(validInput)
    const [before] = await db.select().from(smtpSettings)
    await upsertSmtpSettings({ ...validInput, password: 'neues-geheimnis' })
    const [after] = await db.select().from(smtpSettings)
    expect(after.password).not.toBe(before.password)
    expect(isEncryptedSecret(after.password)).toBe(true)
    expect(decryptSecret(after.password)).toBe('neues-geheimnis')
  })

  it('resets verified to false on every save', async () => {
    await upsertSmtpSettings(validInput)
    const [{ id }] = await db.select({ id: smtpSettings.id }).from(smtpSettings)
    await db
      .update(smtpSettings)
      .set({ verified: true })
      .where(eq(smtpSettings.id, id))
    await upsertSmtpSettings(validInput)
    const [row] = await db.select().from(smtpSettings)
    expect(row.verified).toBe(false)
  })
})
