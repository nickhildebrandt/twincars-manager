/**
 * Wo der Assistent steht (T-010).
 *
 * **Ohne Guard** — und das ist kein Versehen: vor dem Abschluss gibt es
 * niemanden, der sich anmelden könnte. Das Setup-Tor (`04.setup-gate.ts`)
 * lässt diesen Weg nur offen, solange die Einrichtung läuft; danach antwortet
 * es mit 409, bevor dieser Endpunkt überhaupt erreicht wird.
 */
import { setupState } from '../../services/setup-service.ts'

export default defineEventHandler(async () => {
  return setupState()
})
