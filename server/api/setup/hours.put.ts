/**
 * Schritt 5: Öffnungszeiten (T-010).
 */
import { workshopWeekSchema } from '#shared/schemas/settings'
import { refuseAfterSetup, setupState } from '../../services/setup-service.ts'
import { saveWorkshopHours } from '../../services/settings-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const week = await useValidatedBody(event, workshopWeekSchema)
  await saveWorkshopHours(week)
  return setupState()
})
