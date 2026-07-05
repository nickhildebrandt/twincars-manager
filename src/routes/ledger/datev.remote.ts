import { query } from '$app/server'
import { object } from 'valibot'
import { requirePermission } from '$lib/server/auth-guards'
import { dateStringSchema } from '$lib/server/db/validation'
import { exportDatevCsv } from '$lib/server/services/datev-export-service'

/**
 * DATEV Buchungsstapel-CSV-Export für den gewählten Zeitraum.
 *
 * Pulls all booked invoices (issueDate in [from, to], status
 * sent/paid/storno — drafts and cancelled drafts are excluded) plus
 * ledger entries (entryDate in [from, to]), maps them onto SKR03-like
 * accounts and returns the CSV as base64. The caller (browser)
 * downloads it directly as `text/csv; charset=windows-1252`.
 *
 * @group integration
 * @module ledger
 */
export const exportDatevRemote = query(
  object({ from: dateStringSchema, to: dateStringSchema }),
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
