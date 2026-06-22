/**
 * Handler implementation for `GET /api/public/free-slots`.
 *
 * Query parameters:
 *   - `from` ISO datetime (inclusive lower bound)
 *   - `to`   ISO datetime (inclusive upper bound)
 *   - `durationMinutes` integer in [5..480], default 30
 *   - `service` optional service id; if present and the item has
 *     `attributes.durationMinutes`, it overrides the query param.
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { fail, ok } from '$lib/server/public-api'
import { findFreeSlots } from '$lib/server/services/public-api-service'
import { getItem } from '$lib/server/services/item-service'

const MAX_DURATION_MINUTES = 480

const parseIsoDate = (value: string | null, label: string): Date => {
  if (!value) fail(400, `Query parameter "${label}" is required.`)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    fail(400, `Query parameter "${label}" is not a valid ISO datetime.`)
  }
  return d
}

const parseDuration = (value: string | null): number => {
  if (!value) return 30
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    fail(400, 'durationMinutes must be a positive integer.')
  }
  if (n > MAX_DURATION_MINUTES) {
    fail(400, `durationMinutes may not exceed ${MAX_DURATION_MINUTES}.`)
  }
  return n
}

export async function handlePublicFreeSlots(
  event: RequestEvent
): Promise<Response> {
  const url = event.url
  const from = parseIsoDate(url.searchParams.get('from'), 'from')
  const to = parseIsoDate(url.searchParams.get('to'), 'to')
  let durationMinutes = parseDuration(url.searchParams.get('durationMinutes'))

  // Free slots are only offered for online-bookable services (TwinCast:
  // tire change), matching the booking endpoint. A non-bookable / unknown
  // service is rejected so the website can't show slots for something it
  // can't actually book.
  const serviceId = url.searchParams.get('service')
  if (serviceId) {
    const service = await getItem(serviceId)
    if (!service || service.kind !== 'service') {
      fail(404, 'Service not found.')
    }
    if (!service.onlineBookable) {
      fail(
        400,
        'This service is not available for online booking; please arrange it by phone.'
      )
    }
    // Migration 0022 dropped the JSONB `attributes` column; the caller
    // supplies `durationMinutes` via the query parameter.
  }

  let slots
  try {
    slots = await findFreeSlots({ from, to, durationMinutes })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (/60 days/.test(msg)) {
      fail(400, 'Range may not exceed 60 days.')
    }
    if (/>= from/.test(msg)) {
      fail(400, '"to" must be greater than or equal to "from".')
    }
    if (/positive/.test(msg)) {
      fail(400, 'durationMinutes must be positive.')
    }
    throw err
  }
  return ok({
    slots: slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString()
    }))
  })
}
