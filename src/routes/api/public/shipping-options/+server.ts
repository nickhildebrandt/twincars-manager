/**
 * `GET /api/public/shipping-options` — public list of shipping
 * options. Bearer authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicShippingOptions } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicShippingOptions)
export const OPTIONS: RequestHandler = publicApi(handlePublicShippingOptions)
