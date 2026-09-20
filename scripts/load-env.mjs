/**
 * Die `.env` lesen, falls die Umgebung noch nichts mitbringt.
 *
 * Im Container kommt die Umgebung von außen, und dann wird hier nichts
 * gelesen — eine Datei zu bevorzugen, die dort gar nicht liegt, wäre eine
 * stille Falle. Auf dem Entwicklungsrechner gibt es die Umgebung dagegen nur
 * in der Datei: `nuxt dev` liest sie selbst, ein Skript nicht. Ohne diese
 * Zeilen meldete `pnpm db:migrate` dort „DATABASE_URL fehlt", obwohl die
 * Datei danebenliegt.
 *
 * `process.loadEnvFile` ist Node-Bordmittel (ab 20.12) — kein Paket dafür.
 *
 * Steht hier und nicht zweimal in den Skripten: dieselbe Sache an zwei
 * Stellen ist eine Stelle zu viel, und die zweite wird beim nächsten Mal
 * vergessen.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

/**
 * @param {string[]} required Namen, die vorhanden sein müssen. Fehlt einer
 *   auch nach dem Lesen, bricht der Aufrufer ab — nicht diese Funktion.
 * @returns {string[]} die Namen, die weiterhin fehlen.
 */
export function loadEnv(required = []) {
  const missing = () => required.filter(name => !process.env[name])

  if (missing().length > 0) {
    const envFile = fileURLToPath(new URL('../.env', import.meta.url))
    if (existsSync(envFile)) process.loadEnvFile(envFile)
  }

  return missing()
}
