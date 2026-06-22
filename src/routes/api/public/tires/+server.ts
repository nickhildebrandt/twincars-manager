/**
 * `GET /api/public/tires` — list of online-sellable tires. Bearer
 * authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicTires } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicTires)
export const OPTIONS: RequestHandler = publicApi(handlePublicTires)
