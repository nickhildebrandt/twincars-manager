// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the vehicle-document remote functions — guard
 * behaviour (anonymous → 401, missing permission → 403), the German
 * Valibot messages of the upload schema, the meta-only list contract
 * and the base64 round-trip of the viewer payload. Runs against
 * pg-mem via the shared `$app/server` mock pattern.
 *
 * @group integration
 * @module vehicles
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string; email: string } | null,
    session: null as unknown,
    permissions: new Set<string>()
  }
}

vi.mock('$app/server', async () => {
  const valibot = await import('valibot')
  type Fn = (input?: unknown) => Promise<unknown>
  type Schema = Parameters<typeof valibot.parse>[0]

  const validate = (schema: Schema | undefined, input: unknown) => {
    if (!schema) return input
    return valibot.parse(schema, input)
  }
  const callQuery = (schema: Schema | undefined, impl: Fn, input?: unknown) => {
    const promise = (async () => impl(validate(schema, input)))()
    return Object.assign(promise, { refresh: () => Promise.resolve() })
  }
  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) => callQuery(schema, impl, input)
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  const makeCommand = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, { __: { type: 'command' as const } })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeCommand(undefined, schemaOrFn as Fn)
      }
      return makeCommand(schemaOrFn as Schema, fn as Fn)
    },
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import { vehicleDocuments, vehicles } from '$lib/server/db/schema'
import {
  deleteVehicleDocumentRemote,
  getVehicleDocumentRemote,
  listVehicleDocumentsRemote,
  uploadVehicleDocumentRemote
} from './vehicle-documents.remote'

const asAnonymous = () => {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

const asUserWithoutVehicles = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['customers'])
}

const asVehiclesUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['vehicles'])
}

const expectHttpError = async (
  fn: () => Promise<unknown>,
  status: number
): Promise<void> => {
  try {
    await fn()
    throw new Error('Expected function to throw, but it resolved.')
  } catch (err) {
    const e = err as { status?: number }
    expect(e.status).toBe(status)
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

describe('vehicle-documents.remote', () => {
  beforeEach(async () => {
    await db.delete(vehicleDocuments)
    await db.delete(vehicles)
    asVehiclesUser()
  })

  describe('guards', () => {
    it('401s anonymous callers on every function', async () => {
      asAnonymous()
      await expectHttpError(
        () => listVehicleDocumentsRemote({ vehicleId: 'v' }),
        401
      )
      await expectHttpError(() => getVehicleDocumentRemote({ id: 'd' }), 401)
      await expectHttpError(
        () =>
          uploadVehicleDocumentRemote({
            vehicleId: 'v',
            fileName: 'a.pdf',
            mime: 'application/pdf',
            dataBase64: pdfBase64()
          }),
        401
      )
      await expectHttpError(
        () => deleteVehicleDocumentRemote({ id: 'd', vehicleId: 'v' }),
        401
      )
    })

    it('403s users without the vehicles permission', async () => {
      asUserWithoutVehicles()
      await expectHttpError(
        () => listVehicleDocumentsRemote({ vehicleId: 'v' }),
        403
      )
      await expectHttpError(
        () =>
          uploadVehicleDocumentRemote({
            vehicleId: 'v',
            fileName: 'a.pdf',
            mime: 'application/pdf',
            dataBase64: pdfBase64()
          }),
        403
      )
    })
  })

  describe('uploadVehicleDocumentRemote', () => {
    it('stores a document and returns its metadata', async () => {
      const vehicleId = await seedVehicle()
      const meta = (await uploadVehicleDocumentRemote({
        vehicleId,
        fileName: 'Kaufvertrag.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64('%PDF-1.4 vertrag'),
        note: 'Original'
      })) as { id: string; fileName: string; sizeBytes: number }
      expect(meta.id).toBeTruthy()
      expect(meta.fileName).toBe('Kaufvertrag.pdf')
      expect(meta.sizeBytes).toBe(Buffer.byteLength('%PDF-1.4 vertrag'))
    })

    it('rejects disallowed mime types with the German picklist message', async () => {
      const vehicleId = await seedVehicle()
      await expect(
        uploadVehicleDocumentRemote({
          vehicleId,
          fileName: 'evil.svg',
          // Deliberately outside the allowlist union — the schema
          // must reject it at validation time.
          mime: 'image/svg+xml' as never,
          dataBase64: pdfBase64()
        })
      ).rejects.toThrowError(/Dateityp wird nicht unterstützt/)
    })

    it('rejects an empty file name with a German message', async () => {
      const vehicleId = await seedVehicle()
      await expect(
        uploadVehicleDocumentRemote({
          vehicleId,
          fileName: '   ',
          mime: 'application/pdf',
          dataBase64: pdfBase64()
        })
      ).rejects.toThrowError(/Dateiname darf nicht leer sein/)
    })

    it('rejects oversized base64 payloads with a German message', async () => {
      const vehicleId = await seedVehicle()
      await expect(
        uploadVehicleDocumentRemote({
          vehicleId,
          fileName: 'riesig.pdf',
          mime: 'application/pdf',
          dataBase64: 'A'.repeat(21_000_001)
        })
      ).rejects.toThrowError(/zu groß/)
    })

    it('404s for an unknown vehicle', async () => {
      await expectHttpError(
        () =>
          uploadVehicleDocumentRemote({
            vehicleId: '00000000-0000-0000-0000-000000000000',
            fileName: 'brief.pdf',
            mime: 'application/pdf',
            dataBase64: pdfBase64()
          }),
        404
      )
    })
  })

  describe('listVehicleDocumentsRemote', () => {
    it('lists metadata without the bytes', async () => {
      const vehicleId = await seedVehicle()
      await uploadVehicleDocumentRemote({
        vehicleId,
        fileName: 'brief.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64()
      })
      const list = (await listVehicleDocumentsRemote({ vehicleId })) as Array<
        Record<string, unknown>
      >
      expect(list).toHaveLength(1)
      expect(list[0].fileName).toBe('brief.pdf')
      expect('data' in list[0]).toBe(false)
      expect('dataBase64' in list[0]).toBe(false)
    })
  })

  describe('getVehicleDocumentRemote', () => {
    it('returns fileName, mime and the base64 bytes round-tripped', async () => {
      const vehicleId = await seedVehicle()
      const content = '%PDF-1.4 roundtrip'
      const meta = (await uploadVehicleDocumentRemote({
        vehicleId,
        fileName: 'brief.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64(content)
      })) as { id: string }
      const doc = (await getVehicleDocumentRemote({ id: meta.id })) as {
        fileName: string
        mime: string
        dataBase64: string
      }
      expect(doc.fileName).toBe('brief.pdf')
      expect(doc.mime).toBe('application/pdf')
      expect(Buffer.from(doc.dataBase64, 'base64').toString()).toBe(content)
    })

    it('404s for unknown ids', async () => {
      await expectHttpError(
        () =>
          getVehicleDocumentRemote({
            id: '00000000-0000-0000-0000-000000000000'
          }),
        404
      )
    })
  })

  describe('deleteVehicleDocumentRemote', () => {
    it('removes the document', async () => {
      const vehicleId = await seedVehicle()
      const meta = (await uploadVehicleDocumentRemote({
        vehicleId,
        fileName: 'brief.pdf',
        mime: 'application/pdf',
        dataBase64: pdfBase64()
      })) as { id: string }
      await deleteVehicleDocumentRemote({ id: meta.id, vehicleId })
      expect(await listVehicleDocumentsRemote({ vehicleId })).toEqual([])
    })
  })
})
