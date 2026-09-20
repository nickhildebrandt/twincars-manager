/**
 * Die Farben der Anwendung — und sonst nichts.
 *
 * **Nuxt UI wird so verwendet, wie es kommt.** Keine Slot-Überschreibungen,
 * keine eigenen Varianten, keine nachgebauten Komponenten. Was Nuxt UI
 * mitbringt, wird benutzt; was es nicht mitbringt, wird zur offenen Frage
 * (Regel 15) statt zu einem Nachbau.
 *
 * Bis zum 20.09.2026 standen hier drei Überschreibungen, und keine hat sich
 * gerechnet:
 *
 *   - `card.slots.root` zwang jeder Karte `shadow-none` und einen eigenen
 *     Radius auf. Das ist genau die „große Veränderung", die nicht sein soll —
 *     und es verdeckte, dass Nuxt UI seine Karten bereits ruhig gestaltet.
 *   - `button.defaultVariants` setzte `primary`/`solid`/`md`. Das **sind** die
 *     Vorgaben von Nuxt UI; die Zeilen sahen nach Entscheidung aus und waren
 *     wirkungslos.
 *   - `table.slots.tr` bastelte einen Zeigefinger über ein erfundenes Attribut
 *     `data-selectable`. `UTable` hat dafür `@select` und macht es selbst.
 *
 * Die Farbliste bleibt: sie ist keine Gestaltung, sondern die Zuordnung von
 * Bedeutungen — was „Erfolg" heißt und was „Fehler", muss die Anwendung
 * festlegen.
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'slate',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },
  },
})
