import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { getSettings } from './settings-service'
import { db } from '$lib/server/db/client'
import { companySettings } from '$lib/server/db/schema'

/**
 * Integration tests for the singleton company-settings service.
 *
 * @group integration
 * @module settings-service
 */
describe('settings-service', () => {
  beforeEach(async () => {
    await db.delete(companySettings)
  })

  describe('getSettings', () => {
    it('lazily creates the singleton row with defaults on first call', async () => {
      const before = await db.select().from(companySettings)
      expect(before).toHaveLength(0)
      const settings = await getSettings()
      expect(settings.id).toBeTruthy()
      expect(settings.setupCompleted).toBe(false)
      expect(settings.defaultCurrency).toBe('EUR')
      expect(settings.defaultPaymentTermDays).toBe(14)
      const after = await db.select().from(companySettings)
      expect(after).toHaveLength(1)
    })

    it('returns the existing row on subsequent calls (no duplicates)', async () => {
      const first = await getSettings()
      const second = await getSettings()
      expect(second.id).toBe(first.id)
      const rows = await db.select().from(companySettings)
      expect(rows).toHaveLength(1)
    })

    it('reflects updates made between calls', async () => {
      const initial = await getSettings()
      await db
        .update(companySettings)
        .set({ companyName: 'TwinCars GmbH', setupCompleted: true })
      const refreshed = await getSettings()
      expect(refreshed.id).toBe(initial.id)
      expect(refreshed.companyName).toBe('TwinCars GmbH')
      expect(refreshed.setupCompleted).toBe(true)
    })
  })
})
