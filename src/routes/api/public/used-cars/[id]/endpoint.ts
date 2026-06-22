/**
 * Handler implementation for `GET /api/public/used-cars/:id`.
 *
 * Validates the path parameter as a UUID and returns the same
 * `PublicUsedCar` projection used by the list endpoint, wrapped in a
 * `{ vehicle }` envelope. Returns 404 when the id is unknown or the
 * vehicle is not eligible for the public listing (archived, owned by a
 * customer, or already sold).
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { parse, pipe, string, trim, uuid, ValiError } from 'valibot'
import { fail, ok } from '$lib/server/public-api'
import { getPublicUsedCar } from '$lib/server/services/vehicle-service'

const idSchema = pipe(string(), trim(), uuid('id must be a valid UUID.'))

export async function handlePublicUsedCarDetail(
  event: RequestEvent
): Promise<Response> {
  let id: string
  try {
    id = parse(idSchema, event.params.id ?? '')
  } catch (err) {
    if (err instanceof ValiError) {
      fail(400, err.issues[0].message)
    }
    throw err
  }
  const vehicle = await getPublicUsedCar(id)
  if (!vehicle) {
    fail(404, 'Vehicle not found.')
  }
  return ok({ vehicle })
}
