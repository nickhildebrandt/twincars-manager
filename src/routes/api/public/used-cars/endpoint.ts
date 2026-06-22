/**
 * Handler implementation for `GET /api/public/used-cars`.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { ok } from '$lib/server/public-api'
import { listPublicUsedCars } from '$lib/server/services/vehicle-service'

export async function handlePublicUsedCars(
  _event: RequestEvent
): Promise<Response> {
  const vehicles = await listPublicUsedCars()
  return ok({ vehicles })
}
