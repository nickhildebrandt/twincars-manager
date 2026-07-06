/**
 * Integration tests for the vehicle-document service — upload
 * validation (mime allowlist, size cap, vehicle existence), file-name
 * sanitizing, the meta-only list projection and the byte round-trip
 * of the single-document read path.
 *
 * @group integration
 * @module vehicle-document-service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from '$lib/server/db/client'
import { vehicleDocuments, vehicles } from '$lib/server/db/schema'
import {
  MAX_VEHICLE_DOCUMENT_BYTES,
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocument,
  listVehicleDocuments,
  sanitizeFileName
} from './vehicle-document-service'

const expectHttpError = async (
  fn: () => Promise<unknown>,
  status: number,
  messagePattern: RegExp
): Promise<void> => {
  try {
    await fn()
    throw new Error('Expected function to throw, but it resolved.')
  } catch (err) {
    const e = err as { status?: number; body?: { message?: string } }
    expect(e.status).toBe(status)
    expect(e.body?.message ?? '').toMatch(messagePattern)
  }
}

const seedVehicle = async (): Promise<string> => {
  const [row] = await db
    .insert(vehicles)
    .values({ make: 'VW', model: 'Golf' })
    .returning({ id: vehicles.id })
  return row.id
}

const pdfBase64 = (content = '%PDF-1.4 test'): string =>
  Buffer.from(content).toString('base64')

describe('vehicle-document-service', () => {
  beforeEach(async () => {
    await db.delete(vehicleDocuments)
    await db.delete(vehicles)
  })

  describe('sanitizeFileName', () => {
    it('keeps a plain file name unchanged', () => {
      expect(sanitizeFileName('Fahrzeugbrief.pdf')).toBe('Fahrzeugbrief.pdf')
    })

    it('strips Unix and Windows path segments', () => {
      expect(sanitizeFileName('/etc/passwd')).toBe('passwd')
      expect(sanitizeFileName('C:\\Users\\evil\\..\\brief.pdf')).toBe(
        'brief.pdf'
      )
      expect(sanitizeFileName('../../../kaufvertrag.pdf')).toBe(
        'kaufvertrag.pdf'
      )
    })

    it('falls back to "Dokument" when nothing usable remains', () => {
      expect(sanitizeFileName('')).toBe('Dokument')
      expect(sanitizeFileName('foo/bar/')).toBe('Dokument')
      expect(sanitizeFileName('..')).toBe('Dokument')
    })

    it('caps at 255 characters and keeps the extension', () => {
      const long = `${'a'.repeat(300)}.pdf`
      const out = sanitizeFileName(long)
      expect(out.length).toBe(255)
      expect(out.endsWith('.pdf')).toBe(true)
    })
  })

  describe('createVehicleDocument', () => {
    it('stores the decoded bytes and returns the metadata', async () => {
      const vehicleId = await seedVehicle()
      const content = '%PDF-1.4 vertrag'
      const meta = await createVehicleDocument({
        vehicleId,
        fileName: 'Kaufvertrag.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64(content),
        note: 'Original vom 06.07.2026'
      })
      expect(meta.id).toBeTruthy()
      expect(meta.fileName).toBe('Kaufvertrag.pdf')
      expect(meta.mime).toBe('application/pdf')
      expect(meta.sizeBytes).toBe(Buffer.byteLength(content))
      expect(meta.note).toBe('Original vom 06.07.2026')
      expect(meta.uploadedAt).toBeInstanceOf(Date)
      // The meta shape never exposes the bytes.
      expect('data' in meta).toBe(false)

      const row = await getVehicleDocument(meta.id)
      expect(row).not.toBeNull()
      expect(Buffer.from(row!.data).toString()).toBe(content)
      expect(row!.vehicleId).toBe(vehicleId)
    })

    it('sanitizes path-carrying file names', async () => {
      const vehicleId = await seedVehicle()
      const meta = await createVehicleDocument({
        vehicleId,
        fileName: '..\\..\\windows\\brief.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64()
      })
      expect(meta.fileName).toBe('brief.pdf')
    })

    it('rejects mime types outside the allowlist with 415', async () => {
      const vehicleId = await seedVehicle()
      await expectHttpError(
        () =>
          createVehicleDocument({
            vehicleId,
            fileName: 'evil.svg',
            mime: 'image/svg+xml',
            dataBase64: pdfBase64()
          }),
        415,
        /Dateityp wird nicht unterstützt/i
      )
    })

    it('rejects empty payloads with 400', async () => {
      const vehicleId = await seedVehicle()
      await expectHttpError(
        () =>
          createVehicleDocument({
            vehicleId,
            fileName: 'leer.pdf',
            mime: 'application/pdf',
            dataBase64: ''
          }),
        400,
        /Datei ist leer/i
      )
    })

    it('rejects payloads above 15 MB with 413', async () => {
      const vehicleId = await seedVehicle()
      const tooBig = Buffer.alloc(MAX_VEHICLE_DOCUMENT_BYTES + 1).toString(
        'base64'
      )
      await expectHttpError(
        () =>
          createVehicleDocument({
            vehicleId,
            fileName: 'riesig.pdf',
            mime: 'application/pdf',
            dataBase64: tooBig
          }),
        413,
        /zu groß/i
      )
    })

    it('404s for an unknown vehicle', async () => {
      await expectHttpError(
        () =>
          createVehicleDocument({
            vehicleId: '00000000-0000-0000-0000-000000000000',
            fileName: 'brief.pdf',
            mime: 'application/pdf',
            dataBase64: pdfBase64()
          }),
        404,
        /Fahrzeug nicht gefunden/i
      )
    })
  })

  describe('listVehicleDocuments', () => {
    it('returns meta only, newest first, scoped to the vehicle', async () => {
      const vehicleId = await seedVehicle()
      const otherVehicleId = await seedVehicle()
      await db.insert(vehicleDocuments).values([
        {
          vehicleId,
          fileName: 'alt.pdf',
          mime: 'application/pdf',
          sizeBytes: 3,
          data: Buffer.from('old'),
          uploadedAt: new Date('2026-07-01T10:00:00Z')
        },
        {
          vehicleId,
          fileName: 'neu.jpg',
          mime: 'image/jpeg',
          sizeBytes: 3,
          data: Buffer.from('new'),
          note: 'Frontschaden',
          uploadedAt: new Date('2026-07-05T10:00:00Z')
        },
        {
          vehicleId: otherVehicleId,
          fileName: 'fremd.pdf',
          mime: 'application/pdf',
          sizeBytes: 5,
          data: Buffer.from('other'),
          uploadedAt: new Date('2026-07-06T10:00:00Z')
        }
      ])

      const list = await listVehicleDocuments(vehicleId)
      expect(list.map((d) => d.fileName)).toEqual(['neu.jpg', 'alt.pdf'])
      expect(list[0].note).toBe('Frontschaden')
      expect(list[0].sizeBytes).toBe(3)
      for (const row of list) {
        expect('data' in row).toBe(false)
      }
    })

    it('returns an empty array for a vehicle without documents', async () => {
      const vehicleId = await seedVehicle()
      expect(await listVehicleDocuments(vehicleId)).toEqual([])
    })
  })

  describe('getVehicleDocument / deleteVehicleDocument', () => {
    it('returns null for unknown ids', async () => {
      expect(
        await getVehicleDocument('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })

    it('deletes a document and is a no-op for unknown ids', async () => {
      const vehicleId = await seedVehicle()
      const meta = await createVehicleDocument({
        vehicleId,
        fileName: 'brief.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64()
      })
      await deleteVehicleDocument(meta.id)
      expect(await getVehicleDocument(meta.id)).toBeNull()
      await deleteVehicleDocument('00000000-0000-0000-0000-000000000000')
    })
  })
})
