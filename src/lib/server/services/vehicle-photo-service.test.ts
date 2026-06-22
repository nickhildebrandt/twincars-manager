import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  addVehiclePhoto,
  deleteVehiclePhoto,
  listVehiclePhotos,
  setMainVehiclePhoto
} from './vehicle-photo-service'
import { db } from '$lib/server/db/client'
import { vehiclePhotos, vehicles } from '$lib/server/db/schema'

/**
 * Integration tests for the vehicle-photo service — add, list,
 * cover-flag handling, delete-with-promotion.
 *
 * @group integration
 * @module vehicle-photo-service
 */
describe('vehicle-photo-service', () => {
  let vehicleId: string
  let otherVehicleId: string

  // Tiny base64 data-URL stand-in. The service is storage-agnostic; we
  // only need a non-empty payload to exercise round-trip behaviour.
  const dataUrl = (label: string): string =>
    `data:image/png;base64,${Buffer.from(label).toString('base64')}`

  beforeEach(async () => {
    await db.delete(vehiclePhotos)
    await db.delete(vehicles)
    const [v1] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf' })
      .returning()
    const [v2] = await db
      .insert(vehicles)
      .values({ make: 'BMW', model: '320i' })
      .returning()
    vehicleId = v1.id
    otherVehicleId = v2.id
  })

  describe('addVehiclePhoto', () => {
    it('persists the first photo and promotes it to main', async () => {
      const photo = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('one')
      })
      expect(photo.id).toBeTruthy()
      expect(photo.isMain).toBe(true)
      expect(photo.sortOrder).toBe(0)
    })

    it('appends further photos with incrementing sortOrder and no isMain flip', async () => {
      const first = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('one')
      })
      const second = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('two')
      })
      const third = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('three')
      })
      expect(first.isMain).toBe(true)
      expect(second.isMain).toBe(false)
      expect(third.isMain).toBe(false)
      expect([first.sortOrder, second.sortOrder, third.sortOrder]).toEqual([
        0, 1, 2
      ])
    })

    it('scopes the first-photo promotion per vehicle', async () => {
      await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('first-of-vehicle-1')
      })
      const otherFirst = await addVehiclePhoto({
        vehicleId: otherVehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('first-of-vehicle-2')
      })
      expect(otherFirst.isMain).toBe(true)
      expect(otherFirst.sortOrder).toBe(0)
    })
  })

  describe('listVehiclePhotos', () => {
    it('returns photos for the given vehicle sorted by sortOrder', async () => {
      await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('a')
      })
      await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('b')
      })
      await addVehiclePhoto({
        vehicleId: otherVehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('foreign')
      })
      const list = await listVehiclePhotos(vehicleId)
      expect(list).toHaveLength(2)
      expect(list[0].sortOrder).toBe(0)
      expect(list[1].sortOrder).toBe(1)
    })

    it('returns an empty array when the vehicle has no photos', async () => {
      const list = await listVehiclePhotos(otherVehicleId)
      expect(list).toEqual([])
    })
  })

  describe('setMainVehiclePhoto', () => {
    it('flips the cover flag to the chosen photo and clears the others', async () => {
      const a = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('a')
      })
      const b = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('b')
      })
      await setMainVehiclePhoto(b.id)
      const list = await listVehiclePhotos(vehicleId)
      const byId = new Map(list.map((p) => [p.id, p]))
      expect(byId.get(a.id)?.isMain).toBe(false)
      expect(byId.get(b.id)?.isMain).toBe(true)
    })

    it('throws when the photo does not exist', async () => {
      await expect(
        setMainVehiclePhoto('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Foto nicht gefunden.')
    })
  })

  describe('deleteVehiclePhoto', () => {
    it('removes the row', async () => {
      const photo = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('a')
      })
      await deleteVehiclePhoto(photo.id)
      const list = await listVehiclePhotos(vehicleId)
      expect(list).toEqual([])
    })

    it('promotes the next-oldest photo to main when the main one is deleted', async () => {
      const a = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('a')
      })
      const b = await addVehiclePhoto({
        vehicleId,
        mime: 'image/png',
        dataUrl: dataUrl('b')
      })
      await deleteVehiclePhoto(a.id)
      const list = await listVehiclePhotos(vehicleId)
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(b.id)
      expect(list[0].isMain).toBe(true)
    })

    it('does nothing when the id is unknown', async () => {
      await expect(
        deleteVehiclePhoto('00000000-0000-0000-0000-000000000000')
      ).resolves.toBeUndefined()
    })
  })
})
