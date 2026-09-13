/**
 * Liveness check for the container and the reverse proxy.
 *
 * Deliberately without a session guard — a health check that needs credentials
 * is not a health check. It reveals nothing beyond "the process answers and
 * the database answers": no version, no configuration, no counts.
 *
 * The work is in `server/utils/health.ts`; this file is the wiring, and the
 * end-to-end suite proves it against the built server.
 */
import { checkHealth } from '../utils/health.ts'
import { useDatabase } from '../utils/db.ts'

export default defineEventHandler(async () => {
  try {
    return await checkHealth(useDatabase())
  }
  catch (error) {
    console.error('[health]', error)
    throw createError({
      statusCode: 503,
      statusMessage: 'Die Datenbank ist nicht erreichbar.',
      message: 'Die Datenbank ist nicht erreichbar.',
    })
  }
})
