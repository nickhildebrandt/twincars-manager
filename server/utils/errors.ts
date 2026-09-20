/**
 * Every error the application produces is created here, so the user always
 * reads one clear German sentence and never an internal detail
 * (../../docs/rewrite/03-architektur.md §5.4).
 *
 * The predecessor guessed whether a message was German by looking for umlauts
 * and threw away correct messages that happened to have none (B-042). Nothing
 * is guessed here: a message either comes from this module or from a schema,
 * and both are German by construction.
 */
import { createError } from 'h3'

export type ErrorCode
  = | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'RATE_LIMITED'
    | 'INTERNAL'

export type ErrorPayload = {
  code: ErrorCode
  /** Field path → German message. Only present on 422. */
  fields?: Record<string, string>
}

const build = (
  statusCode: number,
  message: string,
  code: ErrorCode,
  fields?: Record<string, string>,
) =>
  createError({
    statusCode,
    statusMessage: message,
    message,
    data: { code, ...(fields ? { fields } : {}) } satisfies ErrorPayload,
  })

/** 400 — the request makes no sense, and the reason is safe to show. */
export const badRequest = (message: string) => build(400, message, 'BAD_REQUEST')

/** 401 — no session. The client turns this into a redirect to the login. */
export const unauthorized = (message = 'Bitte melden Sie sich an.') =>
  build(401, message, 'UNAUTHORIZED')

/** 403 — signed in, but the module permission is missing. */
export const forbidden = (message = 'Sie haben keine Berechtigung für diesen Bereich.') =>
  build(403, message, 'FORBIDDEN')

/** 404 — pass the entity in German: `notFound('Kunde')` → "Kunde nicht gefunden." */
export const notFound = (entity: string) =>
  build(404, `${entity} nicht gefunden.`, 'NOT_FOUND')

/** 409 — the request is well formed but conflicts with the current state. */
export const conflict = (message: string) => build(409, message, 'CONFLICT')

/** 422 — input failed validation; `fields` is shown directly at the inputs. */
export const validationFailed = (
  fields: Record<string, string>,
  message = 'Bitte prüfen Sie Ihre Eingaben.',
) => build(422, message, 'VALIDATION_FAILED', fields)

/** 429 — too many requests. */
export const tooManyRequests = (
  message = 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
) => build(429, message, 'RATE_LIMITED')

/** The only message a 5xx ever shows. Details stay in the server log. */
export const INTERNAL_MESSAGE = 'Ein interner Fehler ist aufgetreten.'

/** Fallback for a 4xx that carries no curated message of its own. */
export const UNKNOWN_CLIENT_MESSAGE = 'Die Anfrage konnte nicht bearbeitet werden.'

/** True when the error was produced by one of the helpers above. */
export function isCuratedError(error: unknown): boolean {
  const data = (error as { data?: unknown })?.data
  return Boolean(
    data
    && typeof data === 'object'
    && typeof (data as ErrorPayload).code === 'string',
  )
}
