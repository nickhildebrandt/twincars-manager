import { command } from '$app/server'
import { error } from '@sveltejs/kit'
import { maxLength, object, pipe, string } from 'valibot'
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
    fileBase64: pipe(string(), maxLength(60_000_000))
  }),
  async ({ fileBase64 }) => {
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
    return importMdb(buffer)
  }
)
