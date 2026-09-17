/**
 * Die gestaffelte Sperre nach Fehlversuchen (P-13, P-15).
 *
 * Die Drossel je Minute ist eine **Bremse**: nach einer Minute geht es weiter.
 * Wer geduldig ist, kommt damit durch. Hier zählt deshalb ein **Tag**, und die
 * Folgen werden mit jeder Stufe deutlicher:
 *
 * | Fehlversuche in 24 h | Folge |
 * | --- | --- |
 * | 1–2 | nichts |
 * | ab 3 | 10 Minuten Ruhe |
 * | ab 10 | 24 Stunden Ruhe |
 * | ab 20 | dauerhaft — nur der Administrator hebt das auf |
 *
 * **Gezählt wird zweifach** (P-15). Ein Fehlversuch auf einen **unbekannten**
 * Benutzernamen sperrt die **Adresse** — es gibt kein Konto, das man sperren
 * könnte, und genau dieses Muster verrät den Angriff. Ein Fehlversuch auf ein
 * **bekanntes** Konto sperrt **beides**.
 *
 * Eine Adresssperre gilt nur für **neue Anmeldungen**. Wer schon angemeldet
 * ist, arbeitet weiter — sonst legte ein Tippfehler den halben Betrieb still,
 * weil im Haus alle hinter derselben Adresse sitzen.
 *
 * **Die ersten beiden Stufen werden gerechnet, nicht gespeichert.** Es gibt
 * kein Feld „gesperrt", das irgendwer wieder aufräumen müsste; ein vergessener
 * Aufräumer sperrt sonst jemanden aus. Sie ergeben sich aus dem Protokoll und
 * enden von selbst.
 *
 * **Die letzte Stufe wird festgehalten** (`users.locked_at`) — und zwar genau
 * deshalb: gerechnet wäre sie nach vierundzwanzig Stunden von selbst weg, weil
 * die Fehlversuche aus dem Zählfenster fallen. Das wäre keine dauerhafte
 * Sperre, sondern die zweite Stufe unter anderem Namen.
 */
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { signInAttempts, users } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'

/** Wie weit zurück gezählt wird. */
export const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Die Stufen, von der schärfsten zur mildesten.
 *
 * `duration: null` heißt dauerhaft. Geprüft wird von oben nach unten, damit
 * die schärfste zutreffende Stufe gewinnt.
 */
export const LOCK_STEPS = [
  { failures: 20, duration: null },
  { failures: 10, duration: 24 * 60 * 60 * 1000 },
  { failures: 3, duration: 10 * 60 * 1000 },
] as const

/** Die oberste Stufe — sie läuft nicht ab und wird deshalb festgehalten. */
const PERMANENT_STEP = LOCK_STEPS[0]

export type LockScope = 'konto' | 'adresse'

export type Lock = {
  locked: boolean
  /** Was gesperrt ist. Nur gesetzt, solange gesperrt. */
  scope?: LockScope
  /** Wann es weitergeht. Fehlt bei einer dauerhaften Sperre. */
  until?: Date
  /** Dauerhaft — nur der Administrator hebt sie auf. */
  permanent: boolean
  /** Sekunden bis dahin, aufgerundet — für `Retry-After`. */
  retryAfter: number
  /** Fehlversuche, die im Fenster zählen. */
  failures: number
}

const OPEN: Lock = { locked: false, permanent: false, retryAfter: 0, failures: 0 }

const normalise = (value: string) => value.trim().toLowerCase().slice(0, 64)

/** Sekunden bis zu einem Zeitpunkt, mindestens eine. */
const secondsUntil = (until: Date, now: Date) =>
  Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000))

/**
 * Wertet eine Reihe von Fehlversuchen aus, neueste zuerst.
 *
 * Die Ruhezeit läuft ab dem **letzten** Versuch, nicht ab dem ersten — sonst
 * wartete jemand das Fenster ab und klopfte weiter, als wäre nichts gewesen.
 */
function evaluate(attempts: { at: string }[], scope: LockScope, now: Date): Lock {
  const step = LOCK_STEPS.find(candidate => attempts.length >= candidate.failures)
  if (!step) return { ...OPEN, failures: attempts.length }

  if (step.duration === null) {
    return {
      locked: true,
      scope,
      permanent: true,
      retryAfter: 0,
      failures: attempts.length,
    }
  }

  const until = new Date(new Date(attempts[0]!.at).getTime() + step.duration)
  if (until <= now) return { ...OPEN, failures: attempts.length }

  return {
    locked: true,
    scope,
    until,
    permanent: false,
    retryAfter: secondsUntil(until, now),
    failures: attempts.length,
  }
}

/**
 * Ab wann Fehlversuche für ein Konto zählen.
 *
 * Der späteste von drei Zeitpunkten: der Beginn des Fensters, die letzte
 * gelungene Anmeldung und das Entsperren durch den Administrator. Wer
 * durchkam, war offensichtlich der Richtige.
 */
async function countingSince(
  username: string,
  now: Date,
  executor: Executor,
): Promise<Date> {
  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS)

  const [lastSuccess] = await executor
    .select({ at: signInAttempts.at })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.username, username),
      eq(signInAttempts.succeeded, true),
      gt(signInAttempts.at, windowStart.toISOString()),
    ))
    .orderBy(desc(signInAttempts.at))
    .limit(1)

  const [account] = await executor
    .select({ unlockedAt: users.unlockedAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  const candidates = [windowStart]
  if (lastSuccess?.at) candidates.push(new Date(lastSuccess.at))
  if (account?.unlockedAt) candidates.push(new Date(account.unlockedAt))

  return candidates.reduce((latest, candidate) => (candidate > latest ? candidate : latest))
}

/**
 * Ob das Konto gerade ruht — und wenn ja, wie lange noch.
 *
 * Die dauerhafte Sperre steht am Benutzer und wird **nicht** gerechnet: sonst
 * wäre sie nach vierundzwanzig Stunden von selbst weg, weil die Fehlversuche
 * aus dem Zählfenster fallen. Genau das wäre keine dauerhafte Sperre.
 */
export async function accountLock(
  rawUsername: string,
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<Lock> {
  const username = normalise(rawUsername)
  if (username === '') return OPEN

  const [account] = await executor
    .select({ lockedAt: users.lockedAt, unlockedAt: users.unlockedAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (account?.lockedAt && !(account.unlockedAt && account.unlockedAt > account.lockedAt)) {
    return { locked: true, scope: 'konto', permanent: true, retryAfter: 0, failures: 0 }
  }

  const since = await countingSince(username, now, executor)

  const attempts = await executor
    .select({ at: signInAttempts.at })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.username, username),
      eq(signInAttempts.succeeded, false),
      gt(signInAttempts.at, since.toISOString()),
    ))
    .orderBy(desc(signInAttempts.at))

  return evaluate(attempts, 'konto', now)
}

/**
 * Ob die Adresse gerade ruht.
 *
 * Gezählt wird ab der letzten gelungenen Anmeldung von dieser Adresse: wer
 * sich von hier aus anmelden konnte, ist offensichtlich kein Durchprobierer.
 * Ein Entsperren gibt es nicht je Adresse — der Administrator entsperrt das
 * Konto, und das setzt die Adresszählung nicht zurück. Sie läuft von selbst
 * ab.
 */
export async function addressLock(
  rawAddress: string | null,
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<Lock> {
  const address = rawAddress?.trim().slice(0, 64)
  if (!address) return OPEN

  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS)

  const [lastSuccess] = await executor
    .select({ at: signInAttempts.at })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.clientAddress, address),
      eq(signInAttempts.succeeded, true),
      gt(signInAttempts.at, windowStart.toISOString()),
    ))
    .orderBy(desc(signInAttempts.at))
    .limit(1)

  const since = lastSuccess?.at && new Date(lastSuccess.at) > windowStart
    ? new Date(lastSuccess.at)
    : windowStart

  const attempts = await executor
    .select({ at: signInAttempts.at })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.clientAddress, address),
      eq(signInAttempts.succeeded, false),
      gt(signInAttempts.at, since.toISOString()),
      // Nur was die Adresse zu verantworten hat: eine abgewiesene Anfrage ist
      // kein neuer Fehlversuch, sonst zählte sich eine Sperre selbst hoch.
      or(
        isNull(signInAttempts.reason),
        eq(signInAttempts.reason, 'passwort'),
        eq(signInAttempts.reason, 'unbekannt'),
      ),
    ))
    .orderBy(desc(signInAttempts.at))

  return evaluate(attempts, 'adresse', now)
}

/**
 * Hebt die Sperre eines Kontos auf. Der Weg des Administrators (T-034).
 *
 * Gibt zurück, ob es das Konto überhaupt gab — ein erfundener Benutzername
 * soll keinen Erfolg melden.
 */
export async function unlockAccount(
  rawUsername: string,
  at: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<boolean> {
  const username = normalise(rawUsername)
  if (username === '') return false

  const changed = await executor
    .update(users)
    // `lockedAt` wird nicht geleert, sondern überholt: wann gesperrt wurde,
    // bleibt sichtbar. Entscheidend ist, was später kam.
    .set({ unlockedAt: at })
    .where(eq(users.username, username))
    .returning({ id: users.id })

  return changed.length > 0
}

/**
 * Zieht die Folgen aus einem Anmeldeversuch (P-13, letzte Stufe).
 *
 * Läuft **nach** der Bibliothek, weil erst dort feststeht, ob das Passwort
 * stimmte. Erreicht die Zählung die oberste Stufe, wird die Sperre am Benutzer
 * festgehalten — ab da hilft nur noch der Administrator.
 *
 * Scheitert das, scheitert nicht die Anmeldung: der Fehler landet im Serverlog.
 */
export async function noteSignInOutcome(
  outcome: { username: string, succeeded: boolean, known: boolean },
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<void> {
  if (outcome.succeeded || !outcome.known) return

  try {
    const lock = await accountLock(outcome.username, now, executor)
    if (!lock.permanent || lock.failures < PERMANENT_STEP.failures) return

    await executor
      .update(users)
      .set({ lockedAt: now })
      .where(and(eq(users.username, normalise(outcome.username)), isNull(users.lockedAt)))
  }
  catch (error) {
    console.error('[anmeldung] Sperre konnte nicht festgehalten werden', error)
  }
}

/** Ob es diesen Benutzernamen gibt. Entscheidet, was gesperrt wird (P-15). */
export async function accountExists(
  rawUsername: string,
  executor: Executor = useDatabase(),
): Promise<boolean> {
  const username = normalise(rawUsername)
  if (username === '') return false

  const [found] = await executor
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  return found !== undefined
}

/** Der Satz, den ein gesperrter Zugang zu sehen bekommt. */
export function lockMessage(lock: Lock): string {
  const what = lock.scope === 'adresse' ? 'Von diesem Anschluss aus' : 'Dieses Konto'

  if (lock.permanent) {
    return `${what} sind zu viele Anmeldeversuche gescheitert. `
      + `Der Zugang ist gesperrt — bitte wenden Sie sich an die Verwaltung.`
  }

  const minutes = Math.ceil(lock.retryAfter / 60)
  const wait = minutes >= 60
    ? `${Math.ceil(minutes / 60)} Stunden`
    : `${minutes} Minuten`

  return `${what} sind zu viele Anmeldeversuche gescheitert. `
    + `Bitte versuchen Sie es in ${wait} erneut oder wenden Sie sich an die Verwaltung.`
}
