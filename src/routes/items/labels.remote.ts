import { query, getRequestEvent } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { getItem } from '$lib/server/services/item-service'
import { renderArticleLabelPdf } from '$lib/server/services/pdf-service'

/**
 * Streams an A6-landscape QR-Etikett-PDF for the given article.
 *
 * The QR payload is `{origin}/items/<articleNumber>` so that a phone
 * scanner deep-links straight into the item-detail view of the running
 * deployment. We deliberately use the request origin rather than a
 * hard-coded base URL so the same code works in dev, staging and prod.
 *
 * No caching — the renderer is cheap and the label changes whenever
 * the description or price changes; serving fresh bytes per request
 * keeps the surface tiny.
 *
 * @group integration
 * @module items
 */
export const getArticleLabelPdfRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('items')
    const item = await getItem(id)
    if (!item) error(404, 'Artikel nicht gefunden.')

    const event = getRequestEvent()
    const origin = event.url.origin
    const qrPayload = `${origin}/items/${encodeURIComponent(item.articleNumber)}`
    const bytes = await renderArticleLabelPdf(
      {
        articleNumber: item.articleNumber,
        description: item.description,
        unitPriceNet: item.unitPriceNet,
        kind: item.kind
      },
      qrPayload
    )

    const filename = `QR-Etikett_${item.articleNumber}.pdf`.replace(
      /[^A-Za-z0-9._-]/g,
      '_'
    )
    return {
      filename,
      mime: 'application/pdf',
      data: Buffer.from(bytes).toString('base64')
    }
  }
)
