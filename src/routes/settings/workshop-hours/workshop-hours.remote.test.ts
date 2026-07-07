// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the workshop opening-hours remote functions —
 * auth guards plus the cross-field rule that an open day's opening
 * time must lie before its closing time (inverted ranges would break
 * the public free-slot calculation).
 *
 * @group integration
 * @module workshop-hours
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
  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schema: unknown, fn: Fn) => makeQuery(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import { workshopHours } from '$lib/server/db/schema'
import {
  listWorkshopHoursRemote,
  updateWorkshopHoursRemote
} from './workshop-hours.remote'

const asSettingsUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Admin',
    email: 'admin@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['settings'])
}

describe('workshop-hours.remote', () => {
  beforeEach(async () => {
    await db.delete(workshopHours)
    mockRequestEvent.locals.user = null
    mockRequestEvent.locals.permissions = new Set()
  })

  it('rejects anonymous callers with 401', async () => {
    await expect(listWorkshopHoursRemote()).rejects.toMatchObject({
      status: 401
    })
  })

  it('rejects callers without the settings permission with 403', async () => {
    mockRequestEvent.locals.user = {
      id: 'u2',
      name: 'User',
      email: 'user@twincars.local'
    }
    mockRequestEvent.locals.permissions = new Set(['customers'])
    await expect(
      updateWorkshopHoursRemote({
        weekday: 1,
        opensAt: '08:00',
        closesAt: '17:00',
        closed: false
      })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('updates a valid open-day range', async () => {
    asSettingsUser()
    const row = (await updateWorkshopHoursRemote({
      weekday: 1,
      opensAt: '07:30',
      closesAt: '16:30',
      closed: false
    })) as { opensAt: string; closesAt: string; closed: boolean }
    expect(row.opensAt).toBe('07:30')
    expect(row.closesAt).toBe('16:30')
    expect(row.closed).toBe(false)
  })

  it('rejects an inverted range on an open day with a German message', async () => {
    asSettingsUser()
    await expect(
      updateWorkshopHoursRemote({
        weekday: 2,
        opensAt: '18:00',
        closesAt: '08:00',
        closed: false
      })
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          message: 'Die Öffnungszeit muss vor der Schließzeit liegen.'
        })
      ]
    })
  })

  it('rejects a zero-length range (opensAt === closesAt)', async () => {
    asSettingsUser()
    await expect(
      updateWorkshopHoursRemote({
        weekday: 3,
        opensAt: '08:00',
        closesAt: '08:00',
        closed: false
      })
    ).rejects.toThrowError()
  })

  it('accepts any times on a closed day (times are ignored)', async () => {
    asSettingsUser()
    const row = (await updateWorkshopHoursRemote({
      weekday: 0,
      opensAt: '18:00',
      closesAt: '08:00',
      closed: true
    })) as { closed: boolean }
    expect(row.closed).toBe(true)
  })
})
