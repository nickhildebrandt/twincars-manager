/**
 * Die Anmeldung, an ihrer Grenze geprüft.
 *
 * Der Benutzername wird an zwei Stellen gebraucht, bevor die Bibliothek ihn zu
 * sehen bekommt: die Drossel zählt damit (M-36), und der Catch-all schreibt
 * damit ins Protokoll. Beide Male ist es eine Zeichenkette aus dem Netz, und
 * eine solche wird hier nirgends ungeprüft weitergereicht — auch dann nicht,
 * wenn sie nur einen Zähler benennt.
 */
import * as v from 'valibot'

/** Der Benutzername eines Anmeldeversuchs — nur zum Zählen und Protokollieren. */
export const signInAttemptSchema = v.object({
  username: v.pipe(
    v.string('Bitte einen Benutzernamen eingeben.'),
    v.trim(),
    v.toLowerCase(),
    v.minLength(1, 'Bitte einen Benutzernamen eingeben.'),
    v.maxLength(64, 'Der Benutzername ist zu lang.'),
  ),
})

export type SignInAttemptKey = v.InferOutput<typeof signInAttemptSchema>
