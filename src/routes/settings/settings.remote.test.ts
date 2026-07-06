// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the Stundensatz (workshop labor rate) remotes
 * added to the settings remote layer:
 *
 *   - permission gates (anonymous 401, non-settings caller 403);
 *   - `getLaborRateSettingRemote` resolving the "Arbeitszeit" item +
 *     its current price version via `company_settings.labor_item_id`;
 *   - `updateLaborRateRemote` writing a NEW `item_price_versions` row
 *     (`valid_from` = today) so the price history is preserved.
 *
 * `$app/server` is replaced with passthrough `query`/`command`
 * wrappers and a controllable `getRequestEvent()` — same pattern as
 * `src/routes/hours/hours.remote.test.ts`.
 *
 * @group integration
 * @module settings
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
    command: (schema: unknown, fn: Fn) => makeCommand(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  companySettings,
  itemPriceVersions,
  items
} from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import {
  getLaborRateSettingRemote,
  updateLaborRateRemote
} from './settings.remote'

async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number
): Promise<void> {
  let caught: unknown = null
  try {
    await fn()
  } catch (err) {
    caught = err
  }
  if (caught === null) {
    throw new Error('expected the call to throw, but it resolved')
  }
  const err = caught as { status?: number }
  expect(err.status).toBe(status)
}

function authAs(permissions: string[]) {
  mockRequestEvent.locals.user = {
    id: 'caller-id',
    name: 'Caller',
    email: 'caller@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(permissions)
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

const todayIso = () => new Date().toISOString().slice(0, 10)

describe('settings.remote — Stundensatz', () => {
  let laborItemId: string

  beforeEach(async () => {
    anonymous()
    await db.delete(itemPriceVersions)
    await db.delete(companySettings)
    await db.delete(items)

    const [item] = await db
      .insert(items)
      .values({
        articleNumber: 'ARBEIT',
        description: 'Arbeitszeit',
        kind: 'service',
        unit: 'Std.'
      })
      .returning()
    laborItemId = item.id
    await db
      .insert(itemPriceVersions)
      .values({
        itemId: laborItemId,
        validFrom: '2026-01-01',
        unitPriceNet: '75.00'
      })
    await db.insert(companySettings).values({ laborItemId })
  })

  describe('permission gates', () => {
    it('getLaborRateSettingRemote rejects anonymous callers', async () => {
      await expectHttpError(() => getLaborRateSettingRemote(), 401)
    })

    it('updateLaborRateRemote rejects anonymous callers', async () => {
      await expectHttpError(() => updateLaborRateRemote({ priceNet: 80 }), 401)
    })

    it('both remotes reject callers without the settings permission', async () => {
      authAs(['customers'])
      await expectHttpError(() => getLaborRateSettingRemote(), 403)
      await expectHttpError(() => updateLaborRateRemote({ priceNet: 80 }), 403)
    })
  })

  describe('getLaborRateSettingRemote', () => {
    beforeEach(() => authAs([WILDCARD_PERMISSION]))

    it('returns the labor item with its current price version', async () => {
      const rate = await getLaborRateSettingRemote()
      expect(rate?.itemId).toBe(laborItemId)
      expect(rate?.articleNumber).toBe('ARBEIT')
      expect(Number(rate?.unitPriceNet)).toBe(75)
    })

    it('returns null when no labor item is linked', async () => {
      await db
        .update(companySettings)
        .set({ laborItemId: null })
        .where(eq(companySettings.laborItemId, laborItemId))
      expect(await getLaborRateSettingRemote()).toBeNull()
    })
  })

  describe('updateLaborRateRemote', () => {
    beforeEach(() => authAs(['settings']))

    it('writes a NEW price version valid from today (history preserved)', async () => {
      await updateLaborRateRemote({ priceNet: 89.5 })

      const versions = await db
        .select()
        .from(itemPriceVersions)
        .where(eq(itemPriceVersions.itemId, laborItemId))
      expect(versions).toHaveLength(2)
      const todays = versions.find((v) => v.validFrom === todayIso())
      expect(Number(todays?.unitPriceNet)).toBe(89.5)
      // The old version stays untouched.
      const old = versions.find((v) => v.validFrom === '2026-01-01')
      expect(Number(old?.unitPriceNet)).toBe(75)

      const rate = await getLaborRateSettingRemote()
      expect(Number(rate?.unitPriceNet)).toBe(89.5)
    })

    it('updates an existing same-day version instead of duplicating', async () => {
      await updateLaborRateRemote({ priceNet: 89.5 })
      await updateLaborRateRemote({ priceNet: 92 })
      const versions = await db
        .select()
        .from(itemPriceVersions)
        .where(eq(itemPriceVersions.itemId, laborItemId))
      expect(versions).toHaveLength(2)
      const rate = await getLaborRateSettingRemote()
      expect(Number(rate?.unitPriceNet)).toBe(92)
    })

    it('rejects a non-positive rate with 400', async () => {
      await expectHttpError(() => updateLaborRateRemote({ priceNet: 0 }), 400)
      await expectHttpError(() => updateLaborRateRemote({ priceNet: -5 }), 400)
    })

    it('rejects with 409 when no labor item is linked', async () => {
      await db
        .update(companySettings)
        .set({ laborItemId: null })
        .where(eq(companySettings.laborItemId, laborItemId))
      await expectHttpError(() => updateLaborRateRemote({ priceNet: 80 }), 409)
    })
  })
})
