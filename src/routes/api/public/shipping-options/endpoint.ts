/**
 * Handler implementation for `GET /api/public/shipping-options`.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { ok } from '$lib/server/public-api'
import { listActiveShippingOptions } from '$lib/server/services/shipping-option-service'

export type PublicShippingOption = {
  id: string
  name: string
  description: string | null
  priceNet: number
  freeAboveNet: number | null
}

export async function handlePublicShippingOptions(
  _event: RequestEvent
): Promise<Response> {
  const rows = await listActiveShippingOptions()
  const options: PublicShippingOption[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    priceNet: Number(r.priceNet),
    freeAboveNet: r.freeAboveNet == null ? null : Number(r.freeAboveNet)
  }))
  return ok({ options })
}
