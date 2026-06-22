// @vitest-environment node
/**
 * Integration tests for the DATEV CSV export. We run against the in-mem
 * pg-mem instance so the date-range query, the supplier-derived account
 * mapping and the formatting can be exercised end-to-end.
 *
 * @group integration
 * @module datev-export-service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from '$lib/server/db/client'
import {
  documents,
  ledgerCategories,
  ledgerEntries
} from '$lib/server/db/schema'
import { exportDatevCsv } from './datev-export-service'

const seedInvoice = async (overrides: {
  documentNumber: string
  issueDate: string
  grossTotal: string
  status?: string
}) => {
  await db
    .insert(documents)
    .values({
      documentNumber: overrides.documentNumber,
      type: 'invoice',
      status: overrides.status ?? 'sent',
      issueDate: overrides.issueDate,
      taxRate: '19.00',
      netTotal: '100.00',
      taxTotal: '19.00',
      grossTotal: overrides.grossTotal,
      discountTotal: '0.00'
    })
}

const seedLedger = async (overrides: {
  direction: 'income' | 'expense'
  entryDate: string
  amountGross: string
  description: string
  entryNumber?: string
  categoryId?: string | null
}) => {
  await db
    .insert(ledgerEntries)
    .values({
      direction: overrides.direction,
      entryDate: overrides.entryDate,
      amountGross: overrides.amountGross,
      amountNet: overrides.amountGross,
      taxAmount: '0',
      taxRate: '0',
      description: overrides.description,
      paymentStatus: 'paid',
      source: 'manual',
      entryNumber: overrides.entryNumber,
      categoryId: overrides.categoryId ?? null
    })
}

describe('exportDatevCsv', () => {
  beforeEach(async () => {
    await db.delete(ledgerEntries)
    await db.delete(documents)
    await db.delete(ledgerCategories)
  })

  it('starts with the DATEV EXTF/Buchungsstapel header line', async () => {
    await seedInvoice({
      documentNumber: 'RE-2026-0001',
      issueDate: '2026-03-15',
      grossTotal: '119.00'
    })
    const csv = await exportDatevCsv({ from: '2026-01-01', to: '2026-12-31' })
    const firstLine = csv.split('\r\n')[0]
    expect(firstLine.startsWith('"EXTF";700;21;"Buchungsstapel";7;')).toBe(true)
    // Buchungsstapel header carries the WJ-Beginn 20260101 and date range.
    expect(firstLine).toContain('20260101')
    expect(firstLine).toContain('20260101;20261231')
  })

  it('emits one row per invoice that falls into the range', async () => {
    await seedInvoice({
      documentNumber: 'RE-2026-0001',
      issueDate: '2026-03-15',
      grossTotal: '119.00'
    })
    await seedInvoice({
      documentNumber: 'RE-2026-0002',
      issueDate: '2026-04-20',
      grossTotal: '238.00'
    })
    const csv = await exportDatevCsv({ from: '2026-01-01', to: '2026-12-31' })
    const lines = csv.split('\r\n').filter((l) => l.length > 0)
    // header line + column-header line + 2 invoices = 4 lines
    expect(lines.length).toBe(4)
    expect(csv).toContain('"RE-2026-0001"')
    expect(csv).toContain('"RE-2026-0002"')
  })

  it('emits one row per ledger entry in range', async () => {
    await seedLedger({
      direction: 'income',
      entryDate: '2026-02-10',
      amountGross: '50.00',
      description: 'Barverkauf',
      entryNumber: 'L-001'
    })
    await seedLedger({
      direction: 'expense',
      entryDate: '2026-02-12',
      amountGross: '12.34',
      description: 'Werkstattmaterial',
      entryNumber: 'L-002'
    })
    const csv = await exportDatevCsv({ from: '2026-02-01', to: '2026-02-28' })
    expect(csv).toContain('"Barverkauf"')
    expect(csv).toContain('"Werkstattmaterial"')
    expect(csv).toContain('"L-001"')
    expect(csv).toContain('"L-002"')
  })

  it('excludes invoices and ledger entries outside the range', async () => {
    await seedInvoice({
      documentNumber: 'RE-IN-RANGE',
      issueDate: '2026-03-15',
      grossTotal: '100.00'
    })
    await seedInvoice({
      documentNumber: 'RE-TOO-EARLY',
      issueDate: '2025-12-31',
      grossTotal: '100.00'
    })
    await seedInvoice({
      documentNumber: 'RE-TOO-LATE',
      issueDate: '2027-01-01',
      grossTotal: '100.00'
    })
    await seedLedger({
      direction: 'expense',
      entryDate: '2025-12-31',
      amountGross: '10.00',
      description: 'Außerhalb früh'
    })
    await seedLedger({
      direction: 'expense',
      entryDate: '2027-01-01',
      amountGross: '10.00',
      description: 'Außerhalb spät'
    })
    const csv = await exportDatevCsv({ from: '2026-01-01', to: '2026-12-31' })
    expect(csv).toContain('"RE-IN-RANGE"')
    expect(csv).not.toContain('"RE-TOO-EARLY"')
    expect(csv).not.toContain('"RE-TOO-LATE"')
    expect(csv).not.toContain('Außerhalb früh')
    expect(csv).not.toContain('Außerhalb spät')
  })

  it('formats amounts with comma decimal (DATEV convention)', async () => {
    await seedInvoice({
      documentNumber: 'RE-2026-0001',
      issueDate: '2026-03-15',
      grossTotal: '1234.56'
    })
    const csv = await exportDatevCsv({ from: '2026-01-01', to: '2026-12-31' })
    // Amount sits in column 1 — first cell of the row line.
    expect(csv).toContain('1234,56')
    // Make sure we did not slip the dot-decimal form through.
    expect(csv).not.toContain('1234.56;')
  })

  it('sets Soll/Haben correctly: income → H, expense → S', async () => {
    await seedLedger({
      direction: 'income',
      entryDate: '2026-02-10',
      amountGross: '50.00',
      description: 'Barverkauf'
    })
    await seedLedger({
      direction: 'expense',
      entryDate: '2026-02-11',
      amountGross: '20.00',
      description: 'Material'
    })
    const csv = await exportDatevCsv({ from: '2026-02-01', to: '2026-02-28' })
    const lines = csv.split('\r\n')
    // First three lines are: EXTF header, column header, then rows.
    const incomeRow = lines.find((l) => l.includes('Barverkauf')) ?? ''
    const expenseRow = lines.find((l) => l.includes('Material')) ?? ''
    // Soll/Haben sits in column 2 (`50,00;"H";...` resp. `20,00;"S";...`).
    expect(incomeRow.split(';')[1]).toBe('"H"')
    expect(expenseRow.split(';')[1]).toBe('"S"')
  })

  it('writes Belegdatum as DDMM (DATEV per-row date format)', async () => {
    await seedLedger({
      direction: 'income',
      entryDate: '2026-03-07',
      amountGross: '99.00',
      description: 'Test'
    })
    const csv = await exportDatevCsv({ from: '2026-03-01', to: '2026-03-31' })
    const lines = csv.split('\r\n')
    const row = lines.find((l) => l.includes('"Test"')) ?? ''
    // Belegdatum is column index 10 (0-based 9).
    expect(row.split(';')[9]).toBe('0703')
  })

  it('writes a storno row as a positive Gegenbuchung (S/H swapped)', async () => {
    // Storno-Beleg: gleicher Schlüsselbeleg-Aufbau wie eine reguläre
    // Rechnung, aber `status='storno'` und negativer `grossTotal`. Der
    // Export muss
    //   - den Betrag positiv (Absolutwert) schreiben,
    //   - das Soll/Haben-Kennzeichen von 'H' auf 'S' kippen,
    //   - Konto + Gegenkonto vertauschen (Erlös-Konto landet in der
    //     Gegenkonto-Spalte; Debitor-Konto landet in der Konto-Spalte),
    //   - den Buchungstext mit "Storno" qualifizieren.
    await seedInvoice({
      documentNumber: 'RE-2026-0001',
      issueDate: '2026-03-15',
      grossTotal: '119.00'
    })
    await seedInvoice({
      documentNumber: 'S-1',
      issueDate: '2026-03-16',
      grossTotal: '-119.00',
      status: 'storno'
    })
    const csv = await exportDatevCsv({ from: '2026-01-01', to: '2026-12-31' })
    const lines = csv.split('\r\n')
    const regularRow = lines.find((l) => l.includes('"RE-2026-0001"')) ?? ''
    const stornoRow = lines.find((l) => l.includes('"S-1"')) ?? ''
    expect(stornoRow.length).toBeGreaterThan(0)
    // Amount is positive (absolute).
    const stornoCells = stornoRow.split(';')
    expect(stornoCells[0]).toBe('119,00')
    // Soll/Haben switched: reguläre Rechnung 'H', Storno 'S'.
    expect(regularRow.split(';')[1]).toBe('"H"')
    expect(stornoCells[1]).toBe('"S"')
    // Konto + Gegenkonto vertauscht — vergleichen wir die beiden Rows
    // direkt: das Konto des Storno ist das Gegenkonto der Rechnung.
    const regularCells = regularRow.split(';')
    expect(stornoCells[6]).toBe(regularCells[7])
    expect(stornoCells[7]).toBe(regularCells[6])
    // Buchungstext erwähnt "Storno" damit der Steuerberater sofort
    // erkennt, dass es sich um eine Korrektur handelt.
    expect(stornoRow).toContain('Storno')
  })

  it('handles umlauts (CP1252 byte mapping survives round-trip)', async () => {
    await seedLedger({
      direction: 'expense',
      entryDate: '2026-04-05',
      amountGross: '5.00',
      description: 'Büromaterial für ÄÖÜ'
    })
    const csv = await exportDatevCsv({ from: '2026-04-01', to: '2026-04-30' })
    // The returned string is a CP1252-byte string: charCodeAt for `ü`
    // must be 0xFC, `Ä` 0xC4, `Ö` 0xD6, `Ü` 0xDC. Convert via
    // Buffer.from(latin1) and back-decode to verify the encoding.
    const bytes = Buffer.from(csv, 'latin1')
    const decoded = bytes.toString('latin1')
    expect(decoded).toBe(csv)
    expect(decoded).toContain('Büromaterial')
    expect(decoded).toContain('ÄÖÜ')
  })
})
