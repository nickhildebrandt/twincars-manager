/**
 * Wie gut ein Passwort sein muss (P-14, E-23).
 *
 * Es gibt keinen zweiten Faktor (M-36). Das Passwort ist die **einzige**
 * Hürde, und deshalb wird sie geprüft, bevor sie in Gebrauch geht.
 *
 * Drei Lagen, und die Reihenfolge ist Absicht:
 *
 *   1. **Länge** — reine Rechnung, läuft immer.
 *   2. **Muster** — `sommer2024`, `qwertz123`, der eigene Benutzername, der
 *      Firmenname. Läuft immer, kostet nichts und fängt genau die Passwörter,
 *      die in der Praxis fallen.
 *   3. **Abgleich gegen echte Datenlecks** — über das k-Anonymitäts-Verfahren,
 *      ohne das Passwort preiszugeben (E-23). Steht in
 *      `server/utils/password-breach.ts`, weil es das Netz braucht.
 *
 * **Warum Muster und nicht nur eine Liste.** Eine mitgelieferte Liste ist
 * immer von gestern und immer zu kurz. `sommer2024` steht in keiner Liste von
 * 2019 — als Muster „Wort plus Jahreszahl" ist es dagegen für immer erkannt.
 * Die Liste unten fängt die Handvoll Passwörter, die kein Muster hat; das
 * Rückgrat sind die Muster.
 *
 * **Keine Zusammensetzungsregeln.** Kein „mindestens ein Sonderzeichen, eine
 * Ziffer und ein Großbuchstabe". Das erzeugt `Passwort1!` und sonst nichts —
 * ein Passwort, das jede solche Regel erfüllt und in jeder Leckliste steht.
 * Länge und Unvorhersehbarkeit zählen, und genau die werden hier geprüft.
 *
 * Hier wird **nur gerechnet**: kein Netz, keine Datenbank. Damit läuft
 * dieselbe Prüfung im Formular und am Endpoint, und der Nutzer erfährt schon
 * beim Tippen, woran es liegt.
 */

/**
 * Die Mindestlänge.
 *
 * Zwölf, nicht acht: acht Zeichen sind mit einer Grafikkarte in Stunden
 * durchprobiert, wenn der Angreifer erst einmal an die Hashes kommt. Zwölf
 * ist die Grenze, ab der Länge tatsächlich hilft — und eine Losung aus drei
 * Wörtern erreicht sie mühelos.
 */
export const MINIMUM_LENGTH = 12

/** Wie viele verschiedene Zeichen mindestens vorkommen müssen. */
const MINIMUM_DISTINCT = 5

/** Das Urteil über ein Passwort. */
export type PasswordVerdict = {
  /** Ob es genommen werden darf. */
  ok: boolean
  /**
   * Was dagegen spricht — deutsche Sätze, die sagen, was zu tun ist.
   *
   * Mehrere, nicht einer: wer ein zu kurzes Passwort mit seinem eigenen Namen
   * eingibt, soll beides auf einmal erfahren.
   */
  problems: string[]
}

/** Was das Passwort **nicht** enthalten darf, weil es jeder erraten würde. */
export type PasswordContext = {
  username?: string | null
  displayName?: string | null
  companyName?: string | null
  email?: string | null
}

/**
 * Passwörter, die kein Muster haben und trotzdem jeder zuerst probiert.
 *
 * Bewusst kurz. Die lange Liste ist der Abgleich gegen echte Lecks (E-23) —
 * eine mitgelieferte Liste wäre immer von gestern.
 */
const NOTORIOUS = new Set([
  'passwort', 'password', 'passwort1', 'password1', 'passw0rt', 'p4ssw0rt',
  'geheim', 'admin', 'administrator', 'willkommen', 'welcome', 'letmein',
  'monkey', 'dragon', 'sunshine', 'princess', 'iloveyou', 'football',
  'master', 'shadow', 'superman', 'trustno1', 'starwars', 'baseball',
  'werkstatt', 'autohaus', 'twincars', 'kfz', 'garage', 'schrauber',
  'hallo', 'hallowelt', 'test', 'tester', 'demo', 'benutzer', 'user',
  'sommer', 'winter', 'fruehling', 'herbst', 'januar', 'dezember',
  'bayern', 'schalke', 'dortmund', 'deutschland', 'berlin', 'hamburg',
])

/** Tastaturreihen, in beide Richtungen. Die Fundgrube jedes Angreifers. */
const KEYBOARD_RUNS = [
  'qwertzuiop', 'asdfghjkl', 'yxcvbnm',
  'qwertyuiop', 'zxcvbnm',
  '1234567890', '0987654321',
  'abcdefghijklmnopqrstuvwxyz',
]

/** Buchstaben, die gern durch Ziffern ersetzt werden, zurückübersetzt. */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
}

/** Macht aus `P4ssw0rt!` ein `passwort` — damit ein Muster es wiedererkennt. */
function normalise(password: string): string {
  return password
    .toLowerCase()
    .replace(/[01345 7@$!]/g, character => LEET[character] ?? character)
    .replace(/[^a-zäöüß]/g, '')
}

/** Wie lang eine Tastaturreihe mindestens sein muss, um als eine zu gelten. */
const RUN_LENGTH = 6

/**
 * Das längste Stück des Passworts, das eine Tastaturreihe ist.
 *
 * Gesucht wird **innerhalb** des Passworts, nicht danach, ob das ganze
 * Passwort in einer Reihe steckt: `asdfghjklqwe` läuft über zwei Reihen und
 * wäre sonst durchgegangen. Sechs Zeichen sind die Grenze — kürzere Stücke
 * stecken zufällig in echten Wörtern.
 */
function longestKeyboardRun(value: string): number {
  const lower = value.toLowerCase()
  let longest = 0

  for (let start = 0; start < lower.length; start++) {
    for (let end = lower.length; end - start > longest; end--) {
      const piece = lower.slice(start, end)
      const isRun = KEYBOARD_RUNS.some((run) => {
        const backwards = [...run].reverse().join('')
        return run.includes(piece) || backwards.includes(piece)
      })
      if (isRun) {
        longest = piece.length
        break
      }
    }
  }

  return longest
}

/** Die Wörter, die im Passwort nichts zu suchen haben. */
function forbiddenWords(context: PasswordContext): string[] {
  const words: string[] = ['twincars', 'twincarsmanager']

  for (const source of [context.username, context.displayName, context.companyName]) {
    if (!source) continue
    // Jeder Bestandteil einzeln: „Muster Autohaus GmbH" verbietet auch
    // „muster" allein, denn genau das nimmt jemand als Passwort.
    for (const part of source.toLowerCase().split(/[^a-zäöüß0-9]+/)) {
      if (part.length >= 3) words.push(part)
    }
  }

  if (context.email) {
    const local = context.email.split('@')[0]?.toLowerCase() ?? ''
    if (local.length >= 3) words.push(local)
  }

  // Rechtsformen und Füllwörter sind keine Verbote — sonst wäre jedes
  // Passwort mit „und" darin abgelehnt.
  const NOISE = new Set(['gmbh', 'kg', 'ohg', 'mbh', 'und', 'der', 'die', 'das', 'com', 'de'])
  return [...new Set(words)].filter(word => !NOISE.has(word))
}

/**
 * Die Prüfung, die immer läuft.
 *
 * Gibt **alle** Beanstandungen zurück, nicht die erste: wer ein zu kurzes
 * Passwort mit seinem eigenen Namen eingibt, soll beides auf einmal erfahren
 * und nicht zweimal hintereinander abgewiesen werden.
 */
export function checkPasswordLocally(
  password: string,
  context: PasswordContext = {},
): PasswordVerdict {
  const problems: string[] = []

  if (password.length < MINIMUM_LENGTH) {
    problems.push(`Das Passwort muss mindestens ${MINIMUM_LENGTH} Zeichen lang sein.`)
  }

  if (password.trim() !== password) {
    problems.push('Das Passwort darf nicht mit einem Leerzeichen beginnen oder enden.')
  }

  const distinct = new Set(password.toLowerCase()).size
  if (password.length > 0 && distinct < MINIMUM_DISTINCT) {
    problems.push('Das Passwort besteht aus zu wenigen verschiedenen Zeichen.')
  }

  const bare = normalise(password)

  // Nicht nur Gleichheit: `P4ssw0rt1234` wird zu `passwortiea`, und das ist
  // dasselbe Passwort mit Zierrat. Ein bekanntes Wort am Anfang plus höchstens
  // vier weitere Zeichen zählt als dieses Wort.
  const notorious = [...NOTORIOUS].some(word =>
    bare === word || (bare.startsWith(word) && bare.length - word.length <= 4),
  )
  if (notorious) {
    problems.push('Dieses Passwort ist allgemein bekannt und wird zuerst probiert.')
  }

  // „sommer2024", „hallo1998!", „Muster2026" — das häufigste Muster überhaupt.
  if (/^[^\d]{3,}(?:19|20)\d{2}[^a-z\d]{0,2}$/i.test(password)) {
    problems.push('Ein Wort mit angehängter Jahreszahl wird als Erstes geraten.')
  }

  if (longestKeyboardRun(password) >= RUN_LENGTH) {
    problems.push('Das Passwort besteht im Wesentlichen aus einer Tastaturreihe.')
  }

  // Ein Wort, das mit einer kurzen Ziffernfolge endet, ist dasselbe Muster.
  const trailing = /^(.*?)(\d{1,4})[^a-z\d]{0,2}$/i.exec(password)
  if (trailing && NOTORIOUS.has(normalise(trailing[1]!))) {
    problems.push('Ein bekanntes Wort mit angehängten Ziffern ist kein eigenes Passwort.')
  }

  for (const word of forbiddenWords(context)) {
    if (bare.includes(word)) {
      problems.push('Das Passwort darf weder Ihren Namen noch den Firmennamen enthalten.')
      break
    }
  }

  return { ok: problems.length === 0, problems }
}

/**
 * Der Satz, der zu einer Fundzahl aus dem Abgleich gehört (E-23).
 *
 * `null` heißt „konnte nicht geprüft werden" und ist **kein** Fehler — aber
 * auch kein stilles Durchwinken: der Aufrufer zeigt den Hinweis an. Eine
 * Prüfung, die still durchwinkt, erzeugt Vertrauen, das sie nicht deckt.
 */
export function breachMessage(times: number | null): string | null {
  if (times === null) return null
  if (times === 0) return null

  return times >= 1000
    ? `Dieses Passwort steht in bekannten Datenlecks (über ${Math.floor(times / 1000)}-tausendmal gefunden). Bitte ein anderes wählen.`
    : `Dieses Passwort steht in bekannten Datenlecks (${times}-mal gefunden). Bitte ein anderes wählen.`
}

/** Der Hinweis, wenn der Abgleich nicht möglich war. */
export const OFFLINE_NOTICE
  = 'Der Abgleich gegen bekannte Passwörter war nicht möglich (keine Internetverbindung). '
    + 'Die Mindestanforderung ist erfüllt.'
