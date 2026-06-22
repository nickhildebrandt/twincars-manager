/**
 * `GET /api/public/free-slots` — workshop slot availability. Bearer
 * authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicFreeSlots } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicFreeSlots)
export const OPTIONS: RequestHandler = publicApi(handlePublicFreeSlots)
