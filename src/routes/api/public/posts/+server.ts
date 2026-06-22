/**
 * `GET /api/public/posts` — paginated list of published news posts for
 * the public website. Bearer-token authenticated; wrapped by
 * `publicApi` for uniform CORS + error envelope. Implementation lives
 * in `./endpoint.ts` so tests can target the pure function.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handlePublicPosts } from './endpoint'

export const GET: RequestHandler = publicApi(handlePublicPosts)
export const OPTIONS: RequestHandler = publicApi(handlePublicPosts)
