/**
 * Handler implementation for `GET /api/public/tires`.
 *
 * Reads from the dedicated `tires` catalogue (since Migration 0022 —
 * no more JSONB attributes). Every EU-Reifenkennzeichnung field is a
 * real column, so size / season / brand filters use proper indexes.
 *
 * Supports the following query parameters (all optional):
 *  - `q` — case-insensitive search across brand / model / articleNumber
 *  - `size` — exact match parsed into width/aspectRatio/construction/
 *    diameterInch (accepts `205/55R16`, `205/55 R16`, …)
 *  - `season` — exact equality on `tires.season`
 *    (`Sommer` | `Winter` | `Ganzjahres`, case-sensitive)
 *  - `brand` — exact equality on `tires.brand`
 *  - `maxPriceNet` — upper bound on the currently valid tire price
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { fail, ok } from '$lib/server/public-api'
import {
  listPublicTires,
  type PublicTireFilters,
  type PublicTireRow
} from '$lib/server/services/tire-service'
import type { TireSeason as CatalogTireSeason } from '$lib/server/db/schema'

export type TireSeason = CatalogTireSeason

export type PublicTire = {
  id: string
  articleNumber: string
  description: string | null
  brand: string
  model: string
  width: number
  aspectRatio: number
  construction: string
  diameterInch: number
  sizeLabel: string
  loadIndex: string | null
  speedIndex: string | null
  season: TireSeason
  ean: string | null
  manufacturerPartNumber: string | null
  fuelEfficiency: string | null
  wetGrip: string | null
  noiseClass: string | null
  noiseDb: number | null
  runFlat: boolean
  reinforced: boolean
  studdedWinter: boolean
  mSMarking: boolean
  snowFlake: boolean
  evCertified: boolean
  currentPriceNet: number | null
  photos: Array<{ mime: string; url: string }>
  shippingOptionId: string | null
}

const parseMaxPriceNet = (raw: string | null): number | undefined => {
  if (raw == null || raw.length === 0) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    fail(400, 'maxPriceNet must be a non-negative number.')
  }
  return n
}

/**
 * Project a `PublicTireRow` into the flat `PublicTire` shape. Shared
 * with the detail endpoint.
 */
export function toPublicTire(row: PublicTireRow): PublicTire {
  return {
    id: row.id,
    articleNumber: row.articleNumber,
    description: row.description ?? null,
    brand: row.brand,
    model: row.model,
    width: row.width,
    aspectRatio: row.aspectRatio,
    construction: row.construction,
    diameterInch: row.diameterInch,
    sizeLabel: row.sizeLabel,
    loadIndex: row.loadIndex ?? null,
    speedIndex: row.speedIndex ?? null,
    season: row.season as TireSeason,
    ean: row.ean ?? null,
    manufacturerPartNumber: row.manufacturerPartNumber ?? null,
    fuelEfficiency: row.fuelEfficiency ?? null,
    wetGrip: row.wetGrip ?? null,
    noiseClass: row.noiseClass ?? null,
    noiseDb: row.noiseDb ?? null,
    runFlat: row.runFlat,
    reinforced: row.reinforced,
    studdedWinter: row.studdedWinter,
    mSMarking: row.mSMarking,
    snowFlake: row.snowFlake,
    evCertified: row.evCertified,
    currentPriceNet: row.unitPriceNet == null ? null : Number(row.unitPriceNet),
    photos: row.photos.map((p) => ({ mime: p.mime, url: p.data })),
    shippingOptionId: row.shippingOptionId ?? null
  }
}

export async function handlePublicTires(
  event: RequestEvent
): Promise<Response> {
  const url = event.url
  const filters: PublicTireFilters = {
    q: url.searchParams.get('q') ?? undefined,
    size: url.searchParams.get('size') ?? undefined,
    season: url.searchParams.get('season') ?? undefined,
    brand: url.searchParams.get('brand') ?? undefined,
    maxPriceNet: parseMaxPriceNet(url.searchParams.get('maxPriceNet'))
  }
  const rows = await listPublicTires(filters)
  const tires: PublicTire[] = rows.map(toPublicTire)
  return ok({ tires })
}
