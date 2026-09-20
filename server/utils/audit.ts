/**
 * Das Protokoll — wer hat wann von wo woran was gemacht (M-01, M-39).
 *
 * Eine Tabelle für beides: die gewöhnliche Änderung an einem Datensatz und das
 * Sicherheitsereignis. Wer wissen will, was am Dienstagnachmittag geschah,
 * soll an **einer** Stelle nachsehen; unterschieden wird durch das Gewicht.
 *
 * Drei Zusagen, die hier eingelöst werden:
 *
 *   - **Ein Eintrag je Speichervorgang, nicht je Feld** (P-17). „Am 4. März hat
 *     Anna die Anschrift und die Telefonnummer geändert" ist eine Auskunft;
 *     zwei Zeilen mit derselben Sekunde sind es nicht.
 *   - **Unveränderte Felder stehen nicht drin.** Sonst ersäuft der eine
 *     geänderte Wert in vierzig gleichen.
 *   - **Protokollieren hält nichts auf.** Scheitert das Schreiben, scheitert
 *     nicht der Vorgang — der Fehler landet im Serverlog. Ein volles Protokoll
 *     darf niemanden an der Arbeit hindern.
 *
 * Geändert wird hier nie (P-19). Es gibt in dieser Datei kein `update` und
 * kein `delete`; nur die Rotation löscht, und die steht in
 * `server/tasks/protokoll-rotieren.ts`.
 */
import type { H3Event } from 'h3'
import { auditLog } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'
import { clientIp, trustsProxy } from './client-ip.ts'
import type { AuditAction, AuditSeverity } from '#shared/domain'

/** Eine geänderte Stelle: was stand da, was steht jetzt da. */
export type FieldChange = {
  field: string
  before: unknown
  after: unknown
}

export type AuditEntry = {
  action: AuditAction
  severity?: AuditSeverity
  /** Tabellenname des betroffenen Datensatzes, falls es einen gibt. */
  entity?: string | null
  entityId?: string | null
  changes?: FieldChange[]
  /** Ein kurzer deutscher Satz, falls die Felder allein nichts sagen. */
  note?: string | null
  /** Wer. Ohne Angabe wird es aus dem Ereignis gelesen. */
  userId?: string | null
  userName?: string | null
  clientAddress?: string | null
}

/** Felder, die nie in ein Protokoll gehören. */
const NEVER_LOGGED = [
  'password',
  'passwordhash',
  'hash',
  'salt',
  'token',
  'secret',
  'apitoken',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'privatekey',
  'data',
]

/**
 * Ob ein Feld protokolliert werden darf.
 *
 * Ein Protokoll, das Passwörter und Zugangsschlüssel mitschreibt, ist selbst
 * das Leck. Geprüft wird auf Teilzeichenketten, damit auch `smtpPassword` und
 * `ebayAccessToken` erwischt werden — lieber ein Feld zu viel ausgelassen als
 * eines zu wenig.
 */
export function isLoggableField(field: string): boolean {
  const name = field.toLowerCase()
  return !NEVER_LOGGED.some(forbidden => name.includes(forbidden))
}

/**
 * Was sich zwischen zwei Zuständen geändert hat.
 *
 * Verglichen wird flach und nach Wert: `undefined` und `null` gelten als
 * dasselbe („nichts"), Objekte und Listen über ihre JSON-Form. Für die Felder
 * eines Formulars reicht das, und es hält den Eintrag lesbar.
 */
export function changesBetween(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldChange[] {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  const changes: FieldChange[] = []
  for (const field of [...fields].sort()) {
    if (!isLoggableField(field)) continue

    const previous = before?.[field] ?? null
    const next = after?.[field] ?? null
    if (sameValue(previous, next)) continue

    changes.push({ field, before: previous, after: next })
  }
  return changes
}

/** Gleichheit, wie ein Mensch sie meint: `null`, `undefined` und Fehlen sind eins. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Ein Datum vergleicht sich über seinen Wert, nicht über das Objekt: zwei
  // `Date` mit derselben Zeit sind nicht `===`.
  if (a instanceof Date || b instanceof Date) return isoOf(a) === isoOf(b)
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

const isoOf = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value))

/** Wer gerade handelt, so wie das Ereignis es weiß. */
function actorOf(event: H3Event | undefined) {
  if (!event) return { userId: null, userName: null, clientAddress: null }
  const auth = event.context.auth
  return {
    userId: auth?.userId ?? null,
    userName: auth?.displayName ?? auth?.username ?? null,
    clientAddress: clientIp(event, trustsProxy(useRuntimeConfig().trustProxy)),
  }
}

/**
 * Schreibt einen Eintrag.
 *
 * Fängt jeden Fehler ab: ein Protokoll, das den Vorgang mitreißt, ist
 * schlimmer als eine Lücke im Protokoll. Der Fehler landet im Serverlog, damit
 * die Lücke wenigstens auffällt.
 */
export async function record(
  entry: AuditEntry,
  event?: H3Event,
  executor: Executor = useDatabase(),
): Promise<void> {
  const actor = actorOf(event)
  try {
    await executor.insert(auditLog).values({
      userId: entry.userId ?? actor.userId,
      userName: (entry.userName ?? actor.userName)?.slice(0, 200) ?? null,
      clientAddress: (entry.clientAddress ?? actor.clientAddress)?.slice(0, 64) ?? null,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      action: entry.action,
      severity: entry.severity ?? 'info',
      changes: (entry.changes ?? []).filter(change => isLoggableField(change.field)),
      note: entry.note?.slice(0, 300) ?? null,
    })
  }
  catch (error) {
    console.error('[protokoll] Eintrag konnte nicht geschrieben werden', error)
  }
}

/**
 * Eine Änderung an einem Datensatz — der Regelfall.
 *
 * Gibt es nichts zu berichten, wird auch nichts geschrieben: ein Speichern
 * ohne Änderung ist kein Ereignis.
 */
export async function recordChange(
  change: {
    entity: string
    entityId: string
    action: AuditAction
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    note?: string
    severity?: AuditSeverity
  },
  event?: H3Event,
  executor: Executor = useDatabase(),
): Promise<void> {
  const changes = changesBetween(change.before, change.after)
  if (change.action === 'geaendert' && changes.length === 0 && !change.note) return

  await record({
    entity: change.entity,
    entityId: change.entityId,
    action: change.action,
    severity: change.severity ?? defaultSeverity(change.action),
    changes,
    note: change.note,
  }, event, executor)
}

/**
 * Ein Sicherheitsereignis — alles, was auffallen soll.
 *
 * Auch und gerade der **abgewiesene** Zugriff (P-18): ein 403 ist der
 * interessanteste Eintrag, den es gibt — jemand hat etwas versucht, das er
 * nicht darf.
 */
export async function recordSecurity(
  entry: Omit<AuditEntry, 'severity'>,
  event?: H3Event,
  executor: Executor = useDatabase(),
): Promise<void> {
  await record({ ...entry, severity: 'sicherheit' }, event, executor)
}

/** Welches Gewicht eine Handlung ohne weitere Angabe trägt. */
export function defaultSeverity(action: AuditAction): AuditSeverity {
  switch (action) {
    case 'angemeldet':
    case 'abgemeldet':
    case 'abgewiesen':
    case 'gesperrt':
    case 'entsperrt':
    case 'exportiert':
      return 'sicherheit'
    case 'geloescht':
    case 'archiviert':
      return 'warnung'
    default:
      return 'info'
  }
}
