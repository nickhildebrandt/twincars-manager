import { command } from '$app/server'
import { error } from '@sveltejs/kit'
import { boolean, maxLength, object, optional, pipe, string } from 'valibot'
import { requirePermission } from '$lib/server/auth-guards'
import { importMdb } from '$lib/server/services/import-service'

/**
 * Importiert eine KFZ-Kaufmann (.mdb) Datei. Der Client schickt sie als
 * base64-Data-URL — die maximale Länge deckt ein ~30 MB MDB-File mit
 * ~33% base64-Overhead ab.
 *
 * @group integration
 * @module import
 */
export const runMdbImportRemote = command(
  object({
    /**
     * Data-URL der Form `data:application/octet-stream;base64,…`
     * oder reines base64 (beide werden akzeptiert).
     */
    fileBase64: pipe(string(), maxLength(60_000_000)),
    /**
     * Vorschau-Modus: parst + mappt + validiert die MDB und liefert die
     * vollständige Zusammenfassung inkl. Drop-Bericht zurück, ohne die
     * Datenbank zu leeren oder zu beschreiben. Der Nutzer prüft das
     * Ergebnis und startet erst dann den echten (destruktiven) Import.
     */
    dryRun: optional(boolean())
  }),
  async ({ fileBase64, dryRun }) => {
    requirePermission('import')
    const idx = fileBase64.indexOf(',')
    const b64 = idx === -1 ? fileBase64 : fileBase64.slice(idx + 1)
    let buffer: Buffer
    try {
      buffer = Buffer.from(b64, 'base64')
    } catch {
      error(400, 'Datei konnte nicht gelesen werden.')
    }
    if (buffer.length < 1024) {
      error(400, 'Datei ist zu klein für eine gültige Access-Datenbank.')
    }
    return importMdb(buffer, { dryRun: dryRun ?? false })
  }
)
