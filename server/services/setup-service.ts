/**
 * Der Einrichtungsassistent (T-010).
 *
 * Bis `company_settings.setup_completed` gesetzt ist, ist die Anwendung
 * **nicht benutzbar**: das Tor in `server/middleware/04.setup-gate.ts` weist
 * jeden Aufruf ab. Danach ist der Assistent **dauerhaft gesperrt** — es gibt
 * keinen Weg zurück über die Oberfläche.
 *
 * Zwei Dinge, die der Vorgänger falsch hatte:
 *
 *   - **Das Tor lief im Client.** Das Wurzel-Layout leitete per `goto` um,
 *     der Server schickte Anonyme nur zur Anmeldung. Wer die Adresse eines
 *     Endpunkts kannte, kam daran vorbei (B-001). Hier entscheidet der
 *     Server.
 *   - **Der Abschluss prüfte nichts.** Hier wird er verweigert, solange die
 *     Angaben fehlen, die jeder Beleg braucht — und solange es keinen
 *     Administrator gibt, der sich danach anmelden könnte.
 */
import { count, eq } from 'drizzle-orm'
import { roles, userRoles, users } from '../database/schema/index.ts'
import type { Executor, Transaction } from '../utils/db.ts'
import { useDatabase, withTransaction } from '../utils/db.ts'
import { createUserWithCredential } from '../utils/auth-accounts.ts'
import { recordSecurity } from '../utils/audit.ts'
import { badRequest, conflict } from '../utils/errors.ts'
import { loadSettings, saveSettings } from './settings-service.ts'
import { timesBreached } from '../utils/password-breach.ts'
import { OFFLINE_NOTICE, breachMessage, checkPasswordLocally } from '#shared/password-quality'
import type { H3Event } from 'h3'

/** Die Rolle, die der erste Benutzer bekommt. Sie kommt aus dem Seed. */
const ADMIN_ROLE = 'Administrator'

export type SetupState = {
  /** Ob die Einrichtung abgeschlossen ist. */
  completed: boolean
  /** Ob es schon einen Benutzer gibt. Danach ist Schritt 7 gesperrt. */
  hasUser: boolean
  /** Was noch fehlt, damit der Abschluss möglich ist — deutsche Sätze. */
  missing: string[]
}

/**
 * Was der Abschluss braucht.
 *
 * Nicht alles: eine Firma ohne Faxnummer kann arbeiten. Aber ein Beleg ohne
 * Absender ist keiner, und eine Anwendung ohne Administrator ist eine, in die
 * niemand hineinkommt.
 */
export async function setupState(executor: Executor = useDatabase()): Promise<SetupState> {
  const settings = await loadSettings(executor)
  const [tally] = await executor.select({ value: count() }).from(users)
  const userCount = tally?.value ?? 0

  const missing: string[] = []
  if (!settings.companyName.trim()) missing.push('Der Firmenname fehlt.')
  if (!settings.street.trim()) missing.push('Die Straße fehlt.')
  if (!settings.zip.trim()) missing.push('Die Postleitzahl fehlt.')
  if (!settings.city.trim()) missing.push('Der Ort fehlt.')
  if (!settings.email.trim()) missing.push('Die E-Mail-Adresse fehlt.')
  if (userCount === 0) missing.push('Es gibt noch kein Administrator-Konto.')

  return { completed: settings.setupCompleted, hasUser: userCount > 0, missing }
}

/** Weist jeden Aufruf ab, sobald die Einrichtung abgeschlossen ist. */
export async function refuseAfterSetup(executor: Executor = useDatabase()): Promise<void> {
  const settings = await loadSettings(executor)
  if (settings.setupCompleted) {
    throw conflict('Die Einrichtung ist bereits abgeschlossen. Bitte die Einstellungen verwenden.')
  }
}

/* ── Das erste Passwort ───────────────────────────────────────────────── */

export type PasswordVerdict = {
  ok: boolean
  problems: string[]
  /** Hinweis, wenn der Abgleich gegen Datenlecks nicht möglich war (E-23). */
  notice: string | null
}

/**
 * Prüft ein Passwort in allen drei Lagen (P-14, E-23).
 *
 * Die örtlichen Lagen laufen immer. Der Abgleich gegen echte Datenlecks
 * läuft, **wenn er kann** — und sagt es, wenn er nicht konnte. Eine Prüfung,
 * die still durchwinkt, erzeugt Vertrauen, das sie nicht deckt.
 */
export async function judgePassword(
  password: string,
  context: Parameters<typeof checkPasswordLocally>[1] = {},
  fetchImpl?: typeof fetch,
): Promise<PasswordVerdict> {
  const local = checkPasswordLocally(password, context)

  // Der Abruf kostet Zeit; wer schon an der Länge scheitert, soll nicht
  // zusätzlich darauf warten.
  if (!local.ok) return { ...local, notice: null }

  const times = await timesBreached(password, fetchImpl)
  const breach = breachMessage(times)

  if (breach) return { ok: false, problems: [breach], notice: null }

  return { ok: true, problems: [], notice: times === null ? OFFLINE_NOTICE : null }
}

/* ── Der erste Administrator ──────────────────────────────────────────── */

export type FirstAdmin = {
  username: string
  displayName: string
  password: string
}

/**
 * Legt den ersten Administrator an — und **nur** den ersten.
 *
 * Gibt es schon einen Benutzer, ist das ein 409. Sonst wäre dieser Weg eine
 * offene Tür: der Assistent ist ohne Anmeldung erreichbar, weil es vorher
 * niemanden gibt, der sich anmelden könnte.
 */
export async function createFirstAdmin(
  input: FirstAdmin,
  event?: H3Event,
  executor?: Executor,
): Promise<{ id: string }> {
  const run = async (tx: Transaction): Promise<{ id: string }> => {
    await refuseAfterSetup(tx)

    const [tally] = await tx.select({ value: count() }).from(users)
    if ((tally?.value ?? 0) > 0) {
      throw conflict('Es gibt bereits ein Konto. Der Assistent legt nur das erste an.')
    }

    const verdict = await judgePassword(input.password, {
      username: input.username,
      displayName: input.displayName,
      companyName: (await loadSettings(tx)).companyName,
    })
    if (!verdict.ok) throw badRequest(verdict.problems.join(' '))

    const { id } = await createUserWithCredential({
      username: input.username,
      displayName: input.displayName,
      password: input.password,
    }, tx)

    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, ADMIN_ROLE)).limit(1)
    if (!role) {
      // Die Rolle kommt aus dem Seed. Fehlt sie, ist die Datenbank nicht
      // fertig eingerichtet — und ein Administrator ohne Rechte wäre ein
      // Konto, mit dem niemand etwas anfangen kann.
      throw conflict('Die Rolle „Administrator" fehlt. Bitte die Vorgaben einspielen.')
    }

    await tx.insert(userRoles).values({ userId: id, roleId: role.id })

    await recordSecurity({
      action: 'angelegt',
      entity: 'users',
      entityId: id,
      userName: input.username,
      note: `Erster Administrator „${input.username}" im Einrichtungsassistenten angelegt`,
    }, event, tx)

    return { id }
  }

  return executor && 'rollback' in executor
    ? run(executor as Transaction)
    : withTransaction(run)
}

/* ── Abschluss ────────────────────────────────────────────────────────── */

/**
 * Schaltet die Anwendung frei.
 *
 * Danach ist `/setup` dauerhaft gesperrt. Der Schritt ist deshalb an
 * Bedingungen geknüpft, und sie werden **hier** geprüft und nicht im
 * Formular: wer den Endpunkt direkt aufruft, umgeht das Formular.
 */
export async function completeSetup(
  event?: H3Event,
  executor?: Executor,
): Promise<void> {
  const run = async (tx: Transaction): Promise<void> => {
    await refuseAfterSetup(tx)

    const state = await setupState(tx)
    if (state.missing.length > 0) {
      throw badRequest(`Die Einrichtung ist noch nicht vollständig. ${state.missing.join(' ')}`)
    }

    await saveSettings({ setupCompleted: true }, {}, event, tx)

    await recordSecurity({
      action: 'geaendert',
      entity: 'company_settings',
      note: 'Einrichtung abgeschlossen, die Anwendung ist freigeschaltet',
    }, event, tx)
  }

  return executor && 'rollback' in executor
    ? run(executor as Transaction)
    : withTransaction(run)
}
