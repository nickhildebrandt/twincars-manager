import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { allocateNumber } from './number-range-service'
import { db } from '$lib/server/db/client'
import { numberRanges } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Integration tests for the atomic number-range allocator, backed by
 * pg-mem so the single-statement UPDATE ... RETURNING path is
 * exercised through the real Drizzle query layer.
 *
 * @group integration
 * @module number-range-service
 */
describe('number-range-service', () => {
  const currentYear = new Date().getFullYear()

  beforeEach(async () => {
    await db.delete(numberRanges)
  })

  describe('allocateNumber on an existing range', () => {
    it('allocates strictly sequential numbers', async () => {
      await db
        .insert(numberRanges)
        .values({ kind: 'invoice', formatTemplate: '{N}', nextValue: 19087 })
      expect(await allocateNumber('invoice')).toBe('19087')
      expect(await allocateNumber('invoice')).toBe('19088')
      expect(await allocateNumber('invoice')).toBe('19089')
    })

    it('persists the bumped counter in the table', async () => {
      await db
        .insert(numberRanges)
        .values({ kind: 'offer', formatTemplate: '{N}', nextValue: 1 })
      await allocateNumber('offer')
      await allocateNumber('offer')
      const [row] = await db
        .select()
        .from(numberRanges)
        .where(eq(numberRanges.kind, 'offer'))
      expect(row.nextValue).toBe(3)
    })

    it('renders year + padded sequence placeholders from the template', async () => {
      await db
        .insert(numberRanges)
        .values({
          kind: 'reminder',
          formatTemplate: 'ZE-{YYYY}-{NNNN}',
          nextValue: 7
        })
      expect(await allocateNumber('reminder')).toBe(`ZE-${currentYear}-0007`)
    })

    it('keeps independent counters per kind', async () => {
      await db.insert(numberRanges).values([
        { kind: 'invoice', formatTemplate: '{N}', nextValue: 100 },
        { kind: 'storno', formatTemplate: 'S-{N}', nextValue: 1 }
      ])
      expect(await allocateNumber('invoice')).toBe('100')
      expect(await allocateNumber('storno')).toBe('S-1')
      expect(await allocateNumber('invoice')).toBe('101')
    })
  })

  describe('allocateNumber with a missing range row', () => {
    it('seeds the row persistently — two calls yield different numbers', async () => {
      const first = await allocateNumber('invoice')
      const second = await allocateNumber('invoice')
      expect(first).toBe('1')
      expect(second).toBe('2')
      const [row] = await db
        .select()
        .from(numberRanges)
        .where(eq(numberRanges.kind, 'invoice'))
      expect(row).toBeDefined()
      expect(row.formatTemplate).toBe('{N}')
      expect(row.nextValue).toBe(3)
    })

    it('uses the seed-defaults template for the seeded kind', async () => {
      expect(await allocateNumber('tire_storage')).toBe(`L-${currentYear}-0001`)
      expect(await allocateNumber('tire_storage')).toBe(`L-${currentYear}-0002`)
    })

    it('falls back to the plain-counter template for unknown kinds', async () => {
      expect(await allocateNumber('some_future_kind')).toBe('1')
      expect(await allocateNumber('some_future_kind')).toBe('2')
      const [row] = await db
        .select()
        .from(numberRanges)
        .where(eq(numberRanges.kind, 'some_future_kind'))
      expect(row.formatTemplate).toBe('{N}')
    })
  })

  describe('interleaved allocations (regression for the lost update)', () => {
    it('never hands out the same sequence twice across parallel calls', async () => {
      await db
        .insert(numberRanges)
        .values({ kind: 'invoice', formatTemplate: '{N}', nextValue: 1 })
      // pg-mem executes statements sequentially, so this cannot prove
      // real row-lock behaviour — but it does prove the single-statement
      // allocation has no read-modify-write window in application code
      // (the old SELECT-then-UPDATE version fails this test).
      //
      // Harness limitation (probed 2026-07): a `db.transaction` +
      // `SELECT ... FOR UPDATE` variant of the allocator cannot be
      // tested here — the pg-proxy driver behind `test-db.ts` throws
      // "Transactions are not supported by the Postgres Proxy driver"
      // on any `db.transaction`, while pg-mem itself parses
      // `.for('update')` fine. That is one reason the allocator stays
      // a single atomic UPDATE ... RETURNING.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => allocateNumber('invoice'))
      )
      expect(new Set(results).size).toBe(10)
      const [row] = await db
        .select()
        .from(numberRanges)
        .where(eq(numberRanges.kind, 'invoice'))
      expect(row.nextValue).toBe(11)
    })
  })
})
