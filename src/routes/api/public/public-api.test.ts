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
 * Integration tests for the token-authenticated public REST API.
 *
 * Every endpoint is exercised through the `publicApi(handler)` wrapper
 * with a real Bearer token minted against the in-memory database, so
 * the assertions cover both the auth layer and the endpoint logic.
 *
 * @group integration
 * @module public-api
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// Capture confirmation-mail invocations from the booking endpoint
// without actually trying to render+send through nodemailer (no SMTP
// is seeded for most tests, the function would log + return ok=false
// and pollute the audit-trail in shared `sent_messages` state).
const { sendAppointmentConfirmationMock, sendContactNotificationMock } =
  vi.hoisted(() => ({
    sendAppointmentConfirmationMock: vi
      .fn<(input: unknown) => Promise<{ ok: true; messageId: string | null }>>()
      .mockResolvedValue({ ok: true, messageId: '<mock>' }),
    sendContactNotificationMock: vi
      .fn<
        (
          input: unknown
        ) => Promise<
          { ok: true; messageId: string | null } | { ok: false; error: string }
        >
      >()
      .mockResolvedValue({ ok: true, messageId: '<mock>' })
  }))
vi.mock('$lib/server/services/mail-service', async () => {
  const actual = await vi.importActual<
    typeof import('$lib/server/services/mail-service')
  >('$lib/server/services/mail-service')
  return {
    ...actual,
    sendAppointmentConfirmation: sendAppointmentConfirmationMock,
    sendContactNotification: sendContactNotificationMock
  }
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
  posts,
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

/**
 * Fixed Bearer tokens for the env-var based public-API auth. We stub
 * `API_TOKENS` in the suite-level `beforeAll` so every endpoint test
 * sees a known valid token, and individual cases can override the
 * env to assert auth-failure paths (unknown / revoked-style /
 * malformed). Note: there is no longer a notion of "revoked" — a
 * token is either in the env list or it isn't — so the legacy
 * "revoked token" tests now exercise the equivalent "token not in
 * the configured list" path.
 */
const VALID_TOKEN = 'public-api-test-token-aaaaaaaaaaaaaaaa'
const REMOVED_TOKEN = 'public-api-test-token-bbbbbbbbbbbbbbbb'
import { publicApi } from '$lib/server/public-api'
import { handlePublicServices } from './services/endpoint'
import { handlePublicTires } from './tires/endpoint'
import { handlePublicShippingOptions } from './shipping-options/endpoint'
import { handlePublicUsedCars } from './used-cars/endpoint'
import { handlePublicFreeSlots } from './free-slots/endpoint'
import { handleBookAppointment } from './appointments/endpoint'
import { handlePublicTireDetail } from './tires/[id]/endpoint'
import { handlePublicUsedCarDetail } from './used-cars/[id]/endpoint'
import { handlePublicServiceDetail } from './services/[id]/endpoint'
import { handleContactInquiry } from './contact/endpoint'
import { handlePublicOrder } from './orders/endpoint'
import { handlePublicCompany } from './company/endpoint'
import { handlePublicPosts } from './posts/endpoint'
import { handlePublicPostDetail } from './posts/[slug]/endpoint'
import { createPost } from '$lib/server/services/post-service'

/**
 * Build a SvelteKit-shaped RequestEvent stub good enough for the
 * public-API wrapper. We don't need route / setHeaders here; the
 * handlers only read `request`, `url`, `params` and `locals`.
 */
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
  await db.delete(posts)
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

async function seedCustomerNumberRange() {
  await db
    .insert(numberRanges)
    .values({ kind: 'customer', formatTemplate: 'KU-{NNNNN}', nextValue: 1 })
}

/** Seed an online-bookable tire-change service and return its id. */
async function seedBookableService(): Promise<string> {
  const [svc] = await db
    .insert(items)
    .values({
      articleNumber: 'SVC-REIFEN',
      description: 'Reifenwechsel',
      kind: 'service',
      onlineBookable: true
    })
    .returning({ id: items.id })
  return svc.id
}

async function seedHoursMonFri() {
  await db.insert(workshopHours).values([
    { weekday: 0, opensAt: '08:00', closesAt: '17:00', closed: true },
    { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 5, opensAt: '08:00', closesAt: '17:00', closed: false },
    { weekday: 6, opensAt: '08:00', closesAt: '17:00', closed: true }
  ])
}

async function mintTestToken(): Promise<string> {
  // Env-based tokens have no "mint" step — return the suite's fixed
  // token so callers stay structurally identical to the legacy
  // DB-backed pattern.
  return VALID_TOKEN
}

const authedGet = (path: string, token: string): Request =>
  new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

describe('public-api endpoints', () => {
  beforeAll(() => {
    // The env-var auth checks `env.API_TOKENS` on every request, so
    // stub it once for the entire suite. Tests that want to exercise
    // "no valid token configured" paths still get a non-matching
    // candidate token because `REMOVED_TOKEN` is intentionally NOT
    // in the configured list.
    vi.stubEnv('API_TOKENS', VALID_TOKEN)
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await resetDb()
    sendContactNotificationMock.mockReset()
    sendContactNotificationMock.mockResolvedValue({
      ok: true,
      messageId: '<mock>'
    })
  })

  describe('auth wrapper', () => {
    it('returns 401 with UNAUTHORIZED code when no Bearer header is sent', async () => {
      const handler = publicApi(handlePublicServices)
      const event = makeEvent(
        new Request('http://localhost/api/public/services')
      )
      const res = await handler(event)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handlePublicServices)
      const event = makeEvent(authedGet('/api/public/services', REMOVED_TOKEN))
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('returns 401 for a malformed Bearer header', async () => {
      const handler = publicApi(handlePublicServices)
      const event = makeEvent(
        new Request('http://localhost/api/public/services', {
          headers: { Authorization: 'Token whatever' }
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('OPTIONS bypasses auth (CORS preflight)', async () => {
      const handler = publicApi(handlePublicServices)
      const event = makeEvent(
        new Request('http://localhost/api/public/services', {
          method: 'OPTIONS'
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('GET /api/public/services', () => {
    it('returns active service items with current prices', async () => {
      const token = await mintTestToken()
      const [svc] = await db
        .insert(items)
        .values({
          articleNumber: 'SVC-1',
          description: 'Inspektion',
          kind: 'service',
          unit: 'Std'
        })
        .returning({ id: items.id })
      await db
        .insert(itemPriceVersions)
        .values({
          itemId: svc.id,
          validFrom: '2020-01-01',
          unitPriceNet: '89.50'
        })
      // Article (non-service) must NOT show.
      await db
        .insert(items)
        .values({
          articleNumber: 'ART-1',
          description: 'Ölfilter',
          kind: 'article'
        })

      const handler = publicApi(handlePublicServices)
      const event = makeEvent(authedGet('/api/public/services', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.services).toHaveLength(1)
      expect(body.data.services[0].articleNumber).toBe('SVC-1')
      expect(body.data.services[0].currentPriceNet).toBe(89.5)
      // attributes column dropped in Migration 0022 — endpoint emits `{}`.
      expect(body.data.services[0].attributes).toEqual({})
    })
  })

  describe('GET /api/public/tires', () => {
    it('returns only online-sellable tires with EU-label columns', async () => {
      const token = await mintTestToken()
      const [shop] = await db
        .insert(shippingOptions)
        .values({ name: 'DHL', priceNet: '5.90' })
        .returning({ id: shippingOptions.id })
      const [tire] = await db
        .insert(tires)
        .values({
          articleNumber: 'TIRE-1',
          brand: 'Michelin',
          model: 'Pilot Sport 4',
          width: 205,
          aspectRatio: 55,
          construction: 'R',
          diameterInch: 16,
          loadIndex: '91',
          speedIndex: 'V',
          season: 'Sommer',
          onlineSellable: true,
          shippingOptionId: shop.id
        })
        .returning({ id: tires.id })
      await db
        .insert(tirePriceVersions)
        .values({
          tireId: tire.id,
          validFrom: '2020-01-01',
          unitPriceNet: '79.90'
        })
      // Not online must NOT show.
      await db
        .insert(tires)
        .values({
          articleNumber: 'TIRE-INT',
          brand: 'Internal',
          model: 'Hidden',
          width: 205,
          aspectRatio: 55,
          construction: 'R',
          diameterInch: 16,
          season: 'Sommer',
          onlineSellable: false
        })

      const handler = publicApi(handlePublicTires)
      const event = makeEvent(authedGet('/api/public/tires', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tires).toHaveLength(1)
      const t = body.data.tires[0]
      expect(t.articleNumber).toBe('TIRE-1')
      expect(t.currentPriceNet).toBe(79.9)
      expect(t.shippingOptionId).toBe(shop.id)
      expect(t.brand).toBe('Michelin')
      expect(t.sizeLabel).toBe('205/55R16')
      expect(t.width).toBe(205)
      expect(t.aspectRatio).toBe(55)
      expect(t.diameterInch).toBe(16)
      expect(t.season).toBe('Sommer')
      expect(t.speedIndex).toBe('V')
      expect(t.loadIndex).toBe('91')
    })
  })

  describe('GET /api/public/shipping-options', () => {
    it('returns only active options', async () => {
      const token = await mintTestToken()
      await db.insert(shippingOptions).values([
        { name: 'Inactive', priceNet: '0', active: false, sortOrder: 5 },
        {
          name: 'Active A',
          priceNet: '4.90',
          freeAboveNet: '100.00',
          active: true,
          sortOrder: 10
        },
        { name: 'Active B', priceNet: '6.90', active: true, sortOrder: 20 }
      ])
      const handler = publicApi(handlePublicShippingOptions)
      const event = makeEvent(authedGet('/api/public/shipping-options', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.options).toHaveLength(2)
      expect(body.data.options[0].name).toBe('Active A')
      expect(body.data.options[0].freeAboveNet).toBe(100)
      expect(body.data.options[1].name).toBe('Active B')
    })
  })

  describe('GET /api/public/used-cars', () => {
    it('returns inventory vehicles with photos', async () => {
      const token = await mintTestToken()
      const [v] = await db
        .insert(vehicles)
        .values({
          customerId: null,
          make: 'BMW',
          model: 'M3',
          firstRegistration: '2020-05-01',
          mileageKm: 42000,
          fuelType: 'Benzin',
          gearbox: 'Schaltgetriebe'
        })
        .returning({ id: vehicles.id })
      await db
        .insert(vehicleListings)
        .values({
          vehicleId: v.id,
          status: 'available',
          salesPriceGross: '38900.00',
          highlights: 'Sehr gepflegt, scheckheftgepflegt.'
        })
      await db.insert(vehiclePhotos).values([
        {
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
          isMain: true,
          sortOrder: 0
        },
        {
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
          isMain: false,
          sortOrder: 1
        }
      ])
      const handler = publicApi(handlePublicUsedCars)
      const event = makeEvent(authedGet('/api/public/used-cars', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.vehicles).toHaveLength(1)
      const car = body.data.vehicles[0]
      expect(car.make).toBe('BMW')
      expect(car.model).toBe('M3')
      expect(car.priceGross).toBe(38900)
      expect(car.fuel).toBe('Benzin')
      expect(car.photos).toHaveLength(2)
      expect(car.photos[0].dataUrl).toBe('data:image/jpeg;base64,AAAA')
    })
  })

  describe('GET /api/public/free-slots', () => {
    it('rejects when from/to are missing', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicFreeSlots)
      const event = makeEvent(authedGet('/api/public/free-slots', token))
      const res = await handler(event)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('BAD_REQUEST')
    })

    it('returns free slots for the configured opening hours', async () => {
      await seedHoursMonFri()
      const token = await mintTestToken()
      const from = '2026-06-01T00:00:00'
      const to = '2026-06-01T23:59:00'
      const handler = publicApi(handlePublicFreeSlots)
      const event = makeEvent(
        authedGet(
          `/api/public/free-slots?from=${from}&to=${to}&durationMinutes=30`,
          token
        )
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.slots).toHaveLength(35)
    })

    it('rejects ranges > 60 days', async () => {
      await seedHoursMonFri()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicFreeSlots)
      const event = makeEvent(
        authedGet(
          '/api/public/free-slots?from=2026-06-01T00:00:00&to=2026-09-01T00:00:00&durationMinutes=30',
          token
        )
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/public/appointments', () => {
    const authedPost = (token: string, body: unknown): Request =>
      new Request('http://localhost/api/public/appointments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      })

    it('books an appointment for an online-bookable service, creating a customer when none exists', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const serviceId = await seedBookableService()
      sendAppointmentConfirmationMock.mockClear()
      const token = await mintTestToken()
      // Pick a Monday in the future, 09:00.
      const start = new Date()
      start.setDate(start.getDate() + 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)

      const handler = publicApi(handleBookAppointment)
      const event = makeEvent(
        authedPost(token, {
          serviceId,
          customerEmail: 'kunde@example.com',
          customerName: 'Max Mustermann',
          customerPhone: '+49 30 1234567',
          startsAt: start.toISOString(),
          durationMinutes: 60
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.appointmentId).toBeTruthy()
      expect(body.data.confirmationToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      // Customer was created.
      const createdCustomers = await db.select().from(customers)
      expect(createdCustomers).toHaveLength(1)
      expect(createdCustomers[0].email).toBe('kunde@example.com')
      expect(createdCustomers[0].wantsBroadcast).toBe(false)
      expect(createdCustomers[0].kind).toBe('regular')
      // Appointment created with the service title + confirmation token.
      const createdAppts = await db.select().from(calendarEntries)
      expect(createdAppts).toHaveLength(1)
      expect(createdAppts[0].title).toBe('Reifenwechsel')
      expect(createdAppts[0].notes).toContain('confirmation:')

      // Confirmation mail was triggered with the right payload.
      expect(sendAppointmentConfirmationMock).toHaveBeenCalledTimes(1)
      const mailArg = sendAppointmentConfirmationMock.mock
        .calls[0][0] as Record<string, unknown>
      expect(mailArg.appointmentId).toBe(body.data.appointmentId)
      expect(mailArg.customerEmail).toBe('kunde@example.com')
      expect(mailArg.customerName).toBe('Max Mustermann')
      expect(mailArg.durationMinutes).toBe(60)
      expect(mailArg.confirmationToken).toBe(body.data.confirmationToken)
      expect(mailArg.serviceTitle).toBe('Reifenwechsel')
      expect(mailArg.startsAt).toBeInstanceOf(Date)
    })

    it('rejects booking a service that is not online-bookable', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const [svc] = await db
        .insert(items)
        .values({
          articleNumber: 'SVC-INSP',
          description: 'Inspektion',
          kind: 'service',
          onlineBookable: false
        })
        .returning({ id: items.id })
      const token = await mintTestToken()
      const start = new Date()
      start.setDate(start.getDate() + 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)
      const handler = publicApi(handleBookAppointment)
      const res = await handler(
        makeEvent(
          authedPost(token, {
            serviceId: svc.id,
            customerEmail: 'x@example.com',
            customerName: 'X',
            startsAt: start.toISOString(),
            durationMinutes: 60
          })
        )
      )
      expect(res.status).toBe(400)
      // Nothing was booked.
      expect(await db.select().from(calendarEntries)).toHaveLength(0)
    })

    it('returns 409 when the slot is already taken', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const serviceId = await seedBookableService()
      const token = await mintTestToken()
      const start = new Date()
      start.setDate(start.getDate() + 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)

      // Pre-existing appointment at the same time.
      await db
        .insert(calendarEntries)
        .values({
          kind: 'appointment',
          title: 'Belegt',
          startsAt: start,
          endsAt: new Date(start.getTime() + 60 * 60 * 1000),
          allDay: false,
          status: 'scheduled'
        })

      const handler = publicApi(handleBookAppointment)
      const event = makeEvent(
        authedPost(token, {
          serviceId,
          customerEmail: 'two@example.com',
          customerName: 'Zwei Person',
          startsAt: start.toISOString(),
          durationMinutes: 60
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('CONFLICT')
    })

    it('refuses past starts', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const serviceId = await seedBookableService()
      const token = await mintTestToken()
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
      past.setHours(9, 0, 0, 0)
      const handler = publicApi(handleBookAppointment)
      const event = makeEvent(
        authedPost(token, {
          serviceId,
          customerEmail: 'past@example.com',
          customerName: 'Past',
          startsAt: past.toISOString(),
          durationMinutes: 60
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })

    it('reuses an existing customer by email instead of creating a new one', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const serviceId = await seedBookableService()
      const token = await mintTestToken()
      const [existing] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-99999',
          kind: 'regular',
          wantsBroadcast: false,
          firstName: 'Existing',
          lastName: 'User',
          email: 'existing@example.com'
        })
        .returning({ id: customers.id })

      const start = new Date()
      start.setDate(start.getDate() + 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1)
      start.setHours(10, 0, 0, 0)

      const handler = publicApi(handleBookAppointment)
      const event = makeEvent(
        authedPost(token, {
          serviceId,
          customerEmail: 'existing@example.com',
          customerName: 'Existing User',
          startsAt: start.toISOString(),
          durationMinutes: 30
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const allCustomers = await db.select().from(customers)
      expect(allCustomers).toHaveLength(1)
      const appts = await db.select().from(calendarEntries)
      expect(appts[0].customerId).toBe(existing.id)
    })

    it('rejects a booking without a serviceId (only bookable services allowed)', async () => {
      await seedHoursMonFri()
      await seedCustomerNumberRange()
      const token = await mintTestToken()
      const start = new Date()
      start.setDate(start.getDate() + 7)
      while (start.getDay() !== 1) start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)
      const handler = publicApi(handleBookAppointment)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'nodur@example.com',
          customerName: 'No Duration',
          startsAt: start.toISOString()
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })
  })

  /* ── /api/public/tires/:id ─────────────────────────────────── */

  describe('GET /api/public/tires/:id', () => {
    async function seedArticle(): Promise<string> {
      const [art] = await db
        .insert(tires)
        .values({
          articleNumber: 'TIRE-DET-1',
          brand: 'X',
          model: 'DetailModel',
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
          unitPriceNet: '79.90'
        })
      await db
        .insert(tirePhotos)
        .values({
          tireId: art.id,
          mime: 'image/jpeg',
          data: 'data:image/jpeg;base64,ZZZZ',
          isMain: true,
          sortOrder: 0
        })
      return art.id
    }

    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicTireDetail)
      const event = makeEvent(
        new Request('http://localhost/api/public/tires/x'),
        { id: 'x' }
      )
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handlePublicTireDetail)
      const event = makeEvent(authedGet('/api/public/tires/x', REMOVED_TOKEN), {
        id: 'x'
      })
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('returns 400 when id is not a UUID', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTireDetail)
      const event = makeEvent(
        authedGet('/api/public/tires/not-a-uuid', token),
        { id: 'not-a-uuid' }
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })

    it('returns the tire with photos when found', async () => {
      const id = await seedArticle()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTireDetail)
      const event = makeEvent(authedGet(`/api/public/tires/${id}`, token), {
        id
      })
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tire.id).toBe(id)
      expect(body.data.tire.currentPriceNet).toBe(79.9)
      expect(body.data.tire.photos).toHaveLength(1)
      expect(body.data.tire.photos[0].url).toBe('data:image/jpeg;base64,ZZZZ')
    })

    it('returns 404 for an unknown UUID', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTireDetail)
      const missing = '00000000-0000-0000-0000-000000000000'
      const event = makeEvent(
        authedGet(`/api/public/tires/${missing}`, token),
        { id: missing }
      )
      const res = await handler(event)
      expect(res.status).toBe(404)
    })
  })

  /* ── /api/public/tires filters ─────────────────────────────── */

  describe('GET /api/public/tires with filters', () => {
    async function seedFilterableArticles() {
      const [a] = await db
        .insert(tires)
        .values({
          articleNumber: 'ART-F-A',
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
          tireId: a.id,
          validFrom: '2020-01-01',
          unitPriceNet: '99.00'
        })
      const [b] = await db
        .insert(tires)
        .values({
          articleNumber: 'ART-F-B',
          brand: 'Continental',
          model: 'WinterContact',
          width: 195,
          aspectRatio: 65,
          construction: 'R',
          diameterInch: 15,
          season: 'Winter',
          onlineSellable: true
        })
        .returning({ id: tires.id })
      await db
        .insert(tirePriceVersions)
        .values({
          tireId: b.id,
          validFrom: '2020-01-01',
          unitPriceNet: '49.00'
        })
    }

    it('filters by size triple parsed from "205/55R16"', async () => {
      await seedFilterableArticles()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTires)
      const event = makeEvent(
        authedGet('/api/public/tires?size=205/55R16', token)
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tires).toHaveLength(1)
      expect(body.data.tires[0].articleNumber).toBe('ART-F-A')
    })

    it('filters by season column (case-sensitive)', async () => {
      await seedFilterableArticles()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTires)
      const event = makeEvent(
        authedGet('/api/public/tires?season=Winter', token)
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tires).toHaveLength(1)
      expect(body.data.tires[0].articleNumber).toBe('ART-F-B')
    })

    it('filters by maxPriceNet', async () => {
      await seedFilterableArticles()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTires)
      const event = makeEvent(
        authedGet('/api/public/tires?maxPriceNet=60', token)
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tires).toHaveLength(1)
      expect(body.data.tires[0].articleNumber).toBe('ART-F-B')
    })

    it('rejects a negative maxPriceNet with 400', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTires)
      const event = makeEvent(
        authedGet('/api/public/tires?maxPriceNet=-5', token)
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })

    it('filters by free-text q', async () => {
      await seedFilterableArticles()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicTires)
      const event = makeEvent(authedGet('/api/public/tires?q=winter', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.tires).toHaveLength(1)
      expect(body.data.tires[0].articleNumber).toBe('ART-F-B')
    })
  })

  /* ── /api/public/used-cars/:id ───────────────────────────────── */

  describe('GET /api/public/used-cars/:id', () => {
    async function seedCar(): Promise<string> {
      const [v] = await db
        .insert(vehicles)
        .values({
          customerId: null,
          make: 'VW',
          model: 'Golf',
          firstRegistration: '2021-01-01',
          mileageKm: 15000,
          fuelType: 'Diesel',
          gearbox: 'Automatik'
        })
        .returning({ id: vehicles.id })
      await db
        .insert(vehicleListings)
        .values({
          vehicleId: v.id,
          status: 'available',
          salesPriceGross: '22500.00',
          highlights: 'Top gepflegt'
        })
      await db
        .insert(vehiclePhotos)
        .values({
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
          isMain: true,
          sortOrder: 0
        })
      return v.id
    }

    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicUsedCarDetail)
      const event = makeEvent(
        new Request('http://localhost/api/public/used-cars/x'),
        { id: 'x' }
      )
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handlePublicUsedCarDetail)
      const event = makeEvent(
        authedGet('/api/public/used-cars/x', REMOVED_TOKEN),
        { id: 'x' }
      )
      const res = await handler(event)
      expect(res.status).toBe(401)
    })

    it('returns 400 for a non-UUID id', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicUsedCarDetail)
      const event = makeEvent(
        authedGet('/api/public/used-cars/not-uuid', token),
        { id: 'not-uuid' }
      )
      const res = await handler(event)
      expect(res.status).toBe(400)
    })

    it('returns the vehicle when found', async () => {
      const id = await seedCar()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicUsedCarDetail)
      const event = makeEvent(authedGet(`/api/public/used-cars/${id}`, token), {
        id
      })
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.vehicle.make).toBe('VW')
      expect(body.data.vehicle.priceGross).toBe(22500)
      expect(body.data.vehicle.photos).toHaveLength(1)
    })

    it('returns 404 for an unknown UUID', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicUsedCarDetail)
      const missing = '00000000-0000-0000-0000-000000000000'
      const event = makeEvent(
        authedGet(`/api/public/used-cars/${missing}`, token),
        { id: missing }
      )
      const res = await handler(event)
      expect(res.status).toBe(404)
    })
  })

  /* ── /api/public/services/:id ───────────────────────────────── */

  describe('GET /api/public/services/:id', () => {
    async function seedService(): Promise<string> {
      const [svc] = await db
        .insert(items)
        .values({
          articleNumber: 'SVC-DET-1',
          description: 'Reifenwechsel',
          kind: 'service',
          unit: 'Std'
        })
        .returning({ id: items.id })
      await db
        .insert(itemPriceVersions)
        .values({
          itemId: svc.id,
          validFrom: '2020-01-01',
          unitPriceNet: '45.00'
        })
      return svc.id
    }

    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicServiceDetail)
      const event = makeEvent(
        new Request('http://localhost/api/public/services/x'),
        { id: 'x' }
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('returns 400 for a non-UUID id', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicServiceDetail)
      const event = makeEvent(
        authedGet('/api/public/services/not-uuid', token),
        { id: 'not-uuid' }
      )
      expect((await handler(event)).status).toBe(400)
    })

    it('returns the service when found', async () => {
      const id = await seedService()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicServiceDetail)
      const event = makeEvent(authedGet(`/api/public/services/${id}`, token), {
        id
      })
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.service.id).toBe(id)
      expect(body.data.service.currentPriceNet).toBe(45)
      // attributes column dropped in Migration 0022 — endpoint emits `{}`.
      expect(body.data.service.attributes).toEqual({})
    })

    it('returns 404 for an article (wrong kind)', async () => {
      const token = await mintTestToken()
      const [art] = await db
        .insert(items)
        .values({
          articleNumber: 'ART-OTHER',
          description: 'kein Service',
          kind: 'article'
        })
        .returning({ id: items.id })
      const handler = publicApi(handlePublicServiceDetail)
      const event = makeEvent(
        authedGet(`/api/public/services/${art.id}`, token),
        { id: art.id }
      )
      expect((await handler(event)).status).toBe(404)
    })
  })

  /* ── /api/public/contact ─────────────────────────────────────── */

  describe('POST /api/public/contact', () => {
    const authedPost = (token: string, body: unknown): Request =>
      new Request('http://localhost/api/public/contact', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      })

    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        new Request('http://localhost/api/public/contact', { method: 'POST' })
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        authedPost(REMOVED_TOKEN, {
          customerEmail: 'a@b.c',
          customerName: 'Test',
          subject: 'Hi',
          message: 'Hello'
        })
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('persists the inquiry and marks the notification as sent on a successful mail', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'lead@example.com',
          customerName: 'Lead Person',
          customerPhone: '+49 30 123',
          subject: 'Frage zum Reifen',
          message: 'Wie viele DOT habt ihr noch?',
          referenceId: 'art-1',
          referenceType: 'article'
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.inquiryId).toBeTruthy()
      expect(body.data.receivedAt).toBeTruthy()
      const rows = await db.select().from(customerInquiries)
      expect(rows).toHaveLength(1)
      expect(rows[0].customerEmail).toBe('lead@example.com')
      expect(rows[0].referenceType).toBe('article')
      expect(rows[0].status).toBe('new')
      expect(rows[0].notificationStatus).toBe('sent')
      expect(rows[0].notificationSentAt).not.toBeNull()
      expect(rows[0].notificationError).toBeNull()
      expect(sendContactNotificationMock).toHaveBeenCalledTimes(1)
    })

    it('still returns 200 but marks notification as failed when SMTP rejects', async () => {
      sendContactNotificationMock.mockResolvedValueOnce({
        ok: false,
        error: 'SMTP rejected'
      })
      const token = await mintTestToken()
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'lead@example.com',
          customerName: 'Lead Person',
          subject: 'Frage',
          message: 'Hallo'
        })
      )
      const res = await handler(event)
      // Hard requirement: API still returns 200 so the customer never
      // sees an SMTP hiccup.
      expect(res.status).toBe(200)
      const rows = await db.select().from(customerInquiries)
      expect(rows).toHaveLength(1)
      expect(rows[0].notificationStatus).toBe('failed')
      expect(rows[0].notificationError).toBe('SMTP rejected')
      expect(rows[0].notificationSentAt).toBeNull()
    })

    it('returns 400 for invalid body', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'not-an-email',
          customerName: 'X',
          subject: 'Hi',
          message: 'Hi'
        })
      )
      expect((await handler(event)).status).toBe(400)
    })

    it('returns 400 for an invalid referenceType', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handleContactInquiry)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'a@b.c',
          customerName: 'X',
          subject: 'Hi',
          message: 'Hi',
          referenceType: 'invalid'
        })
      )
      expect((await handler(event)).status).toBe(400)
    })
  })

  /* ── /api/public/orders ──────────────────────────────────────── */

  describe('POST /api/public/orders', () => {
    const authedPost = (token: string, body: unknown): Request =>
      new Request('http://localhost/api/public/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      })

    async function seedOrderable() {
      await seedCustomerNumberRange()
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
          articleNumber: 'TIRE-O-1',
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

    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(
        new Request('http://localhost/api/public/orders', { method: 'POST' })
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(authedPost(REMOVED_TOKEN, {}))
      expect((await handler(event)).status).toBe(401)
    })

    it('returns 400 for an invalid body', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(authedPost(token, { customerEmail: 'x' }))
      expect((await handler(event)).status).toBe(400)
    })

    it('creates an order with shipping and returns totals', async () => {
      const { shippingId, tireId } = await seedOrderable()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'buyer@example.com',
          customerName: 'Buyer Person',
          deliveryAddress: {
            street: 'Hauptstr. 1',
            zip: '10115',
            city: 'Berlin'
          },
          shippingOptionId: shippingId,
          lines: [{ tireId, quantity: 1 }]
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.orderId).toBeTruthy()
      expect(body.data.orderNumber).toMatch(/^RE-/)
      expect(body.data.totalNet).toBe(55.9)
      expect(body.data.shippingNet).toBe(5.9)
      expect(body.data.totalGross).toBeGreaterThan(55.9)
      expect(body.data.estimatedDelivery).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const allCustomers = await db.select().from(customers)
      expect(allCustomers).toHaveLength(1)
      expect(allCustomers[0].email).toBe('buyer@example.com')
      const allDocs = await db.select().from(documents)
      expect(allDocs).toHaveLength(1)
      expect(allDocs[0].type).toBe('invoice')
      expect(allDocs[0].status).toBe('draft')
    })

    it('applies free-shipping threshold when net exceeds freeAboveNet', async () => {
      const { shippingId, tireId } = await seedOrderable()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'buyer2@example.com',
          customerName: 'Buyer Two',
          deliveryAddress: {
            street: 'Hauptstr. 1',
            zip: '10115',
            city: 'Berlin'
          },
          shippingOptionId: shippingId,
          lines: [{ tireId, quantity: 5 }]
        })
      )
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.shippingNet).toBe(0)
      expect(body.data.totalNet).toBe(250)
    })

    it('returns 404 for an unknown shipping option', async () => {
      await seedOrderable()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicOrder)
      const event = makeEvent(
        authedPost(token, {
          customerEmail: 'x@x.de',
          customerName: 'X',
          deliveryAddress: { street: 'a', zip: '1', city: 'B' },
          shippingOptionId: '00000000-0000-0000-0000-000000000000',
          lines: [
            { tireId: '00000000-0000-0000-0000-000000000000', quantity: 1 }
          ]
        })
      )
      expect((await handler(event)).status).toBe(404)
    })
  })

  /* ── /api/public/company ─────────────────────────────────────── */

  describe('GET /api/public/company', () => {
    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicCompany)
      const event = makeEvent(
        new Request('http://localhost/api/public/company')
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('returns 401 for a token that is not in the configured list', async () => {
      const handler = publicApi(handlePublicCompany)
      const event = makeEvent(authedGet('/api/public/company', REMOVED_TOKEN))
      expect((await handler(event)).status).toBe(401)
    })

    it('returns the company identity card', async () => {
      await db
        .insert(companySettings)
        .values({
          companyName: 'TwinCars GmbH',
          street: 'Hauptstr. 1',
          zip: '10115',
          city: 'Berlin',
          state: 'BE',
          phone: '030/123',
          email: 'kontakt@twincars.de',
          geoLat: '52.520000',
          geoLon: '13.405000'
        })
      await seedHoursMonFri()
      const token = await mintTestToken()
      const handler = publicApi(handlePublicCompany)
      const event = makeEvent(authedGet('/api/public/company', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.company.legalName).toBe('TwinCars GmbH')
      expect(body.data.company.address.city).toBe('Berlin')
      expect(body.data.company.contact.phone).toBe('030/123')
      expect(body.data.company.geo).toEqual({ lat: 52.52, lon: 13.405 })
      expect(body.data.company.openingHours).toHaveLength(7)
      const sun = body.data.company.openingHours.find(
        (h: { weekday: string }) => h.weekday === 'sunday'
      )
      expect(sun.closed).toBe(true)
      const mon = body.data.company.openingHours.find(
        (h: { weekday: string }) => h.weekday === 'monday'
      )
      expect(mon.closed).toBe(false)
      expect(mon.opensAt).toBe('08:00')
    })
  })

  describe('GET /api/public/posts', () => {
    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicPosts)
      const event = makeEvent(new Request('http://localhost/api/public/posts'))
      expect((await handler(event)).status).toBe(401)
    })

    it('lists only published posts (newest first) with a pagination envelope', async () => {
      await createPost({ title: 'Älterer', body: 'A', published: true })
      await createPost({ title: 'Neuerer', body: 'B', published: true })
      await createPost({ title: 'Entwurf', body: 'C', published: false })

      const token = await mintTestToken()
      const handler = publicApi(handlePublicPosts)
      const event = makeEvent(authedGet('/api/public/posts', token))
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.total).toBe(2)
      expect(body.data.page).toBe(1)
      expect(body.data.pageCount).toBe(1)
      const titles = body.data.posts.map((p: { title: string }) => p.title)
      expect(titles).not.toContain('Entwurf')
      // Newest published first.
      expect(titles[0]).toBe('Neuerer')
    })

    it('honours page / pageSize query parameters', async () => {
      for (let i = 0; i < 3; i++) {
        await createPost({ title: `Beitrag ${i}`, body: 'x', published: true })
      }
      const token = await mintTestToken()
      const handler = publicApi(handlePublicPosts)
      const event = makeEvent(
        authedGet('/api/public/posts?page=2&pageSize=2', token)
      )
      const res = await handler(event)
      const body = await res.json()
      expect(body.data.page).toBe(2)
      expect(body.data.pageSize).toBe(2)
      expect(body.data.posts).toHaveLength(1)
    })

    it('rejects a non-positive page with 400', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicPosts)
      const event = makeEvent(authedGet('/api/public/posts?page=0', token))
      const res = await handler(event)
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/public/posts/:slug', () => {
    it('returns 401 without a Bearer token', async () => {
      const handler = publicApi(handlePublicPostDetail)
      const event = makeEvent(
        new Request('http://localhost/api/public/posts/x'),
        { slug: 'x' }
      )
      expect((await handler(event)).status).toBe(401)
    })

    it('returns a published post by slug', async () => {
      const p = await createPost({
        title: 'Sichtbarer Beitrag',
        body: 'Inhalt',
        published: true
      })
      const token = await mintTestToken()
      const handler = publicApi(handlePublicPostDetail)
      const event = makeEvent(authedGet(`/api/public/posts/${p.slug}`, token), {
        slug: p.slug
      })
      const res = await handler(event)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.post.title).toBe('Sichtbarer Beitrag')
      expect(body.data.post.slug).toBe(p.slug)
    })

    it('returns 404 for a draft slug (drafts are not public)', async () => {
      const p = await createPost({
        title: 'Geheimer Entwurf',
        body: 'x',
        published: false
      })
      const token = await mintTestToken()
      const handler = publicApi(handlePublicPostDetail)
      const event = makeEvent(authedGet(`/api/public/posts/${p.slug}`, token), {
        slug: p.slug
      })
      expect((await handler(event)).status).toBe(404)
    })

    it('returns 404 for an unknown slug', async () => {
      const token = await mintTestToken()
      const handler = publicApi(handlePublicPostDetail)
      const event = makeEvent(authedGet('/api/public/posts/nope', token), {
        slug: 'nope'
      })
      expect((await handler(event)).status).toBe(404)
    })
  })
})
