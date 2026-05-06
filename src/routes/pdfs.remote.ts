import { query } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import {
  getDocumentPdfMeta,
  getPayslipPdfMeta,
  getReminderPdfMeta,
  loadCachedDocumentPdf,
  loadCachedPayslipPdf,
  loadCachedReminderPdf
} from '$lib/server/services/pdf-service'

/**
 * Lightweight metadata about a document's cached PDF. Returns `null` if
 * no PDF has ever been rendered for the document. This is the only PDF
 * call list views are allowed to make — the actual bytes never travel
 * here.
 *
 * @group integration
 * @module pdfs
 */
export const getDocumentPdfMetaRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const meta = await getDocumentPdfMeta(id)
    return meta
      ? {
          id: meta.id,
          documentId: meta.documentId,
          filename: meta.filename,
          mime: meta.mime,
          size: meta.size,
          createdAt: meta.createdAt
        }
      : null
  }
)

/**
 * Liefert die Bytes des persistierten PDFs (base64). KEIN automatisches
 * Render-Fallback — wenn nichts da ist, kommt 404. Der Schreib-Pfad
 * (Beleg-Anlage / Import) muss das PDF vorher persistiert haben.
 *
 * @group integration
 * @module pdfs
 */
export const getDocumentPdfBytesRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await loadCachedDocumentPdf(id)
    if (!row) error(404, 'Für diesen Beleg ist kein PDF gespeichert.')
    return {
      filename: row.filename,
      mime: row.mime,
      size: row.size,
      base64: Buffer.from(row.data).toString('base64')
    }
  }
)

/**
 * Reminder PDF metadata. Same contract as
 * {@link getDocumentPdfMetaRemote} but for dunning records.
 *
 * @group integration
 * @module pdfs
 */
export const getReminderPdfMetaRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const meta = await getReminderPdfMeta(id)
    return meta
      ? {
          id: meta.id,
          reminderId: meta.reminderId,
          filename: meta.filename,
          mime: meta.mime,
          size: meta.size,
          createdAt: meta.createdAt
        }
      : null
  }
)

/**
 * Liefert das persistierte Mahn-PDF — kein Auto-Render.
 *
 * @group integration
 * @module pdfs
 */
export const getReminderPdfBytesRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await loadCachedReminderPdf(id)
    if (!row) error(404, 'Für diese Mahnung ist kein PDF gespeichert.')
    return {
      filename: row.filename,
      mime: row.mime,
      size: row.size,
      base64: Buffer.from(row.data).toString('base64')
    }
  }
)

/**
 * Payslip metadata. Same contract as the document/reminder variants but
 * keyed by the payroll-entry id.
 *
 * @group integration
 * @module pdfs
 */
export const getPayslipPdfMetaRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const meta = await getPayslipPdfMeta(id)
    return meta
      ? {
          id: meta.id,
          entryId: meta.entryId,
          filename: meta.filename,
          mime: meta.mime,
          size: meta.size,
          createdAt: meta.createdAt
        }
      : null
  }
)

/**
 * Liefert das persistierte Lohnzettel-PDF — kein Auto-Render.
 *
 * @group integration
 * @module pdfs
 */
export const getPayslipPdfBytesRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await loadCachedPayslipPdf(id)
    if (!row) error(404, 'Für diese Abrechnung ist kein PDF gespeichert.')
    return {
      filename: row.filename,
      mime: row.mime,
      size: row.size,
      base64: Buffer.from(row.data).toString('base64')
    }
  }
)
