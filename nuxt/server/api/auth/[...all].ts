/**
 * The authentication library's own endpoints.
 *
 * Only the handful listed in `server/utils/auth-paths.ts` are reachable;
 * everything else the library implements answers 404. The catch-all otherwise
 * publishes whatever the library happens to offer — which is how the
 * predecessor ended up exposing a way for a signed-in person to change their
 * own user name, and an unauthenticated way to test which user names exist
 * (B-051, B-052).
 */
import { isExposedAuthEndpoint } from '../../utils/auth-paths.ts'
import { useAuth } from '../../utils/auth.ts'
import { notFound } from '../../utils/errors.ts'

export default defineEventHandler((event) => {
  if (!isExposedAuthEndpoint(event.path)) throw notFound('Die Seite')
  return useAuth().handler(toWebRequest(event))
})
