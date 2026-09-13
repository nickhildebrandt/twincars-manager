/**
 * The only way to reach `/api/**` from the browser.
 *
 * It turns the server's error shape into the three reactions the user should
 * get (../../../docs/rewrite/03-architektur.md §11):
 *
 *   401 → back to the login, with the current page remembered
 *   422 → field errors handed back to the form, no toast noise
 *   else → one error toast with the curated German sentence
 *
 * The original error is written to the console for developers; the user never
 * sees it.
 */
import type { FetchOptions } from 'ofetch'

export type ApiErrorPayload = {
  code?: string
  fields?: Record<string, string>
}

/** Thrown for a 422 so a form can attach the messages to its inputs. */
export class ValidationError extends Error {
  constructor(readonly fields: Record<string, string>, message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const GENERIC = 'Es ist leider ein Fehler aufgetreten.'

/** Reads the curated German sentence out of a failed request. */
export function messageOf(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } })?.data
  const candidate = data?.statusMessage ?? data?.message
  return typeof candidate === 'string' && candidate.trim() !== '' ? candidate : GENERIC
}

/** Field errors of a 422, or `null` for every other failure. */
export function fieldsOf(error: unknown): Record<string, string> | null {
  const status = error as { statusCode?: number, status?: number }
  const code = status.statusCode ?? status.status
  if (code !== 422) return null
  const payload = (error as { data?: { data?: ApiErrorPayload } })?.data?.data
  return payload?.fields ?? null
}

export function useApi() {
  const notify = useNotify()
  const route = useRoute()

  async function request<T>(path: string, options?: FetchOptions<'json'>): Promise<T> {
    try {
      return await $fetch<T>(path, options as never)
    }
    catch (error) {
      handle(error)
      throw error
    }
  }

  function handle(error: unknown): never | void {
    console.error('[api]', error)

    const statusCode
      = (error as { statusCode?: number }).statusCode
        ?? (error as { status?: number }).status

    if (statusCode === 401) {
      // The session is gone. A toast alone leaves the user stranded on a page
      // that no longer works, so send them to the login and come back after.
      navigateTo({ path: '/login', query: { redirectTo: route.fullPath } })
      return
    }

    const fields = fieldsOf(error)
    if (fields) throw new ValidationError(fields, messageOf(error))

    notify.error(messageOf(error))
  }

  return {
    request,
    get: <T>(path: string, options?: FetchOptions<'json'>) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: FetchOptions<'json'>) =>
      request<T>(path, { ...options, method: 'POST', body: body as never }),
    patch: <T>(path: string, body?: unknown, options?: FetchOptions<'json'>) =>
      request<T>(path, { ...options, method: 'PATCH', body: body as never }),
    delete: <T>(path: string, options?: FetchOptions<'json'>) =>
      request<T>(path, { ...options, method: 'DELETE' }),
    /** For callers that run their own fetch but want the same reactions. */
    handle,
  }
}
