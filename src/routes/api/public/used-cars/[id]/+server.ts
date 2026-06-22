/**
 * `GET /api/public/used-cars/:id` — vehicle detail for one inventory
 * vehicle. Bearer-token authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicUsedCarDetail } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicUsedCarDetail)
export const OPTIONS: RequestHandler = publicApi(handlePublicUsedCarDetail)
