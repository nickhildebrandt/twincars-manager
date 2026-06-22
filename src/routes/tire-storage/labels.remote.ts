import { query, getRequestEvent } from '$app/server'
import { error } from '@sveltejs/kit'
import { object } from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { requirePermission } from '$lib/server/auth-guards'
import { getTireStorage } from '$lib/server/services/tire-storage-service'
import { renderTireStorageLabelPdf } from '$lib/server/services/pdf-service'

/**
 * Streams an A6-landscape QR-Etikett-PDF for the given tire-storage
 * entry. The QR payload is a deep link
 * `{origin}/tire-storage/scan/<storageNumber>` so a worker can scan the
 * sticker with a phone and land directly on the entry (after login). The
 * human-readable storage number is also printed on the label.
 *
 * @group integration
 * @module tire-storage
 */
export const getTireStorageLabelPdfRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('tires')
    const entry = await getTireStorage(id)
    if (!entry) error(404, 'Reifeneinlagerung nicht gefunden.')

    const origin = getRequestEvent().url.origin
    const scanUrl = `${origin}/tire-storage/scan/${encodeURIComponent(entry.storageNumber)}`
    const bytes = await renderTireStorageLabelPdf(entry, scanUrl)
    const filename = `Reifenlager_${entry.storageNumber}.pdf`.replace(
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
