/**
 * `POST /api/public/orders` — accept an order from the external
 * storefront. Bearer-token authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicOrder } from './endpoint'

export const POST: RequestHandler = publicApi(handlePublicOrder)
export const OPTIONS: RequestHandler = publicApi(handlePublicOrder)
