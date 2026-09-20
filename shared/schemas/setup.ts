/**
 * Was der Assistent über die Leitung schickt (T-010).
 *
 * Getrennt von `settings.ts`, weil es hier um den **Vorgang** geht und nicht
 * um die Felder: das erste Konto gibt es nur einmal, und die Passwortprüfung
 * braucht einen eigenen Weg, damit das Formular schon beim Tippen sagen kann,
 * woran es liegt.
 */
import * as v from 'valibot'
import { MINIMUM_LENGTH } from '../password-quality'
import { requiredText } from './primitives'

/**
 * Der Benutzername des ersten Administrators.
 *
 * Kleingeschrieben und ohne Leerzeichen: er wird beim Anmelden eingetippt,
 * und niemand soll raten müssen, ob er groß anfing. Die Schreibweise, die
 * jemand wählt, bleibt als Anzeigename erhalten.
 */
export const usernameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.minLength(3, 'Der Benutzername braucht mindestens 3 Zeichen.'),
  v.maxLength(64, 'Der Benutzername darf höchstens 64 Zeichen lang sein.'),
  v.regex(
    /^[a-z0-9._-]+$/,
    'Erlaubt sind Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.',
  ),
)

/**
 * Das Passwort — hier nur auf **Länge**.
 *
 * Die Muster und der Abgleich gegen Datenlecks laufen im Dienst (P-14,
 * E-23): Ersteres braucht den Benutzernamen und den Firmennamen, Letzteres
 * das Netz. Ein Schema, das beides könnte, wäre kein Schema mehr.
 */
export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(MINIMUM_LENGTH, `Das Passwort muss mindestens ${MINIMUM_LENGTH} Zeichen lang sein.`),
  v.maxLength(200, 'Das Passwort darf höchstens 200 Zeichen lang sein.'),
)

export const firstAdminSchema = v.object({
  username: usernameSchema,
  displayName: requiredText(200, 'Bitte den vollständigen Namen eingeben.'),
  password: passwordSchema,
})

/** Eine Anfrage, die nur wissen will, wie gut ein Passwort ist. */
export const passwordCheckSchema = v.object({
  password: v.pipe(v.string(), v.maxLength(200)),
  username: v.optional(v.pipe(v.string(), v.maxLength(64))),
  displayName: v.optional(v.pipe(v.string(), v.maxLength(200))),
})

export type FirstAdminInput = v.InferOutput<typeof firstAdminSchema>
