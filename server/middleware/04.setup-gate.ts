/**
 * Das Setup-Tor — **serverseitig** (T-010, B-001).
 *
 * Solange `company_settings.setup_completed` falsch ist, führt jeder Weg zum
 * Assistenten. Danach führt der Assistent nirgendwohin.
 *
 * **Warum hier und nicht im Layout.** Beim Vorgänger leitete das
 * Wurzel-Layout per `goto('/setup')` um, und der Server schickte Anonyme nur
 * zur Anmeldung. Wer die Adresse eines Endpunkts kannte, kam daran vorbei:
 * die Daten lagen offen, bevor überhaupt jemand eingerichtet hatte. Eine
 * Umleitung im Client ist ein Vorschlag, kein Tor.
 *
 * **Warum als viertes Zwischenstück.** Es läuft nach der Sitzung (02) und
 * nach dem Riegel vor `/api` (03). Vorher wäre es teurer als nötig — jeder
 * Aufruf würde die Einstellungen lesen, auch der, den der Riegel ohnehin
 * abweist.
 *
 * **Warum die Antwort zwischengespeichert wird.** Der Zustand ändert sich
 * genau einmal im Leben einer Installation. Ihn bei jedem Bild, jedem Skript
 * und jeder Abfrage neu aus der Datenbank zu holen, wäre eine Abfrage je
 * Anfrage für eine Antwort, die immer dieselbe ist. Gespeichert wird nur das
 * **Ja**: das Nein muss jederzeit kippen können, sobald der Assistent fertig
 * ist.
 */
import { isSetupComplete } from '../services/settings-service.ts'
import { conflict } from '../utils/errors.ts'

/** Die Wege, die der Assistent selbst braucht. */
const SETUP_PATHS = ['/setup', '/api/setup'] as const

/**
 * Was auch vor dem Abschluss erreichbar bleibt.
 *
 * Das Gerüst der Seite, die Gesundheitsabfrage des Containers und die
 * Anmeldung der Bibliothek — Letzteres, weil der Assistent am Ende ein Konto
 * anlegt und die Anwendung danach eine Sitzung braucht.
 */
const ALWAYS_OPEN = ['/_nuxt', '/__nuxt', '/_ipx', '/api/health', '/api/auth', '/api/_'] as const

const under = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`)

/**
 * Einmal wahr, immer wahr.
 *
 * Kein Zwischenspeicher für das Nein: wer gerade abgeschlossen hat, soll
 * nicht auf ein Verfallsdatum warten.
 */
let completed = false

/** Für Tests: den Zwischenspeicher vergessen. */
export function resetSetupGate(): void {
  completed = false
}

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? event.path

  if (ALWAYS_OPEN.some(prefix => under(path, prefix))) return

  const isSetupPath = SETUP_PATHS.some(prefix => under(path, prefix))

  if (!completed) {
    completed = await isSetupComplete()
  }

  // Vor dem Abschluss: alles außer dem Assistenten ist zu.
  if (!completed) {
    if (isSetupPath) return
    return sendRedirect(event, '/setup', 302)
  }

  // Nach dem Abschluss: der Assistent ist zu. Dauerhaft.
  if (!isSetupPath) return

  if (path.startsWith('/api/')) {
    throw conflict('Die Einrichtung ist bereits abgeschlossen. Bitte die Einstellungen verwenden.')
  }

  return sendRedirect(event, '/', 302)
})
