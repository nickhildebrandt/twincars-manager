import { query } from '$app/server'
import { maxLength, object, pipe, string, trim } from 'valibot'
import { requirePermission } from '$lib/server/auth-guards'
import { exportDatevCsv } from '$lib/server/services/datev-export-service'

/**
 * DATEV Buchungsstapel-CSV-Export für den gewählten Zeitraum.
 *
 * Zieht alle Rechnungen (issueDate ∈ [from, to]) und Buchungen
 * (entryDate ∈ [from, to]) zusammen, mapt sie auf passende SKR03-nahe
 * Konten und liefert die CSV als base64 zurück. Der Aufrufer (Browser)
 * lädt die Datei direkt als `text/csv; charset=windows-1252` herunter.
 *
 * @group integration
 * @module ledger
 */
export const exportDatevRemote = query(
  object({
    from: pipe(string(), trim(), maxLength(10)),
    to: pipe(string(), trim(), maxLength(10))
  }),
  async ({ from, to }) => {
    requirePermission('ledger')
    const csv = await exportDatevCsv({ from, to })
    // `csv` is a Latin-1 string — every charCode is a CP1252 byte.
    // Buffer.from(s, 'latin1') turns that into the exact CP1252 byte
    // stream DATEV needs.
    const base64 = Buffer.from(csv, 'latin1').toString('base64')
    return {
      filename: `DATEV_${from}_bis_${to}.csv`,
      mime: 'text/csv; charset=windows-1252',
      data: base64
    }
  }
)
