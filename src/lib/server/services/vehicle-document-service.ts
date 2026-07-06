/**
 * Vehicle-document service — file attachments per vehicle
 * (Fahrzeugbrief scan, purchase contract, HU report, …).
 *
 * The raw bytes live inline in `vehicle_documents.data` (bytea) —
 * single-tenant Werkstatt app, no separate object storage worth the
 * complexity (same reasoning as `document_pdfs`). The list path
 * deliberately never selects the bytes; they travel exclusively
 * through {@link getVehicleDocument}.
 *
 * @group integration
 * @module vehicle-document-service
 */
import { error } from '@sveltejs/kit'
import { desc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  vehicleDocuments,
  vehicles,
  type VehicleDocument
} from '$lib/server/db/schema'

/** Upload allowlist — PDFs plus the common photo formats. */
export const VEHICLE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
] as const

export type VehicleDocumentMime = (typeof VEHICLE_DOCUMENT_MIME_TYPES)[number]

/** Maximum decoded file size: 15 MB. */
export const MAX_VEHICLE_DOCUMENT_BYTES = 15 * 1024 * 1024

/** List-view projection — meta only, NEVER the bytes. */
export type VehicleDocumentMeta = {
  id: string
  fileName: string
  mime: string
  sizeBytes: number
  note: string | null
  uploadedAt: Date
}

/**
 * Sanitize an uploaded file name: strip any path segments (both `/`
 * and `\` separators plus control characters), keep the extension and
 * cap the result at 255 characters. Falls back to `Dokument` when
 * nothing usable remains.
 */
export const sanitizeFileName = (raw: string): string => {
  const base = raw.split(/[/\\]/).pop() ?? ''
  const cleaned = base.replace(/[\u0000-\u001f]/g, '').trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'Dokument'
  if (cleaned.length <= 255) return cleaned
  const dot = cleaned.lastIndexOf('.')
  const ext = dot > 0 ? cleaned.slice(dot) : ''
  const stem = cleaned.slice(0, Math.max(1, 255 - ext.length))
  return `${stem}${ext}`.slice(0, 255)
}

/**
 * All documents of a vehicle, newest first — meta columns only (the
 * bytea column stays out of the query entirely).
 */
export async function listVehicleDocuments(
  vehicleId: string
): Promise<VehicleDocumentMeta[]> {
  return db
    .select({
      id: vehicleDocuments.id,
      fileName: vehicleDocuments.fileName,
      mime: vehicleDocuments.mime,
      sizeBytes: vehicleDocuments.sizeBytes,
      note: vehicleDocuments.note,
      uploadedAt: vehicleDocuments.uploadedAt
    })
    .from(vehicleDocuments)
    .where(eq(vehicleDocuments.vehicleId, vehicleId))
    .orderBy(desc(vehicleDocuments.uploadedAt), desc(vehicleDocuments.id))
}

/** Single document including its bytes, or `null` when unknown. */
export async function getVehicleDocument(
  id: string
): Promise<VehicleDocument | null> {
  const [row] = await db
    .select()
    .from(vehicleDocuments)
    .where(eq(vehicleDocuments.id, id))
    .limit(1)
  return row ?? null
}

export type CreateVehicleDocumentInput = {
  vehicleId: string
  fileName: string
  mime: string
  /** Advisory only — the stored size is the actual decoded length. */
  sizeBytes?: number
  /** Raw file content, base64-encoded (no data-URL prefix). */
  dataBase64: string
  note?: string | null
}

/**
 * Store a new document. Validates the mime allowlist, decodes the
 * base64 payload (≤ 15 MB), sanitizes the file name and requires the
 * vehicle to exist (404 otherwise).
 */
export async function createVehicleDocument(
  input: CreateVehicleDocumentInput
): Promise<VehicleDocumentMeta> {
  if (
    !(VEHICLE_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mime)
  ) {
    error(
      415,
      'Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, JPEG, PNG und WebP.'
    )
  }

  const data = Buffer.from(input.dataBase64, 'base64')
  if (data.length === 0) {
    error(400, 'Die Datei ist leer oder konnte nicht gelesen werden.')
  }
  if (data.length > MAX_VEHICLE_DOCUMENT_BYTES) {
    error(413, 'Die Datei ist zu groß (maximal 15 MB).')
  }

  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.id, input.vehicleId))
    .limit(1)
  if (!vehicle) {
    error(404, 'Fahrzeug nicht gefunden.')
  }

  const [created] = await db
    .insert(vehicleDocuments)
    .values({
      vehicleId: input.vehicleId,
      fileName: sanitizeFileName(input.fileName),
      mime: input.mime,
      sizeBytes: data.length,
      data,
      note: input.note?.trim() || null
    })
    .returning({
      id: vehicleDocuments.id,
      fileName: vehicleDocuments.fileName,
      mime: vehicleDocuments.mime,
      sizeBytes: vehicleDocuments.sizeBytes,
      note: vehicleDocuments.note,
      uploadedAt: vehicleDocuments.uploadedAt
    })
  return created
}

/** Remove a document. No-op for unknown ids. */
export async function deleteVehicleDocument(id: string): Promise<void> {
  await db.delete(vehicleDocuments).where(eq(vehicleDocuments.id, id))
}
