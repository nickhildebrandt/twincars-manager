/**
 * Schritt 7: der erste Administrator (T-010).
 *
 * **Ohne Guard**, und zwar notwendigerweise: es gibt noch kein Konto, mit dem
 * man sich anmelden könnte. Geschützt ist der Weg dreifach — das Setup-Tor
 * lässt ihn nur vor dem Abschluss offen, der Dienst weist ihn ab, sobald ein
 * Benutzer existiert, und die Drossel zählt jeden Versuch mit.
 */
import { firstAdminSchema } from '#shared/schemas/setup'
import { createFirstAdmin, setupState } from '../../services/setup-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  const input = await useValidatedBody(event, firstAdminSchema)
  await createFirstAdmin(input, event)
  return setupState()
})
