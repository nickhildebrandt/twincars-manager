// @vitest-environment node
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi
} from 'vitest'

/**
 * Security-focused tests for the public REST API. Complements
 * `public-api.test.ts` (happy paths) by exercising SQL-injection-ish
 * inputs and pathological quantity values to verify drizzle's prepared
 * statements + business-rule guards both hold.
 *
 * @group integration
 * @module public-api
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  companySettings,
  customerInquiries,
  customers,
  documentItems,
  documents,
  itemPriceVersions,
  items,
  numberRanges,
  publicHolidays,
  shippingOptions,
  tirePhotos,
  tirePriceVersions,
  tires,
  vehicleListings,
  vehiclePhotos,
  vehicles,
  workshopHours
} from '$lib/server/db/schema'

/** Suite-wide Bearer token; stubbed via `vi.stubEnv` in `beforeAll`. */
const VALID_TOKEN = 'public-api-security-test-token-aaaaaaaaaa'
import { publicApi } from '$lib/server/public-api'
import { handlePublicServices } from './services/endpoint'
import { handlePublicTires } from './tires/endpoint'
import { handlePublicTireDetail } from './tires/[id]/endpoint'
import { handlePublicUsedCars } from './used-cars/endpoint'
import { handlePublicUsedCarDetail } from './used-cars/[id]/endpoint'
import { handleContactInquiry } from './contact/endpoint'
import { handlePublicOrder } from './orders/endpoint'

function makeEvent(
  request: Request,
  params: Record<string, string> = {}
): Parameters<typeof publicApi>[0] extends (e: infer E) => unknown ? E : never {
  const url = new URL(request.url)
  return {
    request,
    url,
    locals: {} as unknown,
    params,
    route: { id: null },
    setHeaders: () => undefined
  } as unknown as Parameters<typeof publicApi>[0] extends (
    e: infer E
  ) => unknown
    ? E
    : never
}

async function resetDb() {
  await db.delete(documentItems)
  await db.delete(documents)
  await db.delete(calendarEntries)
  await db.delete(customerInquiries)
  await db.delete(vehiclePhotos)
  await db.delete(vehicleListings)
  await db.delete(vehicles)
  await db.delete(tirePhotos)
  await db.delete(tirePriceVersions)
  await db.delete(tires)
  await db.delete(itemPriceVersions)
  await db.delete(items)
  await db.delete(shippingOptions)
  await db.delete(customers)
  await db.delete(companySettings)
  await db.delete(workshopHours)
  await db.delete(publicHolidays)
  await db.delete(numberRanges)
}

async function mintTestToken(): Promise<string> {
  // Env-based auth: no DB row to create, just hand back the suite's
  // configured Bearer token.
  return VALID_TOKEN
}

const authedGet = (path: string, token: string): Request =>
  new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

const authedPost = (path: string, token: string, body: unknown): Request =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

const SQLI_PAYLOAD = "'; DROP TABLE customers; --"
const SQLI_PAYLOAD_UNION = "' UNION SELECT 1,2,3 --"

describe('public-api security: SQL injection inputs', () => {
  beforeAll(() => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN)
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await resetDb()
  })

  it('GET /api/public/services tolerates SQL-injection-like payloads in query params', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicServices)
    const event = makeEvent(
      authedGet(
        `/api/public/services?q=${encodeURIComponent(SQLI_PAYLOAD)}`,
        token
      )
    )
    const res = await handler(event)
    // Either 200 (param ignored) or a curated 4xx — never 500, never a leak.
    expect([200, 400]).toContain(res.status)
    // customers table must still exist.
    const rows = await db.select().from(customers)
    expect(Array.isArray(rows)).toBe(true)
  })

  it('GET /api/public/tires filters SQL-injection-like q / size / season safely', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicTires)
    for (const param of ['q', 'size', 'season', 'brand', 'speedIndex']) {
      const event = makeEvent(
        authedGet(
          `/api/public/tires?${param}=${encodeURIComponent(SQLI_PAYLOAD)}`,
          token
        )
      )
      const res = await handler(event)
      expect([200, 400]).toContain(res.status)
      const body = await res.json()
      // Must be a JSON envelope, not an error trace.
      expect(body).toBeTypeOf('object')
      if (res.status === 200) {
        expect(Array.isArray(body.data.tires)).toBe(true)
      }
    }
  })

  it('GET /api/public/tires with UNION-style payload also stays safe', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicTires)
    const event = makeEvent(
      authedGet(
        `/api/public/tires?q=${encodeURIComponent(SQLI_PAYLOAD_UNION)}`,
        token
      )
    )
    const res = await handler(event)
    expect([200, 400]).toContain(res.status)
  })

  it('GET /api/public/tires/:id with SQLi-shaped id returns 400 (not 500)', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicTireDetail)
    const event = makeEvent(
      authedGet(`/api/public/tires/${encodeURIComponent(SQLI_PAYLOAD)}`, token),
      { id: SQLI_PAYLOAD }
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('GET /api/public/used-cars/:id with SQLi-shaped id returns 400', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicUsedCarDetail)
    const event = makeEvent(
      authedGet(
        `/api/public/used-cars/${encodeURIComponent(SQLI_PAYLOAD)}`,
        token
      ),
      { id: SQLI_PAYLOAD }
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
  })

  it('GET /api/public/used-cars list with SQLi q stays safe', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handlePublicUsedCars)
    const event = makeEvent(
      authedGet(
        `/api/public/used-cars?q=${encodeURIComponent(SQLI_PAYLOAD)}`,
        token
      )
    )
    const res = await handler(event)
    expect([200, 400]).toContain(res.status)
  })

  it('POST /api/public/contact accepts a benign-looking SQLi payload in message + subject (no SQL escape)', async () => {
    const token = await mintTestToken()
    const handler = publicApi(handleContactInquiry)
    const event = makeEvent(
      authedPost('/api/public/contact', token, {
        customerEmail: 'tester@example.com',
        customerName: 'Test',
        subject: SQLI_PAYLOAD,
        message: SQLI_PAYLOAD_UNION
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(200)
    // The payload is stored as-is — drizzle parameterises every insert,
    // so the literal SQL fragment never reaches the parser.
    const rows = await db.select().from(customerInquiries)
    expect(rows).toHaveLength(1)
    expect(rows[0].subject).toBe(SQLI_PAYLOAD)
    expect(rows[0].message).toBe(SQLI_PAYLOAD_UNION)
  })
})

describe('POST /api/public/orders — quantity bounds', () => {
  beforeAll(() => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN)
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  async function seedOrderable() {
    await db
      .insert(numberRanges)
      .values({ kind: 'customer', formatTemplate: 'KU-{NNNNN}', nextValue: 1 })
    await db
      .insert(numberRanges)
      .values({
        kind: 'invoice',
        formatTemplate: 'RE-{YYYY}-{NNNN}',
        nextValue: 1
      })
    await db.insert(companySettings).values({ defaultVatRate: '19.00' })
    const [ship] = await db
      .insert(shippingOptions)
      .values({
        name: 'DHL',
        priceNet: '5.90',
        freeAboveNet: '100.00',
        active: true
      })
      .returning({ id: shippingOptions.id })
    const [art] = await db
      .insert(tires)
      .values({
        articleNumber: 'TIRE-Q',
        brand: 'Pirelli',
        model: 'P Zero',
        width: 205,
        aspectRatio: 55,
        construction: 'R',
        diameterInch: 16,
        season: 'Sommer',
        onlineSellable: true
      })
      .returning({ id: tires.id })
    await db
      .insert(tirePriceVersions)
      .values({
        tireId: art.id,
        validFrom: '2020-01-01',
        unitPriceNet: '50.00'
      })
    return { shippingId: ship.id, tireId: art.id }
  }

  beforeEach(async () => {
    await resetDb()
  })

  it('rejects quantity = 0 with a curated 400', async () => {
    const { shippingId, tireId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'q0@example.com',
        customerName: 'Q Zero',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ tireId, quantity: 0 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
    expect(body.error.message).toMatch(/quantity/i)
  })

  it('rejects negative quantity with a curated 400', async () => {
    const { shippingId, tireId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'qneg@example.com',
        customerName: 'Q Neg',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ tireId, quantity: -5 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('rejects absurdly large quantity (10_000_000) with a curated 400', async () => {
    const { shippingId, tireId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'qmax@example.com',
        customerName: 'Q Max',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ tireId, quantity: 10_000_000 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
    expect(body.error.message).toMatch(/quantity/i)
  })

  it('rejects non-integer quantity (e.g. 1.5)', async () => {
    const { shippingId, tireId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'qfrac@example.com',
        customerName: 'Q Frac',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ tireId, quantity: 1.5 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
  })

  it('accepts quantity = 1 (lower edge of the valid range)', async () => {
    const { shippingId, tireId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'q1@example.com',
        customerName: 'Q One',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ tireId, quantity: 1 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(200)
  })

  it('rejects empty lines array', async () => {
    const { shippingId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'qempty@example.com',
        customerName: 'Q Empty',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: []
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
  })

  it('rejects when articleId is not a UUID (could carry an injection payload)', async () => {
    const { shippingId } = await seedOrderable()
    const token = await mintTestToken()
    const handler = publicApi(handlePublicOrder)
    const event = makeEvent(
      authedPost('/api/public/orders', token, {
        customerEmail: 'qbad@example.com',
        customerName: 'Q Bad',
        deliveryAddress: { street: 'a', zip: '1', city: 'B' },
        shippingOptionId: shippingId,
        lines: [{ articleId: SQLI_PAYLOAD, quantity: 1 }]
      })
    )
    const res = await handler(event)
    expect(res.status).toBe(400)
  })
})
