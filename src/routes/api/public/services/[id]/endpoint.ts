/**
 * Handler implementation for `GET /api/public/services/:id`.
 *
 * Validates the path parameter as a UUID and returns one service item
 * (`kind = 'service'`) wrapped in a `{ service }` envelope. 404 when the
 * id is unknown or the row is not a service.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { parse, pipe, string, trim, uuid, ValiError } from 'valibot'
import { fail, ok } from '$lib/server/public-api'
import { getItem } from '$lib/server/services/item-service'
import type { PublicService } from '../endpoint'

const idSchema = pipe(string(), trim(), uuid('id must be a valid UUID.'))

export async function handlePublicServiceDetail(
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
  const row = await getItem(id)
  if (!row || row.kind !== 'service') {
    fail(404, 'Service not found.')
  }
  const service: PublicService = {
    id: row.id,
    articleNumber: row.articleNumber,
    description: row.description,
    unit: row.unit ?? null,
    currentPriceNet: row.unitPriceNet == null ? null : Number(row.unitPriceNet),
    onlineBookable: row.onlineBookable,
    attributes: {}
  }
  return ok({ service })
}
