/**
 * Validates the environment once at boot. A missing or implausible value stops
 * the process instead of surfacing as a confusing failure later
 * (../../docs/rewrite/03-architektur.md §6.6).
 *
 * The message names the variable, never its value.
 */
import * as v from 'valibot'
import { envSchema } from '#shared/schemas/env'
import '#shared/schemas/messages'

export default defineNitroPlugin(() => {
  const result = v.safeParse(envSchema, process.env)

  if (!result.success) {
    const lines = result.issues.map((issue) => {
      const variable = v.getDotPath(issue) ?? 'Umgebung'
      return `  ${variable}: ${issue.message}`
    })
    const unique = [...new Set(lines)]

    console.error(
      '\nDie Konfiguration ist unvollständig. Die Anwendung startet nicht.\n'
      + `${unique.join('\n')}\n\n`
      + 'Vorlage: .env.example\n',
    )
    throw new Error('Ungültige Konfiguration: ' + unique.length + ' Problem(e).')
  }
})
