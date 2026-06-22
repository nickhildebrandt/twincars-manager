/**
 * `GET /api/public/used-cars` — used-car inventory exposed to the
 * public website. Bearer authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicUsedCars } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicUsedCars)
export const OPTIONS: RequestHandler = publicApi(handlePublicUsedCars)
