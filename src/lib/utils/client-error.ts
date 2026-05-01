import { isHttpError } from '@sveltejs/kit'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Generic German fallback shown to the user when an error has no safe
 * message. Anything technical the user does not need to see — postgres
 * errors, file paths, stack traces — is logged to the console only.
 */
const GENERIC_FALLBACK = 'Es ist leider ein Fehler aufgetreten.'

/**
 * Convert any thrown value into a user-safe German message.
 *
 * - HTTP errors carry a `body.message` that is **already curated** by the
 *   server-side `handleError` / `handleValidationError` hooks or by an
 *   explicit `error(status, 'german message')` call inside a remote
 *   function. Those messages are safe to display.
 * - Anything else (raw `Error`, network failure, plain object, undefined)
 *   resolves to the generic fallback. The original is logged so a
 *   developer can still see it in the console / production telemetry,
 *   but the user never sees a stack trace, file path, SQL fragment, or
 *   English internal text.
 */
const safeMessage = (error: unknown): string => {
  if (isHttpError(error)) {
    const body = error.body as unknown
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof (body as { message: unknown }).message === 'string'
    ) {
      const raw = (body as { message: string }).message.trim()
      if (raw.length > 0) return raw
    }
    return GENERIC_FALLBACK
  }
  return GENERIC_FALLBACK
}

/**
 * Map a remote-function error to a friendly German toast.
 *
 * - Always logs the original error to `console.error` for diagnostics.
 * - The user-facing toast is **only** the curated German message — never
 *   a raw `Error.message`, never an English fallback, never a stack
 *   trace.
 * - Pass an optional `baseMessage` to prefix the toast with context
 *   (e.g. `"Kunde konnte nicht gespeichert werden"`); the colon and the
 *   curated message are appended automatically.
 *
 * @example
 * ```ts
 * try {
 *   await busy.run(() => createCustomerRemote(values))
 * } catch (err) {
 *   handleClientError(err, 'Kunde konnte nicht angelegt werden')
 * }
 * ```
 */
export const handleClientError = (
  error: unknown,
  baseMessage?: string
): void => {
  const detail = safeMessage(error)
  const msg = baseMessage ? `${baseMessage}: ${detail}` : detail
  console.error('[client-error]', msg, error)
  toast.error(msg)
}
