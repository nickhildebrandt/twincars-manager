/**
 * Die gestaffelte Sperre nach Fehlversuchen (P-13, P-15, P-22).
 *
 * Die Drossel je Minute ist eine **Bremse**: nach einer Minute geht es weiter.
 * Wer geduldig ist, kommt damit durch. Hier zählt deshalb ein **Tag**, und die
 * Folgen werden mit jeder Stufe deutlicher.
 *
 * **Gezählt wird zweifach, mit verschiedenen Maßen** (P-15). Ein Fehlversuch
 * auf einen **bekannten** Benutzernamen ist meist ein Vertipper: jemand, der
 * sein eigenes Passwort sucht. Ein Fehlversuch auf einen **unbekannten**
 * Namen ist keiner — niemand vertippt sich im eigenen Benutzernamen zehnmal.
 * Also ist die Adresse strenger als das Konto:
 *
 * | Fehlversuche in 24 h | Konto (Name stimmt) | Adresse (Name stimmt nicht) |
 * | --- | --- | --- |
 * | ab 10 / ab 5 | 10 Minuten Ruhe | 10 Minuten Ruhe |
 * | ab 20 / ab 10 | 24 Stunden Ruhe | 24 Stunden Ruhe |
 * | ab 40 / ab 20 | dauerhaft | dauerhaft |
 *
 * Ein Fehlversuch auf ein bekanntes Konto zählt für **beides**: das Konto und
 * die Adresse, von der aus geklopft wurde.
 *
 * **Der sichere Bereich geht vor** (P-22). Was in `company_settings`
 * eingetragen ist, wird nie gesperrt — sonst sperrt ein einziger Vertipper im
 * Haus den ganzen Betrieb aus, weil alle hinter derselben Adresse sitzen. Leer
 * gelassen gilt die Sperre überall; die Ausnahme soll jemand bewusst eintragen.
 *
 * Eine Adresssperre gilt nur für **neue Anmeldungen**. Wer schon angemeldet
 * ist, arbeitet weiter.
 *
 * **Die ersten beiden Stufen werden gerechnet, nicht gespeichert.** Es gibt
 * kein Feld „gesperrt", das irgendwer wieder aufräumen müsste; ein vergessener
 * Aufräumer sperrt sonst jemanden aus. Sie ergeben sich aus dem Protokoll und
 * enden von selbst.
 *
 * **Die letzte Stufe wird festgehalten** — beim Konto in `users.locked_at`,
 * bei der Adresse in `address_locks.locked_at` — und zwar genau deshalb:
 * gerechnet wäre sie nach vierundzwanzig Stunden von selbst weg, weil die
 * Fehlversuche aus dem Zählfenster fallen. Das wäre keine dauerhafte Sperre,
 * sondern die zweite Stufe unter anderem Namen.
 */
import { and, desc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { addressLocks, companySettings, signInAttempts, users } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'
import { isSafeAddress } from '#shared/ip-range'

/** Wie weit zurück gezählt wird. */
export const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000

const TEN_MINUTES = 10 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000

/**
 * Eine Stufe: ab wie vielen Fehlversuchen, und wie lange.
 *
 * `duration: null` heißt dauerhaft.
 */
export type LockStep = { failures: number, duration: number | null }

/**
 * Die Stufen für ein **bekanntes Konto**, von der schärfsten zur mildesten.
 *
 * Großzügiger als bei der Adresse: hier sucht meist jemand sein eigenes
 * Passwort. Geprüft wird von oben nach unten, damit die schärfste zutreffende
 * Stufe gewinnt.
 */
export const ACCOUNT_STEPS: readonly LockStep[] = [
  { failures: 40, duration: null },
  { failures: 20, duration: ONE_DAY },
  { failures: 10, duration: TEN_MINUTES },
]

/**
 * Die Stufen für eine **Adresse**. Halb so viel Geduld.
 *
 * Wer einen Benutzernamen errät, der es nicht gibt, sucht nicht sein Passwort,
 * sondern probiert durch.
 */
export const ADDRESS_STEPS: readonly LockStep[] = [
  { failures: 20, duration: null },
  { failures: 10, duration: ONE_DAY },
  { failures: 5, duration: TEN_MINUTES },
]

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

/** Eine festgehaltene Sperre, die niemand mehr aufgehoben hat. */
const stillHeld = (lockedAt: Date | null | undefined, unlockedAt: Date | null | undefined) =>
  Boolean(lockedAt) && !(unlockedAt && unlockedAt > lockedAt!)

const permanently = (scope: LockScope, failures = 0): Lock =>
  ({ locked: true, scope, permanent: true, retryAfter: 0, failures })

/**
 * Wertet eine Reihe von Fehlversuchen aus, neueste zuerst.
 *
 * Die Ruhezeit läuft ab dem **letzten** Versuch, nicht ab dem ersten — sonst
 * wartete jemand das Fenster ab und klopfte weiter, als wäre nichts gewesen.
 */
export function evaluate(
  attempts: { at: string }[],
  steps: readonly LockStep[],
  scope: LockScope,
  now: Date,
): Lock {
  const step = steps.find(candidate => attempts.length >= candidate.failures)
  if (!step) return { ...OPEN, failures: attempts.length }

  if (step.duration === null) return permanently(scope, attempts.length)

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

/** Der sichere Adressbereich aus den Einstellungen. Fehlt er, ist er leer. */
export async function safeRangeSetting(executor: Executor = useDatabase()): Promise<string> {
  const [row] = await executor
    .select({ ranges: companySettings.safeIpRanges })
    .from(companySettings)
    .limit(1)

  return row?.ranges ?? ''
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

  return latestOf(windowStart, lastSuccess?.at, account?.unlockedAt)
}

/** Der späteste der angegebenen Zeitpunkte. */
function latestOf(fallback: Date, ...candidates: (string | Date | null | undefined)[]): Date {
  let latest = fallback
  for (const candidate of candidates) {
    if (!candidate) continue
    const at = candidate instanceof Date ? candidate : new Date(candidate)
    if (at > latest) latest = at
  }
  return latest
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

  if (stillHeld(account?.lockedAt, account?.unlockedAt)) return permanently('konto')

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

  return evaluate(attempts, ACCOUNT_STEPS, 'konto', now)
}

/**
 * Ob die Adresse gerade ruht.
 *
 * Zuerst der **sichere Bereich** (P-22): was darin liegt, wird nie gesperrt,
 * und zwar bevor überhaupt gezählt wird. Danach die dauerhafte Sperre aus
 * `address_locks`, dann die gerechneten Stufen.
 *
 * Gezählt wird ab dem spätesten von drei Zeitpunkten: Fensterbeginn, letzte
 * gelungene Anmeldung von dieser Adresse, letzte Freigabe durch einen
 * Administrator.
 *
 * `safeRanges` darf mitgegeben werden, wenn der Aufrufer die Einstellung schon
 * hat — die Übersicht in den Einstellungen liest sie sonst je Adresse neu.
 */
export async function addressLock(
  rawAddress: string | null,
  now: Date = new Date(),
  executor: Executor = useDatabase(),
  safeRanges?: string,
): Promise<Lock> {
  const address = rawAddress?.trim().slice(0, 64)
  if (!address) return OPEN

  const ranges = safeRanges ?? await safeRangeSetting(executor)
  if (isSafeAddress(address, ranges)) return OPEN

  const [held] = await executor
    .select({ lockedAt: addressLocks.lockedAt, unlockedAt: addressLocks.unlockedAt })
    .from(addressLocks)
    .where(eq(addressLocks.address, address))
    .limit(1)

  if (stillHeld(held?.lockedAt, held?.unlockedAt)) return permanently('adresse')

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

  const since = latestOf(windowStart, lastSuccess?.at, held?.unlockedAt)

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

  return evaluate(attempts, ADDRESS_STEPS, 'adresse', now)
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
 * Hebt die Sperre einer Adresse auf — der Knopf in den Einstellungen (P-15).
 *
 * Auch für eine Adresse, zu der es noch keine Zeile gibt: die gerechneten
 * Stufen hinterlassen keine, und trotzdem soll der Knopf wirken. Deshalb wird
 * die Zeile angelegt, wenn sie fehlt.
 */
export async function unlockAddress(
  rawAddress: string,
  by: { userId?: string | null, userName?: string | null } = {},
  at: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<boolean> {
  const address = rawAddress.trim().slice(0, 64)
  if (address === '') return false

  await executor
    .insert(addressLocks)
    .values({
      address,
      unlockedAt: at,
      unlockedBy: by.userId ?? null,
      unlockedByName: by.userName?.slice(0, 200) ?? null,
    })
    .onConflictDoUpdate({
      target: addressLocks.address,
      set: {
        unlockedAt: at,
        unlockedBy: by.userId ?? null,
        unlockedByName: by.userName?.slice(0, 200) ?? null,
      },
    })

  return true
}

/** Eine Zeile der Übersicht „was ist gerade gesperrt". */
export type LockedAddress = Lock & {
  address: string
  /** Wann zuletzt von dieser Adresse aus geklopft wurde. */
  lastAttemptAt: string | null
  /** Wann sie dauerhaft gesperrt wurde, falls überhaupt. */
  lockedAt: Date | null
}

/**
 * Welche Adressen gerade gesperrt sind — für die Einstellungen (P-15).
 *
 * „In den Einstellungen muss genau sichtbar sein, was wo wie wann gesperrt
 * wurde." Gesucht wird unter zwei Gruppen: Adressen mit Fehlversuchen im
 * Fenster und Adressen mit festgehaltener Sperre. Die zweite Gruppe fehlte
 * sonst, sobald ihre Fehlversuche aus dem Fenster gefallen sind — gerade die
 * dauerhaft gesperrten also.
 */
export async function lockedAddresses(
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<LockedAddress[]> {
  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS)

  const recent = await executor
    .select({
      address: signInAttempts.clientAddress,
      lastAttemptAt: sql<string>`max(${signInAttempts.at})`.as('last_attempt_at'),
    })
    .from(signInAttempts)
    .where(and(
      isNotNull(signInAttempts.clientAddress),
      eq(signInAttempts.succeeded, false),
      gt(signInAttempts.at, windowStart.toISOString()),
    ))
    .groupBy(signInAttempts.clientAddress)

  const held = await executor
    .select({ address: addressLocks.address, lockedAt: addressLocks.lockedAt })
    .from(addressLocks)
    .where(isNotNull(addressLocks.lockedAt))

  const lastAttempt = new Map<string, string>()
  for (const row of recent) {
    if (row.address) lastAttempt.set(row.address, row.lastAttemptAt)
  }
  const lockedAt = new Map<string, Date | null>()
  for (const row of held) lockedAt.set(row.address, row.lockedAt)

  // Einmal lesen, nicht je Adresse: die Einstellung ist für alle dieselbe.
  const ranges = await safeRangeSetting(executor)

  const addresses = [...new Set([...lastAttempt.keys(), ...lockedAt.keys()])]
  const rows: LockedAddress[] = []

  for (const address of addresses) {
    const lock = await addressLock(address, now, executor, ranges)
    if (!lock.locked) continue

    rows.push({
      ...lock,
      address,
      lastAttemptAt: lastAttempt.get(address) ?? null,
      lockedAt: lockedAt.get(address) ?? null,
    })
  }

  // Das Dringendste zuerst: dauerhaft gesperrt, dann die meisten Fehlversuche.
  return rows.sort((a, b) =>
    Number(b.permanent) - Number(a.permanent) || b.failures - a.failures,
  )
}

/**
 * Zieht die Folgen aus einem Anmeldeversuch (P-13, letzte Stufe).
 *
 * Läuft **nach** der Bibliothek, weil erst dort feststeht, ob das Passwort
 * stimmte. Erreicht eine Zählung die oberste Stufe, wird die Sperre
 * festgehalten — ab da hilft nur noch der Administrator.
 *
 * Konto und Adresse werden getrennt betrachtet: ein Fehlversuch auf einen
 * unbekannten Namen kann kein Konto sperren, wohl aber die Adresse.
 *
 * Scheitert das, scheitert nicht die Anmeldung: der Fehler landet im Serverlog.
 */
export async function noteSignInOutcome(
  outcome: {
    username: string
    succeeded: boolean
    known: boolean
    clientAddress?: string | null
  },
  now: Date = new Date(),
  executor: Executor = useDatabase(),
): Promise<void> {
  if (outcome.succeeded) return

  try {
    if (outcome.known) await holdAccount(outcome.username, now, executor)
    if (outcome.clientAddress) await holdAddress(outcome.clientAddress, now, executor)
  }
  catch (error) {
    console.error('[anmeldung] Sperre konnte nicht festgehalten werden', error)
  }
}

/** Hält die dauerhafte Kontosperre fest, sobald die oberste Stufe erreicht ist. */
async function holdAccount(username: string, now: Date, executor: Executor): Promise<void> {
  const lock = await accountLock(username, now, executor)
  if (!lock.permanent || lock.failures < ACCOUNT_STEPS[0]!.failures) return

  await executor
    .update(users)
    .set({ lockedAt: now })
    .where(and(eq(users.username, normalise(username)), isNull(users.lockedAt)))
}

/** Dasselbe für die Adresse. Der sichere Bereich hält `addressLock` schon auf. */
async function holdAddress(rawAddress: string, now: Date, executor: Executor): Promise<void> {
  const address = rawAddress.trim().slice(0, 64)
  if (address === '') return

  const lock = await addressLock(address, now, executor)
  if (!lock.permanent || lock.failures < ADDRESS_STEPS[0]!.failures) return

  await executor
    .insert(addressLocks)
    .values({ address, lockedAt: now })
    .onConflictDoUpdate({
      target: addressLocks.address,
      // Nur setzen, solange keine steht: ein zweiter Fehlversuch soll die
      // Sperre nicht vordatieren und damit eine Freigabe rückgängig machen.
      set: { lockedAt: sql`coalesce(${addressLocks.lockedAt}, ${now.toISOString()})` },
    })
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
