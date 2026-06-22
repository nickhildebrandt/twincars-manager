import { json, error, type RequestEvent } from '@sveltejs/kit'
import { authenticateRequest } from './api-tokens'
import { rateLimit } from './rate-limit'

/** Per-token allowance for the public API (calls per minute). */
const PUBLIC_API_RATE_PER_MINUTE = 120

/**
 * Shape returned by every public-API handler. Wrapping every payload
 * in `{ data }` (and the error path in `{ error }`) gives consumers a
 * predictable envelope that doesn't conflict with the underlying
 * domain shape if it ever needs metadata (`meta`, pagination, …) and
 * makes accidental "naked object" leaks (where the response body IS
 * the row) impossible.
 */
export type PublicApiOk<T> = { data: T }
export type PublicApiErr = { error: { code: string; message: string } }

/**
 * Authentication wrapper for public-API `+server.ts` handlers.
 *
 * Usage:
 *
 *   export const GET: RequestHandler = publicApi(async ({ request }) => {
 *     const items = await listOnlineSellableItems()
 *     return json({ data: items })
 *   })
 *
 * The wrapper:
 *   - Reads the `Authorization: Bearer …` header.
 *   - Verifies the token against the `API_TOKENS` env-var list.
 *   - On failure, returns `401 { error: { code, message } }` — never
 *     leaks whether the token was unknown vs malformed.
 *   - On success, attaches a short prefix descriptor to
 *     `event.locals.apiToken` for the handler's use (rate-limiting /
 *     audit logging). The full token is never exposed downstream.
 *
 * `OPTIONS` requests bypass auth (preflight CORS handshake); the
 * actual request behind it still requires Bearer.
 */
export function publicApi(
  handler: (event: RequestEvent) => Promise<Response>
): (event: RequestEvent) => Promise<Response> {
  return async (event) => {
    if (event.request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(event) })
    }
    const auth = await authenticateRequest(event.request)
    if (!auth) {
      return json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid Bearer token.'
          }
        } satisfies PublicApiErr,
        { status: 401, headers: corsHeaders(event) }
      )
    }
    // Per-token throttle. Runs AFTER successful authentication so an
    // unauthenticated attacker cannot exhaust a budget that legitimate
    // clients depend on. The bucket key uses the (short) token prefix
    // — never the raw secret — so changing the env-configured token
    // list naturally starts a clean budget for the new token.
    const limit = rateLimit(`public:${auth.tokenPrefix}`, {
      perMinute: PUBLIC_API_RATE_PER_MINUTE
    })
    if (!limit.allowed) {
      const headers = new Headers(corsHeaders(event))
      headers.set('Retry-After', String(limit.retryAfter ?? 60))
      return json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded. Please retry later.'
          }
        } satisfies PublicApiErr,
        { status: 429, headers }
      )
    }
    // Stash the token descriptor on locals via a non-typed prop so
    // consumers can log it; we deliberately don't declare it on
    // App.Locals because the public API is its own surface area, not
    // part of the session-authenticated app.
    ;(event.locals as { apiToken?: { tokenPrefix: string } }).apiToken = auth

    try {
      const res = await handler(event)
      const headers = new Headers(res.headers)
      for (const [k, v] of Object.entries(corsHeaders(event))) {
        headers.set(k, v)
      }
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers
      })
    } catch (err) {
      // Never leak stack traces / SQL through the public API.
      if (
        typeof err === 'object' &&
        err &&
        'status' in err &&
        typeof (err as { status?: number }).status === 'number'
      ) {
        const httpErr = err as { status: number; body?: { message?: string } }
        return json(
          {
            error: {
              code: codeForStatus(httpErr.status),
              message:
                httpErr.body?.message ?? 'Request could not be processed.'
            }
          } satisfies PublicApiErr,
          { status: httpErr.status, headers: corsHeaders(event) }
        )
      }
      console.error('[public-api]', err)
      return json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal error occurred.'
          }
        } satisfies PublicApiErr,
        { status: 500, headers: corsHeaders(event) }
      )
    }
  }
}

function corsHeaders(_event: RequestEvent): Record<string, string> {
  // Open CORS for now — the public API is intended for the external
  // workshop website. Tighten via env config in production.
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600'
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'UNPROCESSABLE_ENTITY'
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'
  }
}

/** Tiny helper to build a typed-ok response. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return json({ data } satisfies PublicApiOk<T>, init)
}

/**
 * Throw a SvelteKit `error()` from inside a public-API handler. The
 * wrapper catches it and converts to the standard JSON envelope.
 */
export function fail(status: number, message: string): never {
  error(status, message)
}
