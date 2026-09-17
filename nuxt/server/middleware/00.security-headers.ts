/**
 * Was der Browser darf — auf jeder Antwort (M-40, P-21).
 *
 * Die Anwendung lieferte bisher **keine einzige** dieser Kopfzeilen aus. Sie
 * läuft im Haus, aber ein Cloud-Hosting bleibt offen (M-36), und ein Browser,
 * dem niemand etwas sagt, erlaubt alles: fremde Skripte, Einbetten in eine
 * fremde Seite, Raten des Inhaltstyps, die interne Adresse im Referrer.
 *
 * Läuft als **erstes** der Zwischenstücke, und das ist der ganze Punkt: die
 * Kopfzeilen gehören auf **jede** Antwort, auch auf die abgewiesene. Stünde es
 * hinter dem Wächter, käme eine 401-Antwort ohne jede Richtlinie heraus — und
 * eine Fehlerseite ohne Richtlinie ist eine Fehlerseite ohne Richtlinie.
 */
import { securityHeaders } from '../utils/security-headers.ts'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const headers = securityHeaders({
    origin: config.origin || config.betterAuthUrl,
    development: import.meta.dev,
  })

  for (const [name, value] of Object.entries(headers)) {
    setResponseHeader(event, name, value)
  }
})
