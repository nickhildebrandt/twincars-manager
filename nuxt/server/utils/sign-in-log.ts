/**
 * Wer sich wann anzumelden versucht hat — auch erfolglos (M-36).
 *
 * Eine Drossel hält das Durchprobieren auf, macht es aber nicht sichtbar. Erst
 * die Spur zeigt, dass jemand es systematisch versucht: derselbe Benutzername
 * von zwanzig Adressen, oder zwanzig Benutzernamen von einer.
 *
 * Der Benutzername wird festgehalten, **auch wenn es ihn nicht gibt** — gerade
 * dann ist der Versuch interessant.
 */
import { and, count, eq, gte } from 'drizzle-orm'
import { signInAttempts } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'

/** Warum ein Versuch scheiterte. Ein Wort, keine Erzählung. */
export type SignInFailure = 'passwort' | 'unbekannt' | 'gesperrt' | 'drossel'

export type SignInAttempt = {
  username: string
  clientAddress: string | null
  succeeded: boolean
  reason?: SignInFailure
}

/**
 * Schreibt einen Versuch ins Protokoll.
 *
 * Scheitert das Schreiben, scheitert **nicht** die Anmeldung: ein volles
 * Protokoll darf niemanden aussperren. Der Fehler landet im Serverlog.
 */
export async function recordSignInAttempt(
  attempt: SignInAttempt,
  executor: Executor = useDatabase(),
): Promise<void> {
  try {
    await executor.insert(signInAttempts).values({
      username: attempt.username.trim().toLowerCase().slice(0, 64),
      clientAddress: attempt.clientAddress?.slice(0, 64) ?? null,
      succeeded: attempt.succeeded,
      reason: attempt.reason ?? null,
    })
  }
  catch (error) {
    console.error('[anmeldung] Versuch konnte nicht protokolliert werden', error)
  }
}

/** Wie oft ein Benutzername seit einem Zeitpunkt erfolglos versucht wurde. */
export async function failedAttemptsSince(
  username: string,
  since: Date,
  executor: Executor = useDatabase(),
): Promise<number> {
  const [row] = await executor
    .select({ total: count() })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.username, username.trim().toLowerCase()),
      eq(signInAttempts.succeeded, false),
      gte(signInAttempts.at, since.toISOString()),
    ))
  return row?.total ?? 0
}
