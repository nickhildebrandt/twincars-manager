/**
 * `GET /api/public/posts/:slug` — single published news post detail.
 * Bearer-token authenticated; wrapped by `publicApi`. Implementation
 * lives in `./endpoint.ts` so tests can target the pure function.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicPostDetail } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicPostDetail)
export const OPTIONS: RequestHandler = publicApi(handlePublicPostDetail)
