/**
 * Die gestaffelte Kontosperre (P-13).
 *
 * Die Drossel je Minute ist eine **Bremse**: nach einer Minute geht es weiter.
 * Wer geduldig ist und die Adresse wechselt, kommt damit auf zwanzig Versuche
 * je Minute — rechnerisch knapp 29.000 am Tag auf ein Konto. Solange alles im
 * Haus läuft, ist das theoretisch; auf einem eigenen Server im Internet ist es
 * das nicht mehr, und genau das lässt M-36 ausdrücklich offen.
 *
 * Deshalb zählt hier zusätzlich eine **Stunde**: zwanzig Fehlversuche darin,
 * und das Konto ruht fünfzehn Minuten.
 *
 * **Der Zustand wird gerechnet, nicht gespeichert.** Es gibt kein Feld
 * „gesperrt", das irgendwer wieder zurücksetzen müsste — ein vergessener
 * Aufräumer sperrt sonst jemanden dauerhaft aus. Die Sperre ergibt sich aus dem
 * Protokoll der Fehlversuche und endet von selbst.
 *
 * **Der Administrator hebt sie sofort auf**, indem er `unlocked_at` am Benutzer
 * setzt: alles davor zählt nicht mehr mit. Das Protokoll bleibt unangetastet —
 * es ist eine Spur und wird nicht bereinigt.
 */
import { and, desc, eq, gt } from 'drizzle-orm'
import { signInAttempts, users } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'

/** Wie weit zurück gezählt wird. */
export const LOCK_WINDOW_MS = 60 * 60 * 1000

/** Wie viele Fehlversuche in diesem Fenster das Konto ruhen lassen. */
export const FAILURES_BEFORE_LOCK = 20

/** Wie lange es dann ruht. */
export const LOCK_DURATION_MS = 15 * 60 * 1000

export type AccountLock = {
  locked: boolean
  /** Wann es weitergeht. Nur gesetzt, solange gesperrt ist. */
  until?: Date
  /** Sekunden bis dahin, aufgerundet — für `Retry-After`. */
  retryAfter: number
  /** Fehlversuche, die im Fenster zählen. */
  failures: number
}

const normalise = (username: string) => username.trim().toLowerCase().slice(0, 64)

/**
 * Ab wann Fehlversuche für dieses Konto zählen.
 *
 * Der späteste von drei Zeitpunkten: der Beginn des Fensters, die letzte
 * erfolgreiche Anmeldung und das Entsperren durch den Administrator. Eine
 * gelungene Anmeldung beendet die Zählung, weil der Mensch offensichtlich der
 * Richtige war.
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
 * Gerechnet wird über den **letzten** Fehlversuch: die fünfzehn Minuten laufen
 * ab dem letzten Klopfen, nicht ab dem ersten. Sonst könnte jemand vor der
 * Sperre eine Stunde warten und dann weiterprobieren, als wäre nichts gewesen.
 */
export async function accountLock(
  rawUsername: string,
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<AccountLock> {
  const username = normalise(rawUsername)
  if (username === '') return { locked: false, retryAfter: 0, failures: 0 }

  const since = await countingSince(username, now, executor)

  const failures = await executor
    .select({ at: signInAttempts.at })
    .from(signInAttempts)
    .where(and(
      eq(signInAttempts.username, username),
      eq(signInAttempts.succeeded, false),
      gt(signInAttempts.at, since.toISOString()),
    ))
    .orderBy(desc(signInAttempts.at))

  if (failures.length < FAILURES_BEFORE_LOCK) {
    return { locked: false, retryAfter: 0, failures: failures.length }
  }

  const lastFailure = new Date(failures[0]!.at)
  const until = new Date(lastFailure.getTime() + LOCK_DURATION_MS)

  if (until <= now) {
    // Die Ruhezeit ist abgelaufen. Das Konto ist wieder offen, auch wenn die
    // Fehlversuche noch im Fenster stehen.
    return { locked: false, retryAfter: 0, failures: failures.length }
  }

  return {
    locked: true,
    until,
    retryAfter: Math.ceil((until.getTime() - now.getTime()) / 1000),
    failures: failures.length,
  }
}

/**
 * Hebt die Sperre auf. Der Weg des Administrators (T-034).
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
    .set({ unlockedAt: at })
    .where(eq(users.username, username))
    .returning({ id: users.id })

  return changed.length > 0
}

/** Der Satz, den ein gesperrtes Konto zu sehen bekommt. */
export function lockMessage(lock: AccountLock): string {
  const minutes = Math.max(1, Math.ceil(lock.retryAfter / 60))
  return `Dieses Konto ist nach zu vielen Fehlversuchen vorübergehend gesperrt. `
    + `Bitte versuchen Sie es in ${minutes} Minuten erneut oder wenden Sie sich an die Verwaltung.`
}
