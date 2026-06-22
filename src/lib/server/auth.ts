import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username as usernamePlugin } from 'better-auth/plugins'
import { env } from '$env/dynamic/private'
import { db } from './db/client'
import * as schema from './db/schema'

/**
 * Authentication entry point.
 *
 * Pure username + password auth (no email signup, no OAuth, no magic
 * links). Accounts are created exclusively by the administrator from
 * the settings UI; the admin sets both the username and the initial
 * password. better-auth still treats `email` as the canonical
 * identifier internally, so we synthesize a stable address from the
 * username (`<username>@twincars.local`) at account-creation time —
 * it never leaves the server.
 *
 * Sessions: 7 days, refreshed on activity.
 *
 * `APP_SECRET` is used purely for HMAC cookie signing — it is NOT
 * application data encryption. better-auth needs some secret for
 * tamper-detection on session cookies; the development fallback is
 * fine for local work but must be replaced in production.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    },
    usePlural: false
  }),
  secret: env.APP_SECRET ?? 'dev-only-fallback-secret-do-not-use-prod',
  /**
   * Origin where the app is served. better-auth uses this for cookie
   * domain + (would use for) OAuth callbacks — we don't have OAuth,
   * but setting it explicitly silences the dev warning and protects
   * against subdomain leakage in production. Reads `BETTER_AUTH_URL`
   * first, falls back to `ORIGIN` (the SvelteKit standard), then to
   * a dev default. Override on every deployment.
   */
  baseURL: env.BETTER_AUTH_URL ?? env.ORIGIN ?? 'http://localhost:5173',
  trustedOrigins: env.ORIGIN ? [env.ORIGIN] : undefined,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    /** Disable self-service signup — admin creates users from settings. */
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  /** Disable email verification entirely. */
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: false
  },
  plugins: [usernamePlugin({ minUsernameLength: 3, maxUsernameLength: 64 })],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 }
  },
  advanced: { cookiePrefix: 'tcm' }
})

export type AuthInstance = typeof auth
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
