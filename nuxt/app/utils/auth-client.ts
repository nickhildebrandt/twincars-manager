/**
 * The browser half of the authentication library.
 *
 * Only sign-in and sign-out go through it. Everything else the application
 * knows about the signed-in person comes from `/api/me`, because only the
 * server can say which permissions a person holds.
 */
import { createAuthClient } from 'better-auth/vue'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [usernameClient()],
})
