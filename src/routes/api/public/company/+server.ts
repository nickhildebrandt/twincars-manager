/**
 * `GET /api/public/company` — workshop identity card for the public
 * website. Bearer-token authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicCompany } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicCompany)
export const OPTIONS: RequestHandler = publicApi(handlePublicCompany)
