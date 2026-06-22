/**
 * `GET /api/public/services/:id` — single service detail. Bearer-token
 * authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicServiceDetail } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicServiceDetail)
export const OPTIONS: RequestHandler = publicApi(handlePublicServiceDetail)
