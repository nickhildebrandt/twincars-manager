/**
 * Schritt 4: Belegvorgaben, Nummernkreise und Stundensatz (T-010).
 */
import { documentDefaultsSchema } from '#shared/schemas/settings'
import { refuseAfterSetup, setupState } from '../../services/setup-service.ts'
import { saveDocumentDefaults } from '../../services/settings-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const input = await useValidatedBody(event, documentDefaultsSchema)
  await saveDocumentDefaults(input, {}, event)
  return setupState()
})
