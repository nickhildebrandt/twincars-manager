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
  const detail = first?.message ?? 'Ungültige Eingabe'
  return {
    message: path
      ? `Ungültige Eingabe für „${path}“: ${detail}`
      : `Ungültige Eingabe: ${detail}`
  }
}

export const handleError: HandleServerError = ({ error, status }) => {
  if (status >= 500) {
    console.error('[server-error]', error)
    return { message: 'Ein interner Fehler ist aufgetreten.' }
  }
  return undefined
}
