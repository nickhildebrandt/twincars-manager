import { createAuthClient } from 'better-auth/client'
import { usernameClient } from 'better-auth/client/plugins'

/**
 * Browser-side better-auth client. Used by the login form and the
 * top-bar logout button. Because the SvelteKit `+server.ts` catch-all
 * lives at the same origin (`/api/auth/*`), no `baseURL` is required.
 *
 * This is the one place a `fetch` to an internal SvelteKit endpoint is
 * allowed (CLAUDE.md §15): the better-auth library handles cookies,
 * CSRF, and session refresh internally and cannot be expressed as a
 * remote function. All app data flow continues to use remote
 * functions.
 */
export const authClient = createAuthClient({ plugins: [usernameClient()] })

export const { signIn, signOut, useSession } = authClient
