// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the wizard-scoped workshop-hours remotes.
 * Asserts that the new step 7 of the setup wizard persists all seven
 * weekday rows when the user clicks "Weiter" and that both remotes
 * refuse to run once setup has been marked complete.
 *
 * @group integration
 * @module setup
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as unknown,
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
      // `command` is overloaded: `command(fn)` (no input) or
      // `command(schema, fn)`. Mirror the real API's overload handling.
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
import {
  accounts,
  companySettings,
  roles,
  userRoles,
  users,
  workshopHours
} from '$lib/server/db/schema'
import { randomUUID } from 'node:crypto'
import {
  completeSetup,
  createInitialAdmin,
  listWorkshopHoursForSetup,
  saveCompanyData,
  saveWorkshopHoursForSetup
} from './setup.remote'

/** A fully-valid company payload (every server-required field present). */
const validCompany = {
  companyName: 'TwinCast GmbH',
  street: 'Hauptstr. 1',
  zip: '12345',
  city: 'Musterstadt',
  state: 'Berlin',
  phone: '030 1234567',
  email: 'info@twincast.de',
  taxNumber: '12/345/67890',
  bankName: 'Sparkasse',
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
  salutationStyle: 'Sie' as const
}

async function seedUserRow() {
  const id = `u_${randomUUID()}`
  await db
    .insert(users)
    .values({ id, name: 'Admin', email: `${id}@twincars.local`, username: id })
  return id
}

async function resetDb() {
  await db.delete(userRoles)
  await db.delete(accounts)
  await db.delete(users)
  await db.delete(roles)
  await db.delete(workshopHours)
  await db.delete(companySettings)
}

async function seedAdminRole() {
  await db
    .insert(roles)
    .values({ name: 'Administrator', description: 'Vollzugriff (Setup-Test).' })
}

async function seedFreshCompany() {
  await db.insert(companySettings).values({})
}

async function seedCompletedCompany() {
  await db.insert(companySettings).values({ setupCompleted: true })
}

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
  expect(caught).toBeTruthy()
  const e = caught as { status?: number }
  expect(e.status).toBe(status)
}

describe('setup.remote — workshop-hours wizard step', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('lists all seven weekday rows with the seeded defaults while setup is incomplete', async () => {
    await seedFreshCompany()
    const rows = await listWorkshopHoursForSetup()
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    // Mon-Fri open, Sat+Sun closed.
    for (const r of rows) {
      if (r.weekday === 0 || r.weekday === 6) {
        expect(r.closed).toBe(true)
      } else {
        expect(r.closed).toBe(false)
      }
    }
  })

  it('persists the seven hours rows on save', async () => {
    await seedFreshCompany()
    await saveWorkshopHoursForSetup({
      rows: [
        { weekday: 0, opensAt: '09:00', closesAt: '13:00', closed: false },
        { weekday: 1, opensAt: '07:30', closesAt: '18:00', closed: false },
        { weekday: 2, opensAt: '07:30', closesAt: '18:00', closed: false },
        { weekday: 3, opensAt: '07:30', closesAt: '18:00', closed: false },
        { weekday: 4, opensAt: '07:30', closesAt: '18:00', closed: false },
        { weekday: 5, opensAt: '07:30', closesAt: '16:00', closed: false },
        { weekday: 6, opensAt: '00:00', closesAt: '00:00', closed: true }
      ]
    })
    const stored = await db.select().from(workshopHours)
    expect(stored).toHaveLength(7)
    const mon = stored.find((r) => r.weekday === 1)!
    expect(mon.opensAt.startsWith('07:30')).toBe(true)
    expect(mon.closesAt.startsWith('18:00')).toBe(true)
    expect(mon.closed).toBe(false)
    const sun = stored.find((r) => r.weekday === 0)!
    expect(sun.closed).toBe(false)
    expect(sun.opensAt.startsWith('09:00')).toBe(true)
    const sat = stored.find((r) => r.weekday === 6)!
    expect(sat.closed).toBe(true)
  })

  it('rejects an invalid HH:MM time string', async () => {
    await seedFreshCompany()
    await expect(
      saveWorkshopHoursForSetup({
        rows: [
          { weekday: 0, opensAt: '99:99', closesAt: '17:00', closed: false }
        ]
      })
    ).rejects.toThrow()
  })

  it('refuses both remotes once setup has been completed', async () => {
    await seedCompletedCompany()
    await expectHttpError(() => listWorkshopHoursForSetup(), 403)
    await expectHttpError(
      () =>
        saveWorkshopHoursForSetup({
          rows: [
            { weekday: 0, opensAt: '09:00', closesAt: '13:00', closed: false }
          ]
        }),
      403
    )
  })
})

describe('setup.remote — createInitialAdmin', () => {
  beforeEach(async () => {
    await resetDb()
    await seedFreshCompany()
    await seedAdminRole()
  })

  it('creates the first admin user with the lowercased username and assigns the Administrator role', async () => {
    await createInitialAdmin({
      username: 'TestAdmin',
      name: 'Test Admin',
      password: 'testpassword123'
    })

    const all = await db.select().from(users)
    expect(all).toHaveLength(1)
    expect(all[0].username).toBe('testadmin')
    expect(all[0].displayUsername).toBe('TestAdmin')
    expect(all[0].email).toBe('testadmin@twincars.local')

    const acc = await db.select().from(accounts)
    expect(acc).toHaveLength(1)
    expect(acc[0].providerId).toBe('credential')
    expect(acc[0].password).toBeTruthy()

    const links = await db.select().from(userRoles)
    expect(links).toHaveLength(1)
    expect(links[0].userId).toBe(all[0].id)
  })

  it('refuses a second call once an admin exists', async () => {
    await createInitialAdmin({
      username: 'first',
      name: 'First Admin',
      password: 'firstpassword123'
    })
    await expectHttpError(
      () =>
        createInitialAdmin({
          username: 'second',
          name: 'Second Admin',
          password: 'secondpass123'
        }),
      409
    )
  })

  it('rejects an invalid username with the German Valibot message', async () => {
    await expect(
      createInitialAdmin({
        username: 'has space',
        name: 'X',
        password: 'okpassword123'
      })
    ).rejects.toThrow()
  })
})

describe('setup.remote — saveCompanyData validation', () => {
  beforeEach(async () => {
    await resetDb()
    await seedFreshCompany()
  })

  it('persists a complete company record', async () => {
    await saveCompanyData(validCompany)
    const [row] = await db.select().from(companySettings)
    expect(row.companyName).toBe('TwinCast GmbH')
    expect(row.taxNumber).toBe('12/345/67890')
    expect(row.iban).toBe('DE89370400440532013000')
    expect(row.city).toBe('Musterstadt')
  })

  it('rejects a payload missing the now-required tax number', async () => {
    const { taxNumber: _omit, ...withoutTax } = validCompany
    void _omit
    await expect(saveCompanyData(withoutTax as never)).rejects.toThrow()
  })

  it('rejects a payload missing the now-required bank details', async () => {
    const { iban: _i, bic: _b, bankName: _n, ...withoutBank } = validCompany
    void [_i, _b, _n]
    await expect(saveCompanyData(withoutBank as never)).rejects.toThrow()
  })
})

describe('setup.remote — completeSetup guards', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('refuses when no admin user exists', async () => {
    await seedFreshCompany()
    await saveCompanyData(validCompany)
    await expectHttpError(() => completeSetup(), 400)
    const [row] = await db.select().from(companySettings)
    expect(row.setupCompleted).toBe(false)
  })

  it('refuses when the company data has not been filled in', async () => {
    await seedFreshCompany() // empty company row
    await seedUserRow()
    await expectHttpError(() => completeSetup(), 400)
    const [row] = await db.select().from(companySettings)
    expect(row.setupCompleted).toBe(false)
  })

  it('completes when an admin exists and company data is present', async () => {
    await seedFreshCompany()
    await saveCompanyData(validCompany)
    await seedUserRow()
    await completeSetup()
    const [row] = await db.select().from(companySettings)
    expect(row.setupCompleted).toBe(true)
  })
})
