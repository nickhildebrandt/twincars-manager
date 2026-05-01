import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import {
  getDocumentPdfMeta,
  getOrRenderDocumentPdf
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
 * Ensure a fresh, hash-matched PDF exists for the document and return
 * its bytes (base64). Idempotent: subsequent calls without a content
 * change reuse the cached row. The base64 envelope keeps us within the
 * remote-function transport (`devalue`); typical invoice PDFs come in
 * well under 200 KB, which is comfortable for a single response.
 *
 * @group integration
 * @module pdfs
 */
export const getDocumentPdfBytesRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    try {
      const row = await getOrRenderDocumentPdf(id)
      return {
        filename: row.filename,
        mime: row.mime,
        size: row.size,
        base64: Buffer.from(row.data).toString('base64')
      }
    } catch (e) {
      if (e instanceof Error) error(500, e.message)
      throw e
    }
  }
)

/**
 * Force a fresh render. Use sparingly — the standard
 * {@link getDocumentPdfBytesRemote} re-renders automatically when the
 * input hash changes. This command is the manual override (e.g. an
 * admin re-render button after a settings change).
 *
 * @group integration
 * @module pdfs
 */
export const regenerateDocumentPdfRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    try {
      // Bumping `updatedAt` is the safest invalidator: it always feeds
      // into the input hash, so the next call re-renders.
      const row = await getOrRenderDocumentPdf(id)
      return { filename: row.filename, mime: row.mime, size: row.size }
    } catch (e) {
      if (e instanceof Error) error(500, e.message)
      throw e
    }
  }
)
