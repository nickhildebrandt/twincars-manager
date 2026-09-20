/**
 * Das Protokoll aufräumen (P-20).
 *
 * Läuft nachts, ist wiederholbar und protokolliert selbst, was sie gelöscht
 * hat — sonst wäre ausgerechnet die Aufgabe, die Spuren entfernt, die einzige
 * ohne Spur.
 */
import { rotateAuditLog } from '../utils/audit-rotation.ts'
import { record } from '../utils/audit.ts'

export default defineTask({
  meta: {
    name: 'protokoll-rotieren',
    description: 'Alte Protokolleinträge nach Aufbewahrungsfrist entfernen',
  },
  async run() {
    const result = await rotateAuditLog()
    const removed = result.standard + result.sicherheit + result.anmeldeversuche

    await record({
      action: 'ausgefuehrt',
      severity: removed > 0 ? 'warnung' : 'info',
      entity: 'audit_log',
      note: `Protokoll rotiert: ${result.standard} Änderungen, `
        + `${result.sicherheit} Sicherheitsereignisse, `
        + `${result.anmeldeversuche} Anmeldeversuche entfernt.`,
    })

    return { result }
  },
})
