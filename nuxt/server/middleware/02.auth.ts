/**
 * Reads the session once per request and puts it on the event.
 *
 * `event.context.auth` is the single truth for the rest of the request: every
 * guard, every endpoint and `/api/me` read from here and nowhere else. The
 * predecessor looked the session up in several places, which is how one path
 * ended up checking a stale answer.
 *
 * Middleware never returns a value — returning from Nitro middleware would end
 * the request and answer with that value.
 */
import { skipsSessionLookup } from '../utils/auth-paths.ts'
import { useAuth } from '../utils/auth.ts'
import { isUserActive, loadUserPermissions } from '../utils/auth-users.ts'

export default defineEventHandler(async (event) => {
  // Static assets and the library's own endpoints need no lookup: the library
  // reads the cookie itself. Everything else does — including `/api/me`, which
  // needs no session but has to report one when it exists.
  if (skipsSessionLookup(event.path)) return

  const session = await useAuth().api.getSession({ headers: event.headers })
  if (!session) return

  // Deactivating somebody must end their work now, not at their next sign-in.
  // The session row still exists at this point; the check is what stops it.
  if (!(await isUserActive(session.user.id))) return

  event.context.auth = {
    userId: session.user.id,
    username: session.user.username ?? session.user.name,
    displayName: session.user.name,
    permissions: await loadUserPermissions(session.user.id),
  }
})
