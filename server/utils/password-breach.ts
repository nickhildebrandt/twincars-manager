/**
 * Der Abgleich gegen echte Datenlecks, ohne das Passwort preiszugeben (E-23).
 *
 * **Wie das geht.** Vom SHA-1 des Passworts gehen nur die **ersten fünf
 * Zeichen** an den Dienst. Der antwortet mit allen Hashes, die so beginnen —
 * einige hundert. Verglichen wird **hier**. Der Dienst erfährt weder das
 * Passwort noch seinen vollständigen Hash, und aus fünf Zeichen lässt sich
 * nichts zurückrechnen.
 *
 * Das Verfahren heißt k-Anonymität und ist das Gegenteil von „wir schicken
 * das Passwort mal eben zur Prüfung weg".
 *
 * **SHA-1 ist hier kein Fehler.** Es wird nichts damit gesichert; es ist der
 * Index, in dem nachgeschlagen wird. Der Dienst führt seine Sammlung so, also
 * wird so gefragt.
 *
 * **Scheitert der Abruf, scheitert nicht das Passwort.** Die Anwendung läuft
 * im Haus, und der Server kommt womöglich nicht hinaus. Dann gibt es `null`,
 * der Aufrufer zeigt `OFFLINE_NOTICE` — und die Mindestanforderung greift
 * weiterhin. Eine Prüfung, die still durchwinkt, erzeugt Vertrauen, das sie
 * nicht deckt.
 */
import { createHash } from 'node:crypto'

/** Wohin gefragt wird. Nur das Präfix verlässt den Server. */
const RANGE_URL = 'https://api.pwnedpasswords.com/range/'

/**
 * Wie lange gewartet wird.
 *
 * Zwei Sekunden. Ein langsamer fremder Dienst darf das Anlegen eines
 * Benutzers nicht aufhalten — lieber ohne Abgleich und mit Hinweis als eine
 * Minute lang eine hängende Seite.
 */
const TIMEOUT_MS = 2_000

/** Der SHA-1 in Großbuchstaben, so wie der Dienst ihn führt. */
export const sha1Of = (value: string): string =>
  createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase()

/**
 * Zerlegt die Antwort und sucht den eigenen Rest.
 *
 * Die Antwort ist eine Zeile je Treffer: `RESTHASH:ANZAHL`. Getrennt
 * gehalten, damit sie ohne Netz prüfbar ist — und damit eine kaputte Antwort
 * nicht als „nicht gefunden" durchgeht.
 */
export function countInRange(body: string, suffix: string): number {
  for (const rawLine of body.split('\n')) {
    const [hash, count] = rawLine.trim().split(':')
    if (!hash || !count) continue
    if (hash.toUpperCase() !== suffix) continue

    const times = Number.parseInt(count, 10)
    return Number.isFinite(times) ? times : 0
  }
  return 0
}

/**
 * Wie oft das Passwort in bekannten Lecks steht.
 *
 * `0` heißt „nicht gefunden", eine Zahl heißt „so oft gefunden", und `null`
 * heißt **„konnte nicht geprüft werden"**. Die drei sind ausdrücklich
 * verschieden: `null` als `0` zu behandeln wäre genau das stille Durchwinken,
 * das E-23 ausschließt.
 *
 * `fetchImpl` ist für die Tests da — sie dürfen das Netz nicht anfassen.
 */
export async function timesBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = TIMEOUT_MS,
): Promise<number | null> {
  if (password === '') return null

  const hash = sha1Of(password)
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)

  try {
    const response = await fetchImpl(`${RANGE_URL}${prefix}`, {
      signal: abort.signal,
      headers: {
        // Bittet den Dienst, die Antwort mit Blindeinträgen aufzufüllen. Ohne
        // das verrät allein die Länge der Antwort etwas über das Präfix.
        'Add-Padding': 'true',
        'User-Agent': 'TwinCarsManager',
      },
    })

    if (!response.ok) return null

    return countInRange(await response.text(), suffix)
  }
  catch {
    // Kein Netz, Zeitüberschreitung, kaputte Antwort — alles derselbe Fall:
    // es konnte nicht geprüft werden, und das wird auch so gesagt.
    return null
  }
  finally {
    clearTimeout(timer)
  }
}
