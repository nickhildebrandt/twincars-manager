/**
 * Handler implementation for `GET /api/public/services`. Lives next
 * to the `+server.ts` so tests can import the bare async function
 * without paying for SvelteKit's `init_remote_functions` boot.
 *
 * Services no longer carry a free-form `attributes` map — that JSONB
 * column was dropped in Migration 0022. The projection keeps the key
 * for backwards compatibility with the external website, but always
 * emits an empty object.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { ok } from '$lib/server/public-api'
import { listPublicServices } from '$lib/server/services/item-service'

export type PublicService = {
  id: string
  articleNumber: string
  description: string
  unit: string | null
  currentPriceNet: number | null
  attributes: Record<string, unknown>
}

export async function handlePublicServices(
  _event: RequestEvent
): Promise<Response> {
  const rows = await listPublicServices()
  const services: PublicService[] = rows.map((r) => ({
    id: r.id,
    articleNumber: r.articleNumber,
    description: r.description,
    unit: r.unit ?? null,
    currentPriceNet: r.unitPriceNet == null ? null : Number(r.unitPriceNet),
    attributes: {}
  }))
  return ok({ services })
}
