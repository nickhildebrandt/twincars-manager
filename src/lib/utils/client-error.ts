import { isHttpError } from '@sveltejs/kit'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Map a remote-function error to a friendly toast message.
 * Always logs the error to the browser console for diagnostics.
 */
export const handleClientError = (error: unknown, baseMessage?: string) => {
  let msg = baseMessage ? `${baseMessage}: ` : ''
  if (isHttpError(error)) {
    const body = error.body as unknown
    if (body && typeof body === 'object' && 'message' in body) {
      msg += String(
        (body as { message: unknown }).message ?? `HTTP ${error.status}`
      )
    } else {
      msg += `HTTP ${error.status}`
    }
  } else if (error instanceof Error) {
    msg += error.message
  } else {
    msg += 'Unbekannter Fehler.'
  }
  console.error(msg, error)
  toast.error(msg)
}
