import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createItem,
  deleteItem,
  deleteItemPriceVersion,
  getCurrentItemPrice,
  getItem,
  getItemPriceAt,
  listItemPriceHistory,
  listItems,
  listPublicServices,
  nextArticleNumber,
  updateItem,
  upsertItemPrice
} from './item-service'
import { db } from '$lib/server/db/client'
import { itemPriceVersions, items } from '$lib/server/db/schema'

/**
 * Integration tests for the item service. Since Migration 0022 the
 * `items` table is the Werkstattleistungen / Material catalogue only —
 * no JSONB attributes, no online-shop flag, no shipping link. Tires
 * have their own service module (`tire-service.ts`).
 *
 * @group integration
 * @module item-service
 */
describe('item-service', () => {
  beforeEach(async () => {
    await db.delete(itemPriceVersions)
    await db.delete(items)
  })

  describe('createItem', () => {
    it('persists an item without a price when none is provided', async () => {
      const created = await createItem({
        articleNumber: 'ART-00001',
        description: 'Ölwechsel',
        kind: 'service'
      })
      expect(created.id).toBeTruthy()
      expect(created.articleNumber).toBe('ART-00001')
      expect(created.unitPriceNet).toBeNull()
    })

    it('persists an item and seeds the initial price version', async () => {
      const created = await createItem({
        articleNumber: 'ART-00002',
        description: 'Reifenmontage',
        kind: 'service',
        unitPriceNet: '49.90'
      })
      expect(created.id).toBeTruthy()
      expect(Number(created.unitPriceNet)).toBe(49.9)
      const history = await listItemPriceHistory(created.id, 1, 25)
      expect(history.total).toBe(1)
    })

    it('does not create a price version for empty unitPriceNet', async () => {
      const created = await createItem({
        articleNumber: 'ART-00003',
        description: 'Leerer Preis',
        kind: 'service',
        unitPriceNet: ''
      })
      expect(created.unitPriceNet).toBeNull()
      const history = await listItemPriceHistory(created.id, 1, 25)
      expect(history.total).toBe(0)
    })
  })

  describe('listItems', () => {
    beforeEach(async () => {
      await db.insert(items).values([
        {
          articleNumber: 'ART-A001',
          description: 'Ölwechsel klein',
          kind: 'service'
        },
        {
          articleNumber: 'ART-A002',
          description: 'Bremsklotz vorne',
          kind: 'article'
        },
        {
          articleNumber: 'ART-A003',
          description: 'TÜV-Prüfung',
          kind: 'service'
        }
      ])
    })

    it('paginates and reports total + pageCount', async () => {
      const res = await listItems({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('filters by article number', async () => {
      const res = await listItems({ page: 1, size: 25, q: 'ART-A002' })
      expect(res.total).toBe(1)
      expect(res.items[0].description).toBe('Bremsklotz vorne')
    })

    it('filters by description (case-insensitive)', async () => {
      const res = await listItems({ page: 1, size: 25, q: 'bremsklotz' })
      expect(res.total).toBe(1)
      expect(res.items[0].articleNumber).toBe('ART-A002')
    })

    it('filters by kind', async () => {
      const res = await listItems({ page: 1, size: 25, kind: 'service' })
      expect(res.total).toBe(2)
      expect(res.items.every((i) => i.kind === 'service')).toBe(true)
    })

    it('enriches each row with the current price (null when none)', async () => {
      const res = await listItems({ page: 1, size: 25 })
      for (const i of res.items) {
        expect(i.unitPriceNet).toBeNull()
      }
    })

    it('enriches with the latest price version', async () => {
      const [first] = await db.select().from(items).limit(1)
      await upsertItemPrice({
        itemId: first.id,
        validFrom: '2025-01-01',
        unitPriceNet: '99.99'
      })
      const res = await listItems({ page: 1, size: 25 })
      const enriched = res.items.find((i) => i.id === first.id)
      expect(Number(enriched?.unitPriceNet)).toBe(99.99)
    })

    it('returns pageCount=1 even when empty', async () => {
      await db.delete(items)
      const res = await listItems({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateItem', () => {
    it('updates fields and refreshes updatedAt', async () => {
      const created = await createItem({
        articleNumber: 'ART-U001',
        description: 'Alt',
        kind: 'service'
      })
      const updated = await updateItem(created.id, { description: 'Neu' })
      expect(updated.description).toBe('Neu')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })

    it('appends a new price version when unitPriceNet is provided', async () => {
      const created = await createItem({
        articleNumber: 'ART-U002',
        description: 'Mit Preis',
        kind: 'service',
        unitPriceNet: '10.00'
      })
      await updateItem(created.id, { unitPriceNet: '11.00' })
      const v = await getCurrentItemPrice(created.id)
      expect(Number(v?.unitPriceNet)).toBe(11)
    })
  })

  describe('deleteItem', () => {
    it('removes the row', async () => {
      const created = await createItem({
        articleNumber: 'ART-D001',
        description: 'Doomed',
        kind: 'service'
      })
      await deleteItem(created.id)
      expect(await getItem(created.id)).toBeNull()
    })
  })

  describe('getItem', () => {
    it('returns null for unknown id', async () => {
      expect(await getItem('00000000-0000-0000-0000-000000000000')).toBeNull()
    })

    it('returns the row with the current price', async () => {
      const created = await createItem({
        articleNumber: 'ART-G001',
        description: 'Mit Preis',
        kind: 'service',
        unitPriceNet: '25.50'
      })
      const fetched = await getItem(created.id)
      expect(fetched?.articleNumber).toBe('ART-G001')
      expect(Number(fetched?.unitPriceNet)).toBe(25.5)
    })
  })

  describe('nextArticleNumber', () => {
    it('returns ART-00001 when no items exist', async () => {
      expect(await nextArticleNumber()).toBe('ART-00001')
    })

    it('returns the next padded number based on row count', async () => {
      await createItem({
        articleNumber: 'ART-EXIST-1',
        description: 'X',
        kind: 'service'
      })
      await createItem({
        articleNumber: 'ART-EXIST-2',
        description: 'Y',
        kind: 'service'
      })
      expect(await nextArticleNumber()).toBe('ART-00003')
    })
  })

  describe('getItemPriceAt / getCurrentItemPrice', () => {
    it('returns null when no price version exists', async () => {
      const i = await createItem({
        articleNumber: 'ART-P001',
        description: 'Preislos',
        kind: 'service'
      })
      expect(await getCurrentItemPrice(i.id)).toBeNull()
      expect(await getItemPriceAt(i.id, '2025-01-01')).toBeNull()
    })

    it('returns the single existing version', async () => {
      const i = await createItem({
        articleNumber: 'ART-P002',
        description: 'Ein Preis',
        kind: 'service'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2024-01-01',
        unitPriceNet: '42.00'
      })
      const v = await getItemPriceAt(i.id, '2025-06-01')
      expect(Number(v?.unitPriceNet)).toBe(42)
    })

    it('returns the version with the highest validFrom <= asOf', async () => {
      const i = await createItem({
        articleNumber: 'ART-P003',
        description: 'Mehrere Preise',
        kind: 'service'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2023-01-01',
        unitPriceNet: '10.00'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2024-06-01',
        unitPriceNet: '15.00'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '20.00'
      })

      const v1 = await getItemPriceAt(i.id, '2023-12-31')
      expect(Number(v1?.unitPriceNet)).toBe(10)

      const v2 = await getItemPriceAt(i.id, '2024-12-31')
      expect(Number(v2?.unitPriceNet)).toBe(15)

      const v3 = await getItemPriceAt(i.id, '2025-12-31')
      expect(Number(v3?.unitPriceNet)).toBe(20)
    })

    it('returns null when asOf is before the earliest version', async () => {
      const i = await createItem({
        articleNumber: 'ART-P004',
        description: 'Frühschluss',
        kind: 'service'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '99.00'
      })
      expect(await getItemPriceAt(i.id, '2024-12-31')).toBeNull()
    })
  })

  describe('upsertItemPrice', () => {
    it('inserts a new row when none exists at validFrom', async () => {
      const i = await createItem({
        articleNumber: 'ART-UP001',
        description: 'Up',
        kind: 'service'
      })
      const v = await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '5.00'
      })
      expect(v.id).toBeTruthy()
      expect(Number(v.unitPriceNet)).toBe(5)
    })

    it('updates the existing row when validFrom matches', async () => {
      const i = await createItem({
        articleNumber: 'ART-UP002',
        description: 'Up dating',
        kind: 'service'
      })
      const first = await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '7.00'
      })
      const second = await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '7.50'
      })
      expect(second.id).toBe(first.id)
      expect(Number(second.unitPriceNet)).toBe(7.5)
      const hist = await listItemPriceHistory(i.id, 1, 25)
      expect(hist.total).toBe(1)
    })
  })

  describe('deleteItemPriceVersion', () => {
    it('removes a single version', async () => {
      const i = await createItem({
        articleNumber: 'ART-D-P001',
        description: 'Del',
        kind: 'service'
      })
      const v = await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '5.00'
      })
      await deleteItemPriceVersion(v.id)
      expect(await getCurrentItemPrice(i.id)).toBeNull()
    })
  })

  describe('listItemPriceHistory', () => {
    it('returns versions newest first, paginated', async () => {
      const i = await createItem({
        articleNumber: 'ART-H001',
        description: 'Hist',
        kind: 'service'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2023-01-01',
        unitPriceNet: '10.00'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2024-01-01',
        unitPriceNet: '15.00'
      })
      await upsertItemPrice({
        itemId: i.id,
        validFrom: '2025-01-01',
        unitPriceNet: '20.00'
      })
      const res = await listItemPriceHistory(i.id, 1, 25)
      expect(res.total).toBe(3)
      expect(res.items.map((r) => r.validFrom)).toEqual([
        '2025-01-01',
        '2024-01-01',
        '2023-01-01'
      ])
    })

    it('returns pageCount=1 when no versions exist', async () => {
      const i = await createItem({
        articleNumber: 'ART-H002',
        description: 'Leer',
        kind: 'service'
      })
      const res = await listItemPriceHistory(i.id, 1, 25)
      expect(res.total).toBe(0)
      expect(res.pageCount).toBe(1)
      expect(res.items).toEqual([])
    })
  })

  describe('listPublicServices', () => {
    it('returns only active service items, with current price', async () => {
      const svc = await createItem({
        articleNumber: 'SVC-PUB-1',
        description: 'Inspektion',
        kind: 'service',
        unit: 'Std',
        unitPriceNet: '89.50'
      })
      await createItem({
        articleNumber: 'ART-PUB-1',
        description: 'Ölfilter',
        kind: 'article'
      })
      const rows = await listPublicServices()
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(svc.id)
      expect(Number(rows[0].unitPriceNet)).toBe(89.5)
    })
  })
})
