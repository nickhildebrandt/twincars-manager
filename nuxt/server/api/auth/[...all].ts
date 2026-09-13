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
import { toWebRequestWithBody } from '../../utils/web-request.ts'

export default defineEventHandler(async (event) => {
  if (!isExposedAuthEndpoint(event.path)) throw notFound('Die Seite')
  // Nicht `toWebRequest`: die Drossel hat den Rumpf schon gelesen, und ein
  // Strom lässt sich nur einmal lesen — siehe server/utils/web-request.ts.
  return useAuth().handler(await toWebRequestWithBody(event))
})
