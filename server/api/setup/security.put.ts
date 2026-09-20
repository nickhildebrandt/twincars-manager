/**
 * Schritt 7: Administrator-Adresse und sicherer Adressbereich (T-010).
 */
import { securitySettingsSchema } from '#shared/schemas/settings'
import { refuseAfterSetup, setupState } from '../../services/setup-service.ts'
import { saveSecuritySettings } from '../../services/settings-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const input = await useValidatedBody(event, securitySettingsSchema)
  await saveSecuritySettings(input, {}, event)
  return setupState()
})
