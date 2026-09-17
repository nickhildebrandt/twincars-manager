/**
 * The better-auth instance.
 *
 * Username and password only. There is no e-mail signup, no password reset by
 * mail, no social login: the workshop has a handful of accounts and the
 * administrator creates them (ADR-013). The synthesised address
 * `<benutzername>@twincars.local` never leaves the server.
 *
 * Decision and comparison: `../../../docs/rewrite/inventar/research-auth.md`.
 *
 * Two things are deliberately **not** taken from better-auth:
 *
 *   - the `admin` plugin as a permission model. Roles as a comma-separated
 *     string in a column is weaker than the `roles`/`role_permissions` tables
 *     this application already has.
 *   - the cookie cache. With it, a revoked session keeps working until the
 *     cookie expires. One database read per request is cheaper than that hole.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins/username'
import { APIError } from 'better-auth/api'
import { accounts, sessions, users, verifications } from '../database/schema/index.ts'
import { useDatabase } from './db.ts'
import { isUserActive } from './auth-users.ts'
import { trustsProxy } from './client-ip.ts'

/** Seconds a session stays valid without being renewed: one week. */
const SESSION_LIFETIME = 60 * 60 * 24 * 7

/** Sign-in attempts allowed per minute and client address. */
export const SIGN_IN_ATTEMPTS_PER_MINUTE = 10

/**
 * Builds the instance.
 *
 * A separate function, so its return type keeps the plugin's additions —
 * declaring the variable as `ReturnType<typeof betterAuth>` would widen it and
 * lose `session.user.username`.
 */
function build() {
  const config = useRuntimeConfig()
  const origin = config.origin || config.betterAuthUrl
  const baseURL = config.betterAuthUrl || config.origin

  return betterAuth({
    database: drizzleAdapter(useDatabase(), {
      provider: 'pg',
      usePlural: false,
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),

    // Unchanged secret and cookie prefix: existing sessions survive.
    secret: config.appSecret,
    baseURL,

    // Both addresses, so a mismatch between them cannot leave the CSRF check
    // looking at the wrong origin (B-071).
    trustedOrigins: [...new Set([origin, baseURL].filter(Boolean))],

    emailAndPassword: {
      enabled: true,
      // Accounts are created by an administrator, never by a visitor.
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },

    emailVerification: { sendOnSignUp: false, autoSignInAfterVerification: false },

    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 64 })],

    user: {
      additionalFields: {
        // Set by the administrator, never by the account holder.
        active: { type: 'boolean', required: false, defaultValue: true, input: false },
      },
      changeEmail: { enabled: false },
    },

    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            // A deactivated account is refused **before** a session exists.
            // An unknown user name still ends in the same
            // "wrong name or password" answer, so nothing can be learned from
            // the difference.
            if (!(await isUserActive(session.userId))) {
              throw new APIError('FORBIDDEN', { message: 'Dieses Konto ist deaktiviert.' })
            }
            return { data: session }
          },
        },
      },
    },

    session: {
      expiresIn: SESSION_LIFETIME,
      updateAge: 60 * 60 * 24,
      // See the note at the top: a revoked session must stop working at once.
      cookieCache: { enabled: false },
    },

    // Throttling is done by `server/middleware/01.throttle.ts`, not
    // here. The library's own limiter reads `x-forwarded-for` by default and
    // trusts a single-valued header, so without a proxy in front an attacker
    // sends a different value with every request and never fills a bucket —
    // exactly the hole B-003 and B-054 describe. Our middleware counts the
    // socket address unless the deployment says a proxy sets that header.
    rateLimit: { enabled: false },

    advanced: {
      cookiePrefix: 'tcm',

      /**
       * Das Sitzungsplätzchen, ausdrücklich abgesichert (M-40).
       *
       * Die Bibliothek leitet `useSecureCookies` sonst aus der Basisadresse
       * ab. Das stimmt meistens — und schweigt genau dann, wenn es falsch
       * konfiguriert ist. Hier steht es geschrieben und wird geprüft.
       *
       * `sameSite: 'lax'` statt `'strict'`: mit `'strict'` schickt der Browser
       * das Plätzchen nach einem Klick auf einen Link von außen **nicht** mit,
       * und der Nutzer landet auf der Anmeldeseite, obwohl er angemeldet ist.
       * `lax` schickt es bei einer normalen Navigation mit, aber nie bei einer
       * fremden Formularabsendung — und genau darum geht es.
       */
      useSecureCookies: origin.startsWith('https://'),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      },
      // Two queries instead of one join. The adapter's join path looks for an
      // inline `.references()` on the column, while this schema declares every
      // foreign key as a named `foreignKey()` block so the constraint names
      // stay stable. With a handful of accounts the second read costs nothing.
      database: { joins: false },
      ipAddress: {
        // Same rule for the address written into the session row: believed
        // only behind a proxy that overwrites it.
        ipAddressHeaders: trustsProxy(config.trustProxy) ? ['x-forwarded-for'] : [],
      },
    },

    telemetry: { enabled: false },
  })
}

type AuthInstance = ReturnType<typeof build>

let instance: AuthInstance | undefined

/**
 * The instance, built once per process on first use.
 *
 * Lazily, because the configuration only exists once Nitro runs — and because
 * a module that opens a database connection at import time cannot be imported
 * by a test.
 */
export function useAuth(): AuthInstance {
  instance ??= build()
  return instance
}

/** Drops the cached instance. Tests use this; nothing else should. */
export function resetAuth(): void {
  instance = undefined
}

export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>
