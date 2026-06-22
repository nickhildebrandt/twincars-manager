/**
 * `POST /api/public/appointments` — book a workshop appointment.
 * Bearer authenticated.
 *
 * @group integration
 * @module public-api
 */
import type { RequestHandler } from './$types'
import { publicApi } from '$lib/server/public-api'
import { handleBookAppointment } from './endpoint'

export const POST: RequestHandler = publicApi(handleBookAppointment)
export const OPTIONS: RequestHandler = publicApi(handleBookAppointment)
