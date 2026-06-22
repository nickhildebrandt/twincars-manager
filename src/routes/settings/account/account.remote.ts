import { command } from '$app/server'
import { error } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { check, maxLength, minLength, object, pipe, string } from 'valibot'
import { db } from '$lib/server/db/client'
import { accounts } from '$lib/server/db/schema'
import { auth } from '$lib/server/auth'
import { requireUser } from '$lib/server/auth-guards'

/**
 * Self-service profile remote layer. Currently exposes a single
 * mutation — change-own-password — so the signed-in user can rotate
 * their credentials without administrator help.
 *
 * Guard model: only `requireUser()`. No additional permission gate —
 * every authenticated user must be able to change their own password,
 * regardless of role.
 *
 * @group integration
 * @module account
 */

const passwordSchema = pipe(
  string('Bitte ein Passwort eingeben.'),
  minLength(8, 'Passwort zu kurz (mind. 8 Zeichen).'),
  maxLength(128, 'Passwort zu lang.')
)

const changeOwnPasswordSchema = pipe(
  object({
    currentPassword: pipe(
      string('Bitte das aktuelle Passwort eingeben.'),
      minLength(1, 'Bitte das aktuelle Passwort eingeben.'),
      maxLength(256, 'Eingabe zu lang.')
    ),
    newPassword: passwordSchema,
    newPasswordConfirm: passwordSchema
  }),
  check(
    (v) => v.newPassword === v.newPasswordConfirm,
    'Die neuen Passwörter stimmen nicht überein.'
  ),
  check(
    (v) => v.newPassword !== v.currentPassword,
    'Das neue Passwort muss sich vom aktuellen unterscheiden.'
  )
)

/**
 * Change the calling user's password.
 *
 * Flow:
 *   1. Require an authenticated session.
 *   2. Load the user's `credential` account row.
 *   3. Verify `currentPassword` against the stored bcrypt hash via
 *      better-auth's internal verifier (the same one the sign-in
 *      endpoint uses), so the credential format stays consistent.
 *   4. Hash the new password with the same internal helper used by
 *      `createUserWithCredential`/`updateUserRemote` and persist it.
 *
 * Error contract: every failure path throws a SvelteKit `error(...)`
 * with a curated German message. The server hooks pass these through
 * to the client untouched.
 *
 * @group integration
 * @module account
 */
export const changeOwnPasswordRemote = command(
  changeOwnPasswordSchema,
  async ({ currentPassword, newPassword }) => {
    const user = requireUser()

    const [credential] = await db
      .select({ id: accounts.id, password: accounts.password })
      .from(accounts)
      .where(
        and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential'))
      )
      .limit(1)
    if (!credential || !credential.password) {
      error(400, 'Für dieses Konto ist kein Passwort hinterlegt.')
    }

    const ctx = await auth.$context
    const valid = await ctx.password.verify({
      hash: credential.password,
      password: currentPassword
    })
    if (!valid) {
      error(400, 'Das aktuelle Passwort ist nicht korrekt.')
    }

    const newHash = await ctx.password.hash(newPassword)
    await db
      .update(accounts)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(accounts.id, credential.id))
  }
)
