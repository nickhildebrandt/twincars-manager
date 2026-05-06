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
 */

import { asc, count as sqlCount, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { vehiclePhotos, type VehiclePhoto } from '$lib/server/db/schema'

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
 */
export const addVehiclePhoto = async (
  input: AddVehiclePhotoInput
): Promise<VehiclePhoto> => {
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
  if (!photo) throw new Error('Foto nicht gefunden.')
  await db
    .update(vehiclePhotos)
    .set({ isMain: false })
    .where(eq(vehiclePhotos.vehicleId, photo.vehicleId))
  await db
    .update(vehiclePhotos)
    .set({ isMain: true })
    .where(eq(vehiclePhotos.id, id))
}
