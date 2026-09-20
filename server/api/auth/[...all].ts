/**
 * The authentication library's own endpoints.
 *
 * Only the handful listed in `server/utils/auth-paths.ts` are reachable;
 * everything else the library implements answers 404. The catch-all otherwise
 * publishes whatever the library happens to offer — which is how the
 * predecessor ended up exposing a way for a signed-in person to change their
 * own user name, and an unauthenticated way to test which user names exist
 * (B-051, B-052).
 *
 * Hier steht außerdem die **einzige Stelle, an der der Ausgang einer Anmeldung
 * bekannt ist** (M-36). Die Drossel davor sieht nur, dass jemand klopft; ob
 * das Passwort stimmte, weiß erst die Bibliothek. Also wird hier protokolliert
 * — und hier fällt auch die letzte Stufe der Staffel (P-13).
 */
import { isExposedAuthEndpoint } from '../../utils/auth-paths.ts'
import { useAuth } from '../../utils/auth.ts'
import { notFound } from '../../utils/errors.ts'
import { toWebRequestWithBody } from '../../utils/web-request.ts'
import { clientIp, trustsProxy } from '../../utils/client-ip.ts'
import { peekValidatedBody } from '../../utils/validate.ts'
import { recordSignInAttempt } from '../../utils/sign-in-log.ts'
import { accountExists, noteSignInOutcome } from '../../utils/account-lock.ts'
import { recordSecurity } from '../../utils/audit.ts'
import { signInAttemptSchema } from '#shared/schemas/auth'
import { labelOf, signInFailures } from '#shared/domain'
import type { SignInFailure } from '#shared/domain'

export default defineEventHandler(async (event) => {
  if (!isExposedAuthEndpoint(event.path)) throw notFound('Die Seite')

  const isSignIn = event.path.startsWith('/api/auth/sign-in')

  // Der Benutzername muss **vor** dem Weiterreichen gelesen werden: danach ist
  // der Rumpf verbraucht und die Antwort nennt ihn nicht.
  const attempt = isSignIn ? await peekValidatedBody(event, signInAttemptSchema) : undefined

  // Nicht `toWebRequest`: die Drossel hat den Rumpf schon gelesen, und ein
  // Strom lässt sich nur einmal lesen — siehe server/utils/web-request.ts.
  const response = await useAuth().handler(await toWebRequestWithBody(event))

  if (attempt) {
    await noteAttempt(event, attempt.username, response.ok)
  }

  return response
})

/**
 * Schreibt den Ausgang ins Protokoll und zieht die Folgen.
 *
 * Scheitert das, scheitert **nicht** die Anmeldung: ein volles Protokoll darf
 * niemanden aussperren. Deshalb fängt `recordSignInAttempt` selbst ab, und
 * `noteSignInOutcome` tut es ebenso.
 */
async function noteAttempt(
  event: Parameters<typeof clientIp>[0],
  username: string,
  succeeded: boolean,
): Promise<void> {
  const address = clientIp(event, trustsProxy(useRuntimeConfig().trustProxy))

  // Warum es scheiterte, in einem Wort. Ob es den Namen gibt, entscheidet
  // zugleich darüber, was gesperrt wird (P-15).
  const known = await accountExists(username)
  const reason: SignInFailure | undefined = succeeded
    ? undefined
    : known ? 'passwort' : 'unbekannt'

  await recordSignInAttempt({ username, clientAddress: address, succeeded, reason })
  await noteSignInOutcome({ username, succeeded, known, clientAddress: address })

  // Dasselbe Ereignis noch einmal im großen Protokoll (M-39). `sign_in_attempts`
  // ist der Zähler für die Sperre und wird oft und schmal gelesen; das
  // Protokoll ist die eine Stelle, an der jemand nachsieht, was geschehen ist.
  await recordSecurity({
    action: succeeded ? 'angemeldet' : 'abgewiesen',
    entity: 'users',
    entityId: username,
    userName: username,
    clientAddress: address,
    note: reason
      ? `Anmeldung von „${username}" gescheitert: ${labelOf(signInFailures, reason)}`
      : `Anmeldung von „${username}"`,
  }, event)
}
