/**
 * Handler implementation for `GET /api/public/company`.
 *
 * Returns the workshop's public-facing identity card: legal/brand
 * name, tagline, address, contact data, optional geo coordinates and
 * the weekly opening-hours table mapped to English weekday strings.
 *
 * Data comes from `company_settings` plus `workshop_hours`. The
 * service that supplies workshop hours uses `weekday` numbers
 * (0 = Sunday … 6 = Saturday); we translate those into
 * `'sunday'..'saturday'` to keep the public envelope decoupled from
 * the internal representation.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { ok } from '$lib/server/public-api'
import { getSettings } from '$lib/server/services/settings-service'
import { listWorkshopHours } from '$lib/server/services/workshop-hours-service'

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const

export type PublicOpeningHour = {
  weekday: (typeof WEEKDAY_NAMES)[number]
  opensAt: string | null
  closesAt: string | null
  closed: boolean
}

export type PublicCompany = {
  legalName: string
  brandName: string
  tagline: string | null
  address: { street: string; zip: string; city: string; state: string }
  contact: {
    phone: string
    mobile: string | null
    email: string
    website: string | null
  }
  geo: { lat: number; lon: number } | null
  openingHours: PublicOpeningHour[]
}

export async function handlePublicCompany(
  _event: RequestEvent
): Promise<Response> {
  const settings = await getSettings()
  const hours = await listWorkshopHours()
  const openingHours: PublicOpeningHour[] = hours.map((h) => ({
    weekday: WEEKDAY_NAMES[h.weekday],
    opensAt: h.closed ? null : h.opensAt,
    closesAt: h.closed ? null : h.closesAt,
    closed: h.closed
  }))
  const geo =
    settings.geoLat != null && settings.geoLon != null
      ? { lat: Number(settings.geoLat), lon: Number(settings.geoLon) }
      : null
  const company: PublicCompany = {
    legalName: settings.companyName,
    brandName: settings.companyName,
    tagline: null,
    address: {
      street: settings.street,
      zip: settings.zip,
      city: settings.city,
      state: settings.state
    },
    contact: {
      phone: settings.phone,
      mobile: settings.mobile ?? null,
      email: settings.email,
      website: settings.website ?? null
    },
    geo,
    openingHours
  }
  return ok({ company })
}
