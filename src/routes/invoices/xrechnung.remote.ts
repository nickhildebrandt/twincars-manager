import { query } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { loadDocumentRenderInput } from '$lib/server/services/pdf-service'
import { renderXRechnungXml } from '$lib/server/services/xrechnung-service'

/**
 * Generate the XRechnung 3.0 UBL XML for an invoice and return it
 * base64-encoded so it travels safely over the remote-function wire.
 *
 * Reuses the exact same input-loader as the PDF renderer
 * (`loadDocumentRenderInput`) so the XML and the PDF stay in lockstep
 * — they are two representations of the same upstream data.
 *
 * @group integration
 * @module invoices
 */
export const getInvoiceXRechnungRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('invoices')
    const input = await loadDocumentRenderInput(id)
    if (!input || input.doc.type !== 'invoice') {
      error(404, 'Rechnung nicht gefunden.')
    }
    const xml = renderXRechnungXml(input)
    const filename = `${input.doc.documentNumber}.xml`
    return {
      filename,
      mime: 'application/xml',
      data: Buffer.from(xml, 'utf-8').toString('base64')
    }
  }
)
