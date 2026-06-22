import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from './db/client'
import { accounts, sessions, users } from './db/schema'
import { auth } from './auth'

/**
 * Lowercase + ASCII range that the better-auth username plugin accepts.
 * Mirrors `defaultUsernameValidator` in the plugin so we reject early
 * with a clear German message instead of letting a later sign-in fail
 * with "Invalid username".
 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/

/**
 * Normalise a username for storage / lookup.
 *
 * The better-auth username plugin always lowercases the username before
 * looking it up at sign-in (`/sign-in/username` → `normalizer(username)`),
 * but its schema's `transform.input` (which also lowercases) only runs
 * when the user is written through the plugin's own adapter path —
 * i.e. `auth.api.signUp.email` and friends. Because we bypass that and
 * insert directly via Drizzle here, we have to apply the same
 * normalisation ourselves; otherwise a user typed as `Admin` would be
 * stored verbatim and later sign-in lookups (with `admin`) would miss.
 */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * Server-side helper to create a new user with a credential (username
 * + password) account.
 *
 * The public `/api/auth/sign-up/email` endpoint is intentionally
 * disabled (`disableSignUp: true` in the auth config) so visitors
 * cannot self-register. The two places that legitimately create users
 * — the first-run setup wizard and the admin "Benutzer & Rollen"
 * settings UI — call this helper directly, which bypasses the
 * public-endpoint gate while still using better-auth's internal
 * password hasher so the resulting `accounts.password` row is
 * verifiable by `auth.api.signIn`.
 *
 * Email is synthesized from the (already lowercased) username
 * (`<username>@twincars.local`). It is required by better-auth for
 * canonical identity but never used for outbound mail.
 *
 * Returns the new user's id.
 */
export async function createUserWithCredential(input: {
  username: string
  name: string
  password: string
}): Promise<{ id: string }> {
  const username = normaliseUsername(input.username)
  if (username.length < 3 || username.length > 64) {
    throw new Error('Benutzername muss zwischen 3 und 64 Zeichen lang sein.')
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten.'
    )
  }
  const displayUsername = input.username.trim()

  const ctx = await auth.$context
  const passwordHash = await ctx.password.hash(input.password)

  const userId = randomUUID()
  const now = new Date()
  const synthesizedEmail = `${username}@twincars.local`

  await db
    .insert(users)
    .values({
      id: userId,
      name: input.name,
      email: synthesizedEmail,
      emailVerified: false,
      username,
      displayUsername,
      createdAt: now,
      updatedAt: now
    })

  await db
    .insert(accounts)
    .values({
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: passwordHash,
      createdAt: now,
      updatedAt: now
    })

  return { id: userId }
}

/**
 * `true` when the user id exists and is active. Unknown ids are treated
 * as inactive (fail closed). Used by `hooks.server.ts` on every
 * authenticated request so a freshly deactivated account loses access
 * immediately, even within the session-cookie cache window.
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.active === true
}

/**
 * `true` when an account with this (normalised) username exists AND is
 * deactivated. Used to reject the sign-in POST before better-auth issues
 * a session, so the login form shows a clear German message instead of
 * letting the user in and bouncing them on the next request. Unknown
 * usernames return `false` so the normal "invalid credentials" path
 * handles them (no account enumeration).
 */
export async function isUsernameDeactivated(
  username: string
): Promise<boolean> {
  const [row] = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.username, normaliseUsername(username)))
    .limit(1)
  return row ? row.active === false : false
}

/**
 * Delete every session belonging to a user — used when an account is
 * deactivated so any open browser session is force-logged-out on its
 * next request rather than lingering until natural expiry.
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
