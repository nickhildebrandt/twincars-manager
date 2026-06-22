/**
 * Handler implementation for `GET /api/public/tires/:id`.
 *
 * Validates the path parameter as a UUID and returns the same flat
 * `PublicTire` projection as the list endpoint, wrapped in a `{ tire }`
 * envelope. 404 when the id is unknown or not flagged online-sellable.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { parse, pipe, string, trim, uuid, ValiError } from 'valibot'
import { fail, ok } from '$lib/server/public-api'
import { getPublicTire } from '$lib/server/services/tire-service'
import { toPublicTire, type PublicTire } from '../endpoint'

const idSchema = pipe(string(), trim(), uuid('id must be a valid UUID.'))

export async function handlePublicTireDetail(
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
  const row = await getPublicTire(id)
  if (!row) {
    fail(404, 'Tire not found.')
  }
  const tire: PublicTire = toPublicTire(row)
  return ok({ tire })
}
