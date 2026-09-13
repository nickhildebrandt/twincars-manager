/**
 * Last line of defence for anything that reaches the client.
 *
 * Curated errors (from `server/utils/errors.ts`) pass through untouched.
 * Everything else is logged with its original detail and replaced by one
 * German sentence — no stack, no SQL, no file path
 * (../../../docs/rewrite/03-architektur.md §5.4).
 */
import { INTERNAL_MESSAGE, UNKNOWN_CLIENT_MESSAGE, isCuratedError } from '../utils/errors.ts'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, context) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) {
      console.error('[server-error]', context?.event?.path ?? '', error)
    }
  })

  nitro.hooks.hook('beforeResponse', (event, response) => {
    const body = response.body as
      | { statusCode?: number, statusMessage?: string, message?: string, data?: unknown }
      | undefined
    if (!body || typeof body !== 'object' || typeof body.statusCode !== 'number') return
    const status = body.statusCode
    if (status < 400) return

    if (isCuratedError(body)) {
      // Already German and safe. Remove the stack that Nitro adds in dev.
      delete (body as { stack?: unknown }).stack
      return
    }

    const message = status >= 500
      ? INTERNAL_MESSAGE
      : (body.statusMessage && isGerman(body.statusMessage)
          ? body.statusMessage
          : UNKNOWN_CLIENT_MESSAGE)

    body.statusMessage = message
    body.message = message
    body.data = { code: status >= 500 ? 'INTERNAL' : 'BAD_REQUEST' }
    delete (body as { stack?: unknown }).stack
  })
})

/**
 * Framework messages such as Nitro's own "Not Found" must not reach the user
 * (B-012). Rather than guessing at the language, only a short allow-list of
 * known-German framework strings passes; everything else becomes the generic
 * sentence.
 */
const GERMAN_FRAMEWORK_MESSAGES = new Set<string>()
const isGerman = (message: string) => GERMAN_FRAMEWORK_MESSAGES.has(message)
