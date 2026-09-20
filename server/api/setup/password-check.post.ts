/**
 * Wie gut ein Passwort ist (P-14, E-23).
 *
 * Damit das Formular sagen kann, **woran** es liegt, bevor jemand auf
 * „Weiter" drückt. Die Antwort trägt nur Urteil und Sätze — nie das Passwort
 * und nie seinen Hash.
 */
import { passwordCheckSchema } from '#shared/schemas/setup'
import { judgePassword, refuseAfterSetup } from '../../services/setup-service.ts'
import { useValidatedBody } from '../../utils/validate.ts'

export default defineEventHandler(async (event) => {
  await refuseAfterSetup()
  const input = await useValidatedBody(event, passwordCheckSchema)

  return judgePassword(input.password, {
    username: input.username,
    displayName: input.displayName,
  })
})
