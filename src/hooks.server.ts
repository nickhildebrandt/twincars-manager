import type { Handle } from '@sveltejs/kit'
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
