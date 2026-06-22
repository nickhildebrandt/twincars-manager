/**
 * `POST /api/public/contact` — accept a free-form inquiry from the
 * public website. Bearer-token authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handleContactInquiry } from './endpoint'

export const POST: RequestHandler = publicApi(handleContactInquiry)
export const OPTIONS: RequestHandler = publicApi(handleContactInquiry)
