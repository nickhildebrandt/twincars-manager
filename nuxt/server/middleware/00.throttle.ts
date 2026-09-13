/**
 * Brute-force protection for the sign-in.
 *
 * The counting is ours rather than the library's, because the address it
 * counts against has to be one the caller cannot choose. The library reads
 * `x-forwarded-for` by default and accepts a single-valued header, so without
 * a proxy in front an attacker sends a different value with every request and
 * never fills a bucket — the brute-force protection does nothing at all
 * (B-003, B-054).
 *
 * Here the header is only believed when the deployment says a proxy sets it
 * (`TRUST_PROXY=on`). Otherwise the socket address decides.
 *
 * Gezählt wird **zweifach** (M-36): je Adresse und je Benutzername. Sonst
 * verteilt ein Angreifer mit vielen Adressen seine Versuche auf ein einziges
 * Konto, ohne je einen Eimer zu füllen. Der Kontozähler ist großzügiger, damit
 * ein Tippfehler nicht gleich aussperrt, aber eng genug, um Durchprobieren zu
 * beenden.
 *
 * Darüber liegt die **gestaffelte Sperre** aus `account-lock.ts` (P-13): eine
 * Minutengrenze ist eine Bremse, keine Sperre — wer wartet, kommt durch. Nach
 * zwanzig Fehlversuchen binnen einer Stunde ruht das Konto fünfzehn Minuten.
 *
 * Runs first, before the session lookup: a flood should be turned away without
 * touching the database.
 */
import * as v from 'valibot'
import { SIGN_IN_ATTEMPTS_PER_MINUTE } from '../utils/auth.ts'
import { clientIp, trustsProxy } from '../utils/client-ip.ts'
import { consume } from '../utils/rate-limit.ts'
import { tooManyRequests } from '../utils/errors.ts'
import { recordSignInAttempt } from '../utils/sign-in-log.ts'
import { accountLock, lockMessage } from '../utils/account-lock.ts'
import { peekValidatedBody } from '../utils/validate.ts'

/** Calls per minute allowed on the rest of the authentication endpoints. */
const OTHER_AUTH_CALLS_PER_MINUTE = 60

/**
 * Anmeldeversuche je Minute und **Benutzername**.
 *
 * Höher als der Adresszähler, weil mehrere Leute im Betrieb hinter derselben
 * Adresse sitzen und sich vertippen dürfen. Niedrig genug, dass
 * Durchprobieren auf ein Konto nicht funktioniert.
 */
export const SIGN_IN_ATTEMPTS_PER_ACCOUNT = 20

/**
 * Der Benutzername im Anmeldeversuch — nur zum Zählen.
 *
 * Geprüft wird er trotzdem, auch wenn er nur einen Eimer benennt: eine
 * Zeichenkette aus dem Netz wird nirgends ungeprüft weitergereicht.
 */
const throttleKeySchema = v.object({
  username: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.minLength(1),
    v.maxLength(64),
  ),
})

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? event.path
  if (!path.startsWith('/api/auth/')) return
  if (event.method !== 'POST') return

  const isSignIn = path.startsWith('/api/auth/sign-in')
  const address = clientIp(event, trustsProxy(useRuntimeConfig().trustProxy))

  const byAddress = consume(
    `auth:${isSignIn ? 'sign-in' : 'other'}:${address}`,
    isSignIn ? SIGN_IN_ATTEMPTS_PER_MINUTE : OTHER_AUTH_CALLS_PER_MINUTE,
  )
  if (!byAddress.allowed) return refuse(event, byAddress.retryAfter)

  if (!isSignIn) return

  // Zweiter Zähler auf das Konto. Der Rumpf wird hier gelesen und von h3
  // zwischengespeichert, der Endpoint liest ihn gleich noch einmal.
  const attempt = await peekValidatedBody(event, throttleKeySchema)
  if (!attempt) return
  const username = attempt.username

  const byAccount = consume(`auth:sign-in:konto:${username}`, SIGN_IN_ATTEMPTS_PER_ACCOUNT)
  if (!byAccount.allowed) {
    await recordSignInAttempt({
      username,
      clientAddress: address,
      succeeded: false,
      reason: 'drossel',
    })
    return refuse(event, byAccount.retryAfter)
  }

  // P-13: die längere Rechnung. Sie kostet eine Abfrage, aber erst nachdem die
  // beiden Zähler durch sind — eine Flut erreicht sie also nie.
  const lock = await accountLock(username)
  if (lock.locked) {
    await recordSignInAttempt({
      username,
      clientAddress: address,
      succeeded: false,
      reason: 'kontosperre',
    })
    return refuse(event, lock.retryAfter, lockMessage(lock))
  }
})

/** Weist ab und sagt, wie lange. */
function refuse(
  event: Parameters<typeof setResponseHeader>[0],
  retryAfter: number,
  message = 'Zu viele Versuche. Bitte warten Sie eine Minute.',
): never {
  setResponseHeader(event, 'Retry-After', retryAfter)
  throw tooManyRequests(message)
}
