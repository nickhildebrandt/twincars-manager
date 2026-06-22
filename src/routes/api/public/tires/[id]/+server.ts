/**
 * `GET /api/public/tires/:id` — single online-sellable tire.
 * Bearer-token authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicTireDetail } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicTireDetail)
export const OPTIONS: RequestHandler = publicApi(handlePublicTireDetail)
