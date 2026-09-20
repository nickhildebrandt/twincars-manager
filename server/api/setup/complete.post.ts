/**
 * Schritt 8: abschließen und freischalten (T-010).
 *
 * Danach ist `/setup` dauerhaft gesperrt. Die Bedingungen prüft der Dienst,
 * nicht das Formular: wer den Endpunkt direkt aufruft, umgeht das Formular.
 */
import { completeSetup } from '../../services/setup-service.ts'
import { resetSetupGate } from '../../middleware/04.setup-gate.ts'

export default defineEventHandler(async (event) => {
  await completeSetup(event)

  // Das Tor merkt sich das Ja. Hier ist der eine Augenblick, in dem es kippt.
  resetSetupGate()

  return { completed: true }
})
