/**
 * `GET /api/public/services` — list of services exposed to the public
 * website. Bearer-token authenticated; wrapped by `publicApi` for
 * uniform CORS + error envelope. Implementation lives in
 * `./endpoint.ts` so tests can target the pure function.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicServices } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicServices)
export const OPTIONS: RequestHandler = publicApi(handlePublicServices)
