import { query, getRequestEvent } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { eq } from 'drizzle-orm'
import { idSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { db } from '$lib/server/db/client'
import {
  vehicleListings,
  vehiclePhotos,
  type VehiclePhoto
} from '$lib/server/db/schema'
import { getVehicle } from '$lib/server/services/vehicle-service'
import { getSettings } from '$lib/server/services/settings-service'
import { renderVehicleSaleSignPdf } from '$lib/server/services/pdf-service'

/**
 * Streams an A4-landscape "ZUM VERKAUF"-Schild for a vehicle. Used
 * from both the vehicle detail page (for stock cars) and the
 * inventory detail (which shares the same `/vehicles/[id]` route).
 *
 * The QR payload is `{origin}/inventory/<id>` — a phone scan deep-
 * links into the inventory listing so prospective buyers see the
 * same data online as on the printed sign.
 *
 * Marketing highlights come from `vehicle_listings.highlights`; if
 * the row doesn't exist (freshly added stock car) we skip the
 * highlights block entirely.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleSaleSignPdfRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('vehicles')

    const vehicle = await getVehicle(id)
    if (!vehicle) error(404, 'Fahrzeug nicht gefunden.')

    const [listing] = await db
      .select()
      .from(vehicleListings)
      .where(eq(vehicleListings.vehicleId, id))
      .limit(1)

    // Pull the marked cover photo if any. We don't fall back to "first
    // photo" here on purpose — the user explicitly picks the cover via
    // setMainVehiclePhoto, and that's what should appear on the sign.
    let coverPhoto: VehiclePhoto | null = null
    const photos = await db
      .select()
      .from(vehiclePhotos)
      .where(eq(vehiclePhotos.vehicleId, id))
    coverPhoto =
      photos.find((p) => p.isMain) ?? (photos.length > 0 ? photos[0] : null)

    const settings = await getSettings()
    const event = getRequestEvent()
    const origin = event.url.origin
    const qrPayload = `${origin}/inventory/${id}`

    const bytes = await renderVehicleSaleSignPdf({
      vehicle,
      coverPhoto,
      salesPriceGross: listing?.salesPriceGross
        ? Number(listing.salesPriceGross)
        : null,
      differentialTax: listing?.differentialTax ?? false,
      salesNotes: listing?.highlights ?? null,
      qrPayload,
      settings
    })

    const safeLabel =
      `${vehicle.make ?? ''}_${vehicle.model ?? ''}`
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '_') || 'Fahrzeug'
    const filename = `Verkaufsschild_${safeLabel}.pdf`
    return {
      filename,
      mime: 'application/pdf',
      data: Buffer.from(bytes).toString('base64')
    }
  }
)
