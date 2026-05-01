import type {
  Handle,
  HandleServerError,
  HandleValidationError
} from '@sveltejs/kit'
import { runMigrations } from '$lib/server/db/migrate'
import { seedDefaults } from '$lib/server/db/seed-defaults'

let initialised = false
let initPromise: Promise<void> | null = null

const ensureInitialised = () => {
  if (initialised) return Promise.resolve()
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations()
      await seedDefaults()
      initialised = true
    })()
  }
  return initPromise
}

export const handle: Handle = async ({ event, resolve }) => {
  await ensureInitialised()
  return resolve(event)
}

/**
 * Convert a Valibot validation failure into a single user-safe German
 * message. The shape returned here lands in `App.Error` and is consumed
 * by `+error.svelte` and `handleClientError` — so the message is the
 * only thing the user ever sees.
 *
 * Notes:
 * - Only the first issue is surfaced. Showing all issues at once is
 *   noisy and confusing for non-technical users.
 * - The path is rendered as `„field.subField"` so the user sees which
 *   input caused the problem.
 * - If the underlying schema didn't supply a German message (Valibot's
 *   built-in defaults are English), we fall back to a generic German
 *   sentence rather than leaking the English text.
 */
export const handleValidationError: HandleValidationError = ({ issues }) => {
  const first = issues[0]
  const path =
    first && 'path' in first && Array.isArray(first.path) && first.path.length
      ? first.path
          .map((p: unknown) =>
            typeof p === 'object' && p !== null && 'key' in p
              ? String((p as { key: unknown }).key)
              : String(p)
          )
          .join('.')
      : null
  const raw = first?.message?.trim() ?? ''
  // Heuristic: Valibot's built-in messages are English ASCII without
  // umlauts. If we haven't given the schema a curated German message,
  // fall back to a generic sentence instead of leaking English to the
  // user.
  const looksGerman = /[äöüÄÖÜß]/.test(raw) || raw === ''
  const detail = looksGerman && raw ? raw : 'Bitte prüfen Sie Ihre Eingabe.'
  return {
    message: path
      ? `Ungültige Eingabe für „${path}“: ${detail}`
      : `Ungültige Eingabe: ${detail}`
  }
}

/**
 * Translate any unhandled server error into a user-safe German message.
 *
 * Three buckets:
 * - 5xx: log the original (stack, SQL, etc.) for ops; return a generic
 *   German sentence — never leak internals to the browser.
 * - 4xx that we explicitly threw (`error(404, 'Kunde nicht gefunden.')`,
 *   etc.): SvelteKit already passes the message through; we don't
 *   override it. Returning `undefined` lets the original message stand.
 * - Unknown 4xx without a message: provide a German fallback.
 */
export const handleError: HandleServerError = ({ error, status, message }) => {
  if (status >= 500) {
    console.error('[server-error]', error)
    return { message: 'Ein interner Fehler ist aufgetreten.' }
  }
  // Curated 4xx (`error(404, '…')`) already supplies a German message —
  // let SvelteKit forward it untouched.
  if (typeof message === 'string' && message.trim().length > 0) {
    return undefined
  }
  return { message: 'Die Anfrage konnte nicht bearbeitet werden.' }
}
