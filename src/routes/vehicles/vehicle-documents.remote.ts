import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  maxLength,
  minLength,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import {
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocument,
  listVehicleDocuments,
  VEHICLE_DOCUMENT_MIME_TYPES
} from '$lib/server/services/vehicle-document-service'
import { requirePermission } from '$lib/server/auth-guards'

/* ── Schemas ────────────────────────────────────────────────────────── */

/**
 * Upload payload. `dataBase64` is the raw file content (no data-URL
 * prefix); 21 M base64 characters decode to ~15.75 MB, so the length
 * cap mirrors the service-side 15 MB byte limit with headroom for
 * padding. The mime allowlist is shared with the service.
 */
const uploadSchema = object({
  vehicleId: idSchema,
  fileName: pipe(
    string('Bitte einen Dateinamen angeben.'),
    trim(),
    minLength(1, 'Der Dateiname darf nicht leer sein.'),
    maxLength(255, 'Der Dateiname darf maximal 255 Zeichen lang sein.')
  ),
  mime: picklist(
    VEHICLE_DOCUMENT_MIME_TYPES,
    'Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, JPEG, PNG und WebP.'
  ),
  dataBase64: pipe(
    string('Bitte eine Datei auswählen.'),
    minLength(1, 'Die Datei darf nicht leer sein.'),
    maxLength(21_000_000, 'Die Datei ist zu groß (maximal 15 MB).')
  ),
  note: optional(
    pipe(
      string(),
      trim(),
      maxLength(500, 'Die Notiz darf maximal 500 Zeichen lang sein.')
    )
  )
})

/* ── Queries ────────────────────────────────────────────────────────── */

/**
 * Documents of a vehicle, newest first — metadata only, the bytes
 * never travel through this query.
 *
 * @group integration
 * @module vehicles
 */
export const listVehicleDocumentsRemote = query(
  object({ vehicleId: idSchema }),
  async ({ vehicleId }) => {
    requirePermission('vehicles')
    return listVehicleDocuments(vehicleId)
  }
)

/**
 * Single document payload for the viewer / download: file name, mime
 * and the base64-encoded bytes. Throws `404` for unknown ids.
 *
 * @group integration
 * @module vehicles
 */
export const getVehicleDocumentRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('vehicles')
    const row = await getVehicleDocument(id)
    if (!row) error(404, 'Dokument nicht gefunden.')
    return {
      fileName: row.fileName,
      mime: row.mime,
      dataBase64: Buffer.from(row.data).toString('base64')
    }
  }
)

/* ── Mutations ──────────────────────────────────────────────────────── */

/**
 * Upload a document to a vehicle. The service validates the mime
 * allowlist, the decoded size (≤ 15 MB) and the vehicle's existence,
 * and sanitizes the file name. Returns the stored metadata.
 *
 * @group integration
 * @module vehicles
 */
export const uploadVehicleDocumentRemote = command(
  uploadSchema,
  async (input) => {
    requirePermission('vehicles')
    const meta = await createVehicleDocument({
      vehicleId: input.vehicleId,
      fileName: input.fileName,
      mime: input.mime,
      dataBase64: input.dataBase64,
      note: input.note || null
    })
    await listVehicleDocumentsRemote({ vehicleId: input.vehicleId }).refresh()
    return meta
  }
)

/**
 * Delete a document. `vehicleId` is required so the list query can
 * refresh in the same flight.
 *
 * @group integration
 * @module vehicles
 */
export const deleteVehicleDocumentRemote = command(
  object({ id: idSchema, vehicleId: idSchema }),
  async ({ id, vehicleId }) => {
    requirePermission('vehicles')
    await deleteVehicleDocument(id)
    await listVehicleDocumentsRemote({ vehicleId }).refresh()
  }
)
