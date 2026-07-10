/**
 * Vehicle photo service — list, add, delete, set-main.
 *
 * Storage: photos are kept inline as base64 data URLs in the
 * `vehicle_photos.data_url` column. Typical Werkstatt photos are
 * resized client-side before upload, so a few hundred KB per row is
 * normal. We don't have an image CDN; this keeps backups simple.
 *
 * Sort: `sortOrder` controls display order; `isMain` flags the cover
 * image used in lists / vehicle picker thumbnails.
 *
 * Invariant: photos are LISTING artifacts and exist only for stock
 * vehicles (`customer_id IS NULL`). {@link addVehiclePhoto} enforces
 * this with a curated 409; the sale flow
 * (`sellStockVehicleToCustomer`) deletes the gallery when the car is
 * sold, so a later Ankauf starts with a fresh, empty gallery. Listing
 * photos of a vehicle is deliberately NOT guarded — it simply returns
 * whatever rows exist (usually none for customer cars), so detail
 * pages of sold vehicles keep rendering without errors.
 */

import { error } from '@sveltejs/kit'
import { asc, count as sqlCount, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  vehiclePhotos,
  vehicles,
  type VehiclePhoto
} from '$lib/server/db/schema'

export const listVehiclePhotos = async (
  vehicleId: string
): Promise<VehiclePhoto[]> =>
  db
    .select()
    .from(vehiclePhotos)
    .where(eq(vehiclePhotos.vehicleId, vehicleId))
    .orderBy(asc(vehiclePhotos.sortOrder), asc(vehiclePhotos.createdAt))

export type AddVehiclePhotoInput = {
  vehicleId: string
  mime: string
  dataUrl: string
}

/**
 * Append a new photo. The first photo on a vehicle is automatically
 * promoted to `isMain` so list views always have a thumbnail.
 *
 * Guarded: photos can only be attached to STOCK vehicles
 * (`customer_id IS NULL`) — a curated 404/409 rejects unknown or
 * customer-owned vehicles, no matter which caller (remote, import)
 * reaches this.
 */
export const addVehiclePhoto = async (
  input: AddVehiclePhotoInput
): Promise<VehiclePhoto> => {
  const [vehicle] = await db
    .select({ customerId: vehicles.customerId })
    .from(vehicles)
    .where(eq(vehicles.id, input.vehicleId))
    .limit(1)
  if (!vehicle) error(404, 'Fahrzeug nicht gefunden.')
  if (vehicle.customerId !== null)
    error(409, 'Fotos können nur bei Verkaufsfahrzeugen hinterlegt werden.')
  const [{ value }] = await db
    .select({ value: sqlCount() })
    .from(vehiclePhotos)
    .where(eq(vehiclePhotos.vehicleId, input.vehicleId))
  const count = Number(value)
  const isFirst = count === 0
  const [row] = await db
    .insert(vehiclePhotos)
    .values({
      vehicleId: input.vehicleId,
      mime: input.mime,
      dataUrl: input.dataUrl,
      isMain: isFirst,
      sortOrder: Number(count)
    })
    .returning()
  return row
}

export const deleteVehiclePhoto = async (id: string): Promise<void> => {
  // If the deleted photo was the main one, promote the next-oldest
  // photo so the vehicle never ends up without a cover.
  const [photo] = await db
    .select()
    .from(vehiclePhotos)
    .where(eq(vehiclePhotos.id, id))
    .limit(1)
  if (!photo) return
  await db.delete(vehiclePhotos).where(eq(vehiclePhotos.id, id))
  if (photo.isMain) {
    const [next] = await db
      .select()
      .from(vehiclePhotos)
      .where(eq(vehiclePhotos.vehicleId, photo.vehicleId))
      .orderBy(asc(vehiclePhotos.sortOrder), asc(vehiclePhotos.createdAt))
      .limit(1)
    if (next) {
      await db
        .update(vehiclePhotos)
        .set({ isMain: true })
        .where(eq(vehiclePhotos.id, next.id))
    }
  }
}

export const setMainVehiclePhoto = async (id: string): Promise<void> => {
  const [photo] = await db
    .select()
    .from(vehiclePhotos)
    .where(eq(vehiclePhotos.id, id))
    .limit(1)
  if (!photo) error(404, 'Foto nicht gefunden.')
  await db
    .update(vehiclePhotos)
    .set({ isMain: false })
    .where(eq(vehiclePhotos.vehicleId, photo.vehicleId))
  await db
    .update(vehiclePhotos)
    .set({ isMain: true })
    .where(eq(vehiclePhotos.id, id))
}
