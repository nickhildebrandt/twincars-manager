/**
 * Schritt 3: Steuer und Bank (T-010).
 */
import { companyTaxSchema } from '#shared/schemas/settings'
import { refuseAfterSetup, setupState } from '../../services/setup-service.ts'
import { saveCompanyTax } from '../../services/settings-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const input = await useValidatedBody(event, companyTaxSchema)
  await saveCompanyTax(input, {}, event)
  return setupState()
})
