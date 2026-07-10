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
import { customers, vehiclePhotos, vehicles } from '$lib/server/db/schema'

/**
 * Integration tests for the vehicle-photo service — add, list,
 * cover-flag handling, delete-with-promotion, plus the
 * stock-vehicle-only guard (photos exist only while
 * `customer_id IS NULL`).
 *
 * @group integration
 * @module vehicle-photo-service
 */
describe('vehicle-photo-service', () => {
  let vehicleId: string
  let otherVehicleId: string
  let customerVehicleId: string

  // Tiny base64 data-URL stand-in. The service is storage-agnostic; we
  // only need a non-empty payload to exercise round-trip behaviour.
  const dataUrl = (label: string): string =>
    `data:image/png;base64,${Buffer.from(label).toString('base64')}`

  beforeEach(async () => {
    await db.delete(vehiclePhotos)
    await db.delete(vehicles)
    await db.delete(customers)
    const [owner] = await db
      .insert(customers)
      .values({ customerNumber: 'KU-PH001', lastName: 'Fotohalter' })
      .returning()
    const [v1] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf' })
      .returning()
    const [v2] = await db
      .insert(vehicles)
      .values({ make: 'BMW', model: '320i' })
      .returning()
    const [v3] = await db
      .insert(vehicles)
      .values({ make: 'Audi', model: 'A4', customerId: owner.id })
      .returning()
    vehicleId = v1.id
    otherVehicleId = v2.id
    customerVehicleId = v3.id
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

    it('rejects a customer-owned vehicle with a curated 409', async () => {
      await expect(
        addVehiclePhoto({
          vehicleId: customerVehicleId,
          mime: 'image/png',
          dataUrl: dataUrl('forbidden')
        })
      ).rejects.toMatchObject({
        status: 409,
        body: {
          message: 'Fotos können nur bei Verkaufsfahrzeugen hinterlegt werden.'
        }
      })
      // Nothing persisted.
      expect(await listVehiclePhotos(customerVehicleId)).toEqual([])
    })

    it('rejects an unknown vehicle with a curated 404', async () => {
      await expect(
        addVehiclePhoto({
          vehicleId: '00000000-0000-0000-0000-000000000000',
          mime: 'image/png',
          dataUrl: dataUrl('nowhere')
        })
      ).rejects.toMatchObject({
        status: 404,
        body: { message: 'Fahrzeug nicht gefunden.' }
      })
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

    it('stays readable for customer-owned vehicles (no guard on list)', async () => {
      // Listing is deliberately unguarded so the detail page of a sold
      // vehicle keeps rendering; legacy rows (pre-migration-0035) are
      // returned as-is.
      await db
        .insert(vehiclePhotos)
        .values({
          vehicleId: customerVehicleId,
          mime: 'image/png',
          dataUrl: dataUrl('legacy'),
          isMain: true
        })
      const list = await listVehiclePhotos(customerVehicleId)
      expect(list).toHaveLength(1)
      expect(await listVehiclePhotos(vehicleId)).toEqual([])
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

    it('throws a curated 404 when the photo does not exist', async () => {
      await expect(
        setMainVehiclePhoto('00000000-0000-0000-0000-000000000000')
      ).rejects.toMatchObject({
        status: 404,
        body: { message: 'Foto nicht gefunden.' }
      })
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
