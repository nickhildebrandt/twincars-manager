/**
 * Creating accounts and changing passwords.
 *
 * Both go through the authentication library's own context rather than
 * writing the tables directly, so the password hash is produced by exactly the
 * algorithm the sign-in later verifies with. Hashing by hand here would work
 * until the library changes its parameters, and then nobody could sign in.
 *
 * Sign-up over HTTP stays switched off: accounts are created by an
 * administrator, never by a visitor (ADR-013).
 */
import { eq } from 'drizzle-orm'
import { users } from '../database/schema/index.ts'
import { useAuth } from './auth.ts'
import { deleteUserSessions, syntheticEmail } from './auth-users.ts'
import { conflict } from './errors.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'

export type NewUser = {
  username: string
  displayName: string
  password: string
}

/**
 * Creates an account with a password it can sign in with.
 *
 * The e-mail address is synthesised from the user name and never leaves the
 * server — the application has no mail-based login, no password reset by mail
 * and no address to show.
 */
export async function createUserWithCredential(
  input: NewUser,
  executor: Executor = useDatabase(),
): Promise<{ id: string }> {
  const username = input.username.trim().toLowerCase()
  const email = syntheticEmail(username)

  const [taken] = await executor
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (taken) throw conflict('Diesen Benutzernamen gibt es bereits.')

  const context = await useAuth().$context
  const user = await context.internalAdapter.createUser({
    name: input.displayName.trim(),
    email,
    emailVerified: false,
    username,
    displayUsername: input.displayName.trim(),
    active: true,
  }, { method: 'admin' })

  await context.internalAdapter.createAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await context.password.hash(input.password),
  })

  return { id: user.id }
}

/**
 * Sets a new password and ends every session of that account.
 *
 * Used by the administrator. Someone changing their own password goes through
 * the library's `change-password`, which asks for the current one.
 */
export async function resetPassword(userId: string, password: string): Promise<void> {
  const context = await useAuth().$context
  const account = await context.internalAdapter.findAccountByUserId(userId)
  const credential = account.find(entry => entry.providerId === 'credential')
  const hash = await context.password.hash(password)

  if (credential) {
    await context.internalAdapter.updateAccount(credential.id, { password: hash })
  }
  else {
    await context.internalAdapter.createAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: hash,
    })
  }

  // Every session of this account ends, so a stolen one cannot outlive the
  // password it was created with.
  await deleteUserSessions(userId)
}
