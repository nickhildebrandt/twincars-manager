/**
 * Schreibt den Einmalwert an die eingebetteten Skripte des Rahmens (M-40).
 *
 * Eine gerenderte Seite trägt vier `<script>`: im Kopf die Importkarte, das
 * Modul des Einstiegspunkts und das Farbschema-Skript von Nuxt UI; am Ende des
 * Rumpfes die Laufzeitkonfiguration und den Seitenzustand. Drei davon werden
 * ausgeführt und brauchen die Erlaubnis der Inhaltsrichtlinie.
 *
 * Der Haken `render:html` reicht die Teile des Dokuments heraus, bevor sie
 * zusammengesetzt werden — der von Nuxt dokumentierte Weg für genau diese
 * Aufgabe.
 *
 * **`body` wird ausdrücklich nicht gestempelt.** Dort steht der gerenderte
 * Seiteninhalt. Ein `<script>`, das über eine Lücke da hineingeraten ist,
 * bekäme durch einen Stempel genau die Erlaubnis, die ihm die Richtlinie
 * verweigern soll — die Maßnahme höbe sich selbst auf. Gestempelt wird nur,
 * was der Rahmen selbst erzeugt: `head`, `bodyPrepend`, `bodyAppend`.
 *
 * Skripte, die eine Komponente in den Rumpf rendert, hätte der Haken
 * `render:html:chunk` — bisher gibt es keine.
 */
import { FRAMEWORK_PARTS, nonceOf, stampNonce } from '../utils/csp-nonce.ts'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const nonce = nonceOf(event)
    if (!nonce) return

    for (const part of FRAMEWORK_PARTS) {
      const chunks = html[part]
      for (let index = 0; index < chunks.length; index += 1) {
        chunks[index] = stampNonce(chunks[index]!, nonce)
      }
    }
  })
})
