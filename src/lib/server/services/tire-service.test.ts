import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  addTirePhoto,
  createTire,
  deleteTire,
  deleteTirePhoto,
  getCurrentTirePrice,
  getPublicTire,
  getTire,
  getTirePriceAt,
  listPublicTires,
  listTirePhotos,
  listTirePriceHistory,
  listTires,
  nextArticleNumber,
  parseTireSize,
  setMainTirePhoto,
  updateTire,
  upsertTirePrice
} from './tire-service'
import { db } from '$lib/server/db/client'
import {
  numberRanges,
  tirePhotos,
  tirePriceVersions,
  tires
} from '$lib/server/db/schema'

/**
 * Integration tests for the dedicated tire catalogue service. Covers
 * CRUD, versioned-price resolution, photo gallery, sequential
 * numbering and the public-storefront filters.
 *
 * @group integration
 * @module tire-service
 */
describe('tire-service', () => {
  beforeEach(async () => {
    await db.delete(tirePhotos)
    await db.delete(tirePriceVersions)
    await db.delete(tires)
    await db.delete(numberRanges)
    await db
      .insert(numberRanges)
      .values({ kind: 'tire', formatTemplate: '{N}', nextValue: 1 })
  })

  const baseTire = (over: Partial<Parameters<typeof createTire>[0]> = {}) => ({
    articleNumber: 'TIRE-1',
    brand: 'Continental',
    model: 'PremiumContact 6',
    width: 205,
    aspectRatio: 55,
    construction: 'R',
    diameterInch: 16,
    season: 'Sommer' as const,
    ...over
  })

  describe('CRUD', () => {
    it('creates a tire with all required EU fields', async () => {
      const created = await createTire(baseTire())
      expect(created.id).toBeTruthy()
      expect(created.brand).toBe('Continental')
      expect(created.season).toBe('Sommer')
      expect(created.unitPriceNet).toBeNull()
    })

    it('seeds an initial price version when unitPriceNet is provided', async () => {
      const created = await createTire(
        baseTire({ articleNumber: 'TIRE-2', unitPriceNet: '79.90' })
      )
      expect(Number(created.unitPriceNet)).toBe(79.9)
      const history = await listTirePriceHistory(created.id, 1, 25)
      expect(history.total).toBe(1)
    })

    it('reads a single tire by id', async () => {
      const created = await createTire(baseTire({ articleNumber: 'TIRE-3' }))
      const fetched = await getTire(created.id)
      expect(fetched?.id).toBe(created.id)
      expect(fetched?.model).toBe('PremiumContact 6')
    })

    it('returns null for an unknown id', async () => {
      const found = await getTire('00000000-0000-0000-0000-000000000000')
      expect(found).toBeNull()
    })

    it('updates a tire and persists the new price version', async () => {
      const created = await createTire(
        baseTire({ articleNumber: 'TIRE-4', unitPriceNet: '50.00' })
      )
      const updated = await updateTire(created.id, {
        model: 'WinterContact TS 870',
        season: 'Winter',
        unitPriceNet: '60.00'
      })
      expect(updated.model).toBe('WinterContact TS 870')
      expect(updated.season).toBe('Winter')
      const cur = await getCurrentTirePrice(updated.id)
      expect(Number(cur?.unitPriceNet)).toBe(60)
    })

    it('deletes a tire', async () => {
      const created = await createTire(baseTire({ articleNumber: 'TIRE-5' }))
      await deleteTire(created.id)
      expect(await getTire(created.id)).toBeNull()
    })
  })

  describe('sequential article numbering', () => {
    it('returns "1" on a fresh range and bumps to "2"', async () => {
      expect(await nextArticleNumber()).toBe('1')
      expect(await nextArticleNumber()).toBe('2')
    })
  })

  describe('listTires + filters', () => {
    beforeEach(async () => {
      await createTire(
        baseTire({
          articleNumber: 'L-1',
          brand: 'Michelin',
          model: 'CrossClimate',
          width: 205,
          aspectRatio: 55,
          diameterInch: 16,
          season: 'Ganzjahres',
          onlineSellable: true
        })
      )
      await createTire(
        baseTire({
          articleNumber: 'L-2',
          brand: 'Continental',
          model: 'PremiumContact 6',
          width: 225,
          aspectRatio: 45,
          diameterInch: 17,
          season: 'Sommer',
          onlineSellable: false
        })
      )
      await createTire(
        baseTire({
          articleNumber: 'L-3',
          brand: 'Continental',
          model: 'WinterContact TS 870',
          width: 195,
          aspectRatio: 65,
          diameterInch: 15,
          season: 'Winter',
          onlineSellable: true
        })
      )
    })

    it('paginates with total + pageCount', async () => {
      const res = await listTires({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('filters by season', async () => {
      const res = await listTires({ page: 1, size: 25, season: 'Winter' })
      expect(res.total).toBe(1)
      expect(res.items[0].articleNumber).toBe('L-3')
    })

    it('filters by the size triple', async () => {
      const res = await listTires({
        page: 1,
        size: 25,
        width: 205,
        aspectRatio: 55,
        diameterInch: 16
      })
      expect(res.total).toBe(1)
      expect(res.items[0].articleNumber).toBe('L-1')
    })

    it('filters by onlineSellable=true', async () => {
      const res = await listTires({ page: 1, size: 25, onlineSellable: true })
      expect(res.total).toBe(2)
      expect(res.items.every((t) => t.onlineSellable)).toBe(true)
    })

    it('case-insensitive search by brand/model', async () => {
      const res = await listTires({ page: 1, size: 25, q: 'michelin' })
      expect(res.total).toBe(1)
      expect(res.items[0].brand).toBe('Michelin')
    })
  })

  describe('versioned prices', () => {
    it('returns null when no price exists', async () => {
      const t = await createTire(baseTire({ articleNumber: 'P-1' }))
      expect(await getCurrentTirePrice(t.id)).toBeNull()
      expect(await getTirePriceAt(t.id, '2025-01-01')).toBeNull()
    })

    it('returns the version with highest validFrom <= asOf', async () => {
      const t = await createTire(baseTire({ articleNumber: 'P-2' }))
      await upsertTirePrice({
        tireId: t.id,
        validFrom: '2023-01-01',
        unitPriceNet: '10.00'
      })
      await upsertTirePrice({
        tireId: t.id,
        validFrom: '2024-06-01',
        unitPriceNet: '15.00'
      })
      await upsertTirePrice({
        tireId: t.id,
        validFrom: '2025-01-01',
        unitPriceNet: '20.00'
      })
      expect(
        Number((await getTirePriceAt(t.id, '2023-12-31'))?.unitPriceNet)
      ).toBe(10)
      expect(
        Number((await getTirePriceAt(t.id, '2024-12-31'))?.unitPriceNet)
      ).toBe(15)
      expect(
        Number((await getTirePriceAt(t.id, '2025-12-31'))?.unitPriceNet)
      ).toBe(20)
    })

    it('upsertTirePrice updates instead of duplicating at the same validFrom', async () => {
      const t = await createTire(baseTire({ articleNumber: 'P-3' }))
      const first = await upsertTirePrice({
        tireId: t.id,
        validFrom: '2025-01-01',
        unitPriceNet: '7.00'
      })
      const second = await upsertTirePrice({
        tireId: t.id,
        validFrom: '2025-01-01',
        unitPriceNet: '7.50'
      })
      expect(second.id).toBe(first.id)
      const hist = await listTirePriceHistory(t.id, 1, 25)
      expect(hist.total).toBe(1)
    })
  })

  describe('photos', () => {
    it('first uploaded photo is automatically promoted to isMain', async () => {
      const t = await createTire(baseTire({ articleNumber: 'PH-1' }))
      const photo = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'AAAA'
      })
      expect(photo.isMain).toBe(true)
      expect(photo.sortOrder).toBe(0)
    })

    it('second uploaded photo is not main', async () => {
      const t = await createTire(baseTire({ articleNumber: 'PH-2' }))
      await addTirePhoto({ tireId: t.id, mime: 'image/jpeg', data: 'A' })
      const second = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'B'
      })
      expect(second.isMain).toBe(false)
      expect(second.sortOrder).toBe(1)
    })

    it('setMainTirePhoto promotes the chosen photo and demotes the rest', async () => {
      const t = await createTire(baseTire({ articleNumber: 'PH-3' }))
      const first = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'A'
      })
      const second = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'B'
      })
      await setMainTirePhoto(second.id)
      const list = await listTirePhotos(t.id)
      const cur = Object.fromEntries(list.map((p) => [p.id, p.isMain]))
      expect(cur[first.id]).toBe(false)
      expect(cur[second.id]).toBe(true)
    })

    it('deleting the main photo promotes the next-oldest sibling', async () => {
      const t = await createTire(baseTire({ articleNumber: 'PH-4' }))
      const first = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'A'
      })
      const second = await addTirePhoto({
        tireId: t.id,
        mime: 'image/jpeg',
        data: 'B'
      })
      await deleteTirePhoto(first.id)
      const list = await listTirePhotos(t.id)
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(second.id)
      expect(list[0].isMain).toBe(true)
    })
  })

  describe('parseTireSize', () => {
    it('parses the standard slash form', () => {
      expect(parseTireSize('205/55R16')).toEqual({
        width: 205,
        aspectRatio: 55,
        construction: 'R',
        diameterInch: 16
      })
    })
    it('parses with spaces', () => {
      expect(parseTireSize(' 205 / 55 R 16 ')).toEqual({
        width: 205,
        aspectRatio: 55,
        construction: 'R',
        diameterInch: 16
      })
    })
    it('parses without explicit construction (defaults to R)', () => {
      expect(parseTireSize('205/55 16')?.construction).toBe('R')
    })
    it('returns null for nonsense', () => {
      expect(parseTireSize('not-a-size')).toBeNull()
    })
  })

  describe('listPublicTires / getPublicTire', () => {
    it('returns only online_sellable rows with the size label', async () => {
      const a = await createTire(
        baseTire({
          articleNumber: 'PUB-A',
          onlineSellable: true,
          unitPriceNet: '99.00'
        })
      )
      await createTire(
        baseTire({
          articleNumber: 'PUB-B',
          onlineSellable: false,
          unitPriceNet: '50.00'
        })
      )
      const rows = await listPublicTires()
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(a.id)
      expect(rows[0].sizeLabel).toBe('205/55R16')
    })

    it('filters listPublicTires by parsed size string', async () => {
      await createTire(
        baseTire({
          articleNumber: 'FZ-A',
          onlineSellable: true,
          width: 205,
          aspectRatio: 55,
          diameterInch: 16,
          unitPriceNet: '50.00'
        })
      )
      await createTire(
        baseTire({
          articleNumber: 'FZ-B',
          onlineSellable: true,
          width: 195,
          aspectRatio: 65,
          diameterInch: 15,
          unitPriceNet: '40.00'
        })
      )
      const res = await listPublicTires({ size: '205/55R16' })
      expect(res).toHaveLength(1)
      expect(res[0].articleNumber).toBe('FZ-A')
    })

    it('filters by maxPriceNet (current price)', async () => {
      const cheap = await createTire(
        baseTire({
          articleNumber: 'MX-A',
          onlineSellable: true,
          unitPriceNet: '40.00'
        })
      )
      await createTire(
        baseTire({
          articleNumber: 'MX-B',
          onlineSellable: true,
          unitPriceNet: '120.00'
        })
      )
      const res = await listPublicTires({ maxPriceNet: 50 })
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe(cheap.id)
    })

    it('getPublicTire returns null for non-online-sellable rows', async () => {
      const t = await createTire(
        baseTire({ articleNumber: 'NS-1', onlineSellable: false })
      )
      expect(await getPublicTire(t.id)).toBeNull()
    })

    it('getPublicTire returns photos when found', async () => {
      const t = await createTire(
        baseTire({
          articleNumber: 'NS-2',
          onlineSellable: true,
          unitPriceNet: '50.00'
        })
      )
      await addTirePhoto({ tireId: t.id, mime: 'image/jpeg', data: 'AAA' })
      const row = await getPublicTire(t.id)
      expect(row?.photos).toHaveLength(1)
      expect(row?.photos[0].data).toBe('AAA')
    })
  })
})
