/**
 * Die dritte Prüfschicht: Plausibilität und Zusammenhang (P-28).
 *
 * Festgelegt am 20.09.2026: „Überall starke Schema-Validation … Alle Eingaben
 * in der gesamten Applikation werden automatisch auf Plausibilität geprüft,
 * ebenso auf Zusammenhang und Kompatibilität mit anderen Eingaben und
 * Einstellungen."
 *
 * Drei Schichten, und jede beantwortet eine Frage, die die vorige nicht
 * beantworten **kann**:
 *
 * | Schicht | Frage | Wo |
 * | --- | --- | --- |
 * | 1 — Feld | Ist das überhaupt eine Zahl, ein Datum, eine IBAN? | `shared/schemas/primitives.ts` |
 * | 2 — Formular | Passen die Felder **zueinander**? | `v.check` / `v.forward` im Modulschema |
 * | 3 — Zusammenhang | Passt es zum **Bestand** und zu den **Einstellungen**? | hier |
 *
 * Schicht 3 braucht die Datenbank und gehört deshalb in den Dienst, nicht ins
 * Schema. Ein Kilometerstand von 80 000 ist als Zahl einwandfrei; dass das
 * Fahrzeug letztes Jahr schon bei 120 000 stand, weiß nur die Datenbank.
 *
 * **Der Ausgang ist derselbe wie bei Valibot**: ein 422 mit Feldfehlern, die
 * das Formular direkt an den richtigen Feldern anzeigt. Der Nutzer soll nicht
 * merken, welche Schicht ihn aufgehalten hat.
 */
import { validationFailed } from './errors.ts'

/** Eine Prüfung: ein Feld, ein deutscher Satz, eine Bedingung. */
export type Rule<T> = {
  /** Feldname wie im Formular — er entscheidet, wo der Fehler erscheint. */
  field: string
  /** Was der Nutzer liest. Ein Satz, der sagt, was zu tun ist. */
  message: string | ((value: T) => string)
  /** `true` heißt in Ordnung. Wird nur aufgerufen, wenn `when` zutrifft. */
  ok: (value: T) => boolean | Promise<boolean>
  /**
   * Wann die Prüfung überhaupt greift.
   *
   * Ohne Angabe: immer. Damit lässt sich „nur bei Rechnungen" oder „nur wenn
   * das Feld gefüllt ist" ausdrücken, ohne es in `ok` zu verstecken — dort
   * wäre der Unterschied zwischen „nicht geprüft" und „geprüft und in
   * Ordnung" nicht mehr zu sehen.
   */
  when?: (value: T) => boolean
}

/** Baut eine Regel typsicher, ohne den Typ zweimal hinzuschreiben. */
export const rule = <T>(spec: Rule<T>): Rule<T> => spec

/**
 * Prüft alle Regeln und wirft **einmal** mit allen Fehlern.
 *
 * Nicht bei der ersten Abweichung abbrechen: wer drei Felder falsch ausgefüllt
 * hat, soll das in einem Durchgang erfahren und nicht dreimal hintereinander
 * speichern müssen. Das ist derselbe Grund, aus dem Valibot im
 * `abortPipeEarly: false`-Modus läuft.
 *
 * Trägt ein Feld mehrere Fehler, gewinnt der **erste** — mehr als einen Satz
 * zeigt das Formular an einem Feld ohnehin nicht an, und der erste ist der,
 * den der Entwickler zuerst für wichtig hielt.
 */
export async function checkPlausibility<T>(rules: Rule<T>[], value: T): Promise<void> {
  const failures: Record<string, string> = {}

  for (const candidate of rules) {
    if (candidate.when && !candidate.when(value)) continue
    if (await candidate.ok(value)) continue
    if (failures[candidate.field]) continue

    failures[candidate.field] = typeof candidate.message === 'function'
      ? candidate.message(value)
      : candidate.message
  }

  if (Object.keys(failures).length > 0) throw validationFailed(failures)
}

/* ── Wiederkehrende Prüfungen ──────────────────────────────────────────────
   Die Fälle, die in jedem zweiten Formular vorkommen. Sie stehen hier, damit
   nicht jedes Modul seine eigene Fassung davon erfindet — und seine eigene
   Formulierung des Fehlersatzes. */

/** Ein Datum, das weiter in der Zukunft liegt, als der Betrieb plant. */
export const withinYears = (value: string | null | undefined, years: number, now = new Date()): boolean => {
  if (!value) return true
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return false

  const limit = new Date(now)
  limit.setFullYear(limit.getFullYear() + years)
  return at <= limit
}

/** Ein Datum, das nicht vor einer Grenze liegt. */
export const notBefore = (value: string | null | undefined, floor: string | null | undefined): boolean => {
  if (!value || !floor) return true
  return value >= floor
}

/** Ein Zeitraum, der nicht vor seinem Beginn endet. */
export const endsAfterStart = (from: string | null | undefined, until: string | null | undefined): boolean =>
  notBefore(until, from)

/**
 * Ein Wert, der nur steigen darf — Kilometerstand, Zählerstand.
 *
 * `null` als bisheriger Wert heißt „es gab noch keinen" und ist in Ordnung.
 */
export const notLowerThan = (value: number | null | undefined, floor: number | null | undefined): boolean => {
  if (value === null || value === undefined) return true
  if (floor === null || floor === undefined) return true
  return value >= floor
}

/**
 * Ein Wert innerhalb einer Spanne, in der er sein **kann**.
 *
 * Für Angaben, bei denen ein Vertipper teuer ist: ein Kilometerstand von
 * 1 800 000 ist kein Tippfehler-Kandidat, sondern fast sicher einer.
 */
export const withinRange = (value: number | null | undefined, low: number, high: number): boolean => {
  if (value === null || value === undefined) return true
  return value >= low && value <= high
}

/** Ein Text, der nicht nur aus Leerzeichen besteht — falls er überhaupt da ist. */
export const notBlank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim().length > 0
