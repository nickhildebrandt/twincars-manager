/**
 * Schritt 2: Firmendaten (T-010).
 */
import { companyProfileSchema } from '#shared/schemas/settings'
import { refuseAfterSetup, setupState } from '../../services/setup-service.ts'
import { saveCompanyProfile } from '../../services/settings-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const input = await useValidatedBody(event, companyProfileSchema)
  await saveCompanyProfile(input, {}, event)
  return setupState()
})
