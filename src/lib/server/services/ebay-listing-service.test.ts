// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for the eBay listing import (Phase 2): happy sync, idempotent
 * re-run (update, not duplicate), ended detection, Trading API
 * pagination, expired/revoked token, HTTP failure, malformed XML,
 * not-connected, unmappable items, plus the paginated listing reads
 * and the import-run log. The Trading API is mocked via the injectable
 * transport — no live eBay call, no global fetch patching.
 *
 * @group integration
 * @module ebay
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// Neutralize vite-loaded `.env` so tests fully control configuration.
vi.mock('$env/dynamic/private', () => ({ env: {} }))

import { db } from '$lib/server/db/client'
import {
  ebayCredentials,
  ebayImportRuns,
  ebayListings
} from '$lib/server/db/schema'
import { encryptSecret } from '$lib/server/crypto'
import {
  EBAY_IMPORT_ERRORS,
  getEbayImportInfo,
  importEbayListings,
  listEbayListings,
  type EbayTradingTransport
} from './ebay-listing-service'

const CONFIG = {
  APP_SECRET: 'test-app-secret-32-bytes-long!!!',
  APP_ENCRYPTION_KEY: 'test-encryption-key',
  EBAY_CLIENT_ID: 'NickHild-Twincars-PRD-abc-123',
  EBAY_CERT_ID: 'PRD-secret-cert-id',
  EBAY_RU_NAME: 'Nick_Hildebra-NickHild-Twinca-test'
}

const ACCESS_TOKEN = 'v^1.1#i^1#SECRET-ACCESS-TOKEN'

/** Seed a connected account whose access token is still fresh. */
async function seedConnection() {
  await db
    .insert(ebayCredentials)
    .values({
      ebayUsername: 'twincast-seller',
      accessToken: encryptSecret(ACCESS_TOKEN),
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      refreshToken: encryptSecret('SECRET-REFRESH-TOKEN'),
      scopes: '',
      environment: 'production'
    })
}

/* ── XML fixtures ────────────────────────────────────────────────── */

type ItemFixture = {
  id?: string
  title?: string
  sku?: string
  price?: string
  currency?: string
  quantityAvailable?: number
  quantitySold?: number
  url?: string
  gallery?: string
  pictures?: string[]
  start?: string
  end?: string
}

const itemXml = (f: ItemFixture) =>
  [
    '<Item>',
    f.id ? `<ItemID>${f.id}</ItemID>` : '',
    f.title ? `<Title>${f.title}</Title>` : '',
    f.sku ? `<SKU>${f.sku}</SKU>` : '',
    '<ListingType>FixedPriceItem</ListingType>',
    `<QuantityAvailable>${f.quantityAvailable ?? 4}</QuantityAvailable>`,
    '<ListingDetails>',
    `<StartTime>${f.start ?? '2026-06-01T08:00:00.000Z'}</StartTime>`,
    `<EndTime>${f.end ?? '2026-09-01T08:00:00.000Z'}</EndTime>`,
    `<ViewItemURL>${f.url ?? `https://www.ebay.de/itm/${f.id}`}</ViewItemURL>`,
    '</ListingDetails>',
    '<SellingStatus>',
    `<CurrentPrice currencyID="${f.currency ?? 'EUR'}">${f.price ?? '129.9'}</CurrentPrice>`,
    `<QuantitySold>${f.quantitySold ?? 1}</QuantitySold>`,
    '</SellingStatus>',
    '<PictureDetails>',
    `<GalleryURL>${f.gallery ?? 'https://i.ebayimg.com/gal.jpg'}</GalleryURL>`,
    ...(f.pictures ?? ['https://i.ebayimg.com/1.jpg']).map(
      (p) => `<PictureURL>${p}</PictureURL>`
    ),
    '</PictureDetails>',
    '</Item>'
  ].join('')

const pageXml = (
  items: string[],
  opts: { totalPages?: number; totalEntries?: number; ack?: string } = {}
) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">',
    `<Ack>${opts.ack ?? 'Success'}</Ack>`,
    '<ActiveList>',
    '<ItemArray>',
    ...items,
    '</ItemArray>',
    '<PaginationResult>',
    `<TotalNumberOfPages>${opts.totalPages ?? 1}</TotalNumberOfPages>`,
    `<TotalNumberOfEntries>${opts.totalEntries ?? items.length}</TotalNumberOfEntries>`,
    '</PaginationResult>',
    '</ActiveList>',
    '</GetMyeBaySellingResponse>'
  ].join('')

const failureXml = (code: string) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">',
    '<Ack>Failure</Ack>',
    '<Errors>',
    '<ShortMessage>Auth token is invalid.</ShortMessage>',
    '<LongMessage>Auth token is hard expired.</LongMessage>',
    `<ErrorCode>${code}</ErrorCode>`,
    '<SeverityCode>Error</SeverityCode>',
    '</Errors>',
    '</GetMyeBaySellingResponse>'
  ].join('')

const okTransport = (body: string): EbayTradingTransport =>
  vi.fn(async () => ({ status: 200, body }))

const httpErrorOf = (err: unknown) =>
  err as { status?: number; body?: { message?: string } }

beforeEach(async () => {
  await db.delete(ebayListings)
  await db.delete(ebayImportRuns)
  await db.delete(ebayCredentials)
  for (const [k, v] of Object.entries(CONFIG)) vi.stubEnv(k, v)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('importEbayListings — happy path', () => {
  it('imports active listings with all mapped fields', async () => {
    await seedConnection()
    const transport = okTransport(
      pageXml([
        itemXml({
          id: '110001',
          title: 'Winterreifen Continental 205/55 R16 &amp; Felgen',
          sku: 'WR-205-55-16',
          price: '349.00',
          quantityAvailable: 8,
          quantitySold: 2,
          gallery: 'https://i.ebayimg.com/gallery-110001.jpg',
          pictures: [
            'https://i.ebayimg.com/pic-1.jpg',
            'https://i.ebayimg.com/pic-2.jpg'
          ]
        }),
        itemXml({ id: '110002', title: 'Sommerreifen Michelin', price: '89.5' })
      ])
    )

    const result = await importEbayListings({ transport })
    expect(result).toMatchObject({
      imported: 2,
      updated: 0,
      ended: 0,
      failed: 0,
      totalActive: 2
    })

    const rows = await db.select().from(ebayListings)
    expect(rows).toHaveLength(2)
    const first = rows.find((r) => r.ebayItemId === '110001')!
    // Entities decoded exactly once.
    expect(first.title).toBe('Winterreifen Continental 205/55 R16 & Felgen')
    expect(first.sku).toBe('WR-205-55-16')
    // pg-mem strips trailing zeros from numeric; compare numerically.
    expect(Number(first.priceValue)).toBe(349)
    expect(first.priceCurrency).toBe('EUR')
    expect(first.quantityAvailable).toBe(8)
    expect(first.quantitySold).toBe(2)
    expect(first.listingType).toBe('FixedPriceItem')
    expect(first.status).toBe('active')
    expect(first.viewItemUrl).toBe('https://www.ebay.de/itm/110001')
    expect(first.galleryUrl).toBe('https://i.ebayimg.com/gallery-110001.jpg')
    expect(first.pictureUrls).toEqual([
      'https://i.ebayimg.com/pic-1.jpg',
      'https://i.ebayimg.com/pic-2.jpg'
    ])
    expect(first.startTime?.toISOString()).toBe('2026-06-01T08:00:00.000Z')
    expect(first.endTime?.toISOString()).toBe('2026-09-01T08:00:00.000Z')
    expect(first.environment).toBe('production')

    // Auth header carries the IAF token; body asks for the active list.
    const call = (transport as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.url).toBe('https://api.ebay.com/ws/api.dll')
    expect(call.headers['X-EBAY-API-CALL-NAME']).toBe('GetMyeBaySelling')
    expect(call.headers['X-EBAY-API-IAF-TOKEN']).toBe(ACCESS_TOKEN)
    expect(call.headers['X-EBAY-API-SITEID']).toBe('77')
    expect(call.body).toContain('<ActiveList>')

    // Run log recorded as success.
    const runs = await db.select().from(ebayImportRuns)
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('success')
    expect(runs[0].imported).toBe(2)
    expect(runs[0].error).toBeNull()
  })

  it('follows Trading API pagination across pages', async () => {
    await seedConnection()
    const pages = [
      pageXml([itemXml({ id: '1', title: 'Reifen A' })], {
        totalPages: 2,
        totalEntries: 2
      }),
      pageXml([itemXml({ id: '2', title: 'Reifen B' })], {
        totalPages: 2,
        totalEntries: 2
      })
    ]
    const transport: EbayTradingTransport = vi.fn(async ({ body }) => {
      const page = Number(body.match(/<PageNumber>(\d+)<\/PageNumber>/)![1])
      return { status: 200, body: pages[page - 1] }
    })

    const result = await importEbayListings({ transport })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(result.imported).toBe(2)
    expect(result.totalActive).toBe(2)
  })
})

describe('importEbayListings — idempotency', () => {
  it('re-running updates rows in place instead of duplicating', async () => {
    await seedConnection()
    await importEbayListings({
      transport: okTransport(
        pageXml([itemXml({ id: '110001', title: 'Alt', price: '100.00' })])
      )
    })

    const second = await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({
            id: '110001',
            title: 'Neu',
            price: '90.00',
            quantityAvailable: 1
          })
        ])
      )
    })
    expect(second).toMatchObject({ imported: 0, updated: 1, ended: 0 })

    const rows = await db.select().from(ebayListings)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Neu')
    expect(Number(rows[0].priceValue)).toBe(90)
    expect(rows[0].quantityAvailable).toBe(1)
    expect(rows[0].status).toBe('active')
  })

  it('marks listings missing from the active list as ended (never deletes)', async () => {
    await seedConnection()
    await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({ id: '1', title: 'Bleibt' }),
          itemXml({ id: '2', title: 'Läuft aus' })
        ])
      )
    })

    const result = await importEbayListings({
      transport: okTransport(pageXml([itemXml({ id: '1', title: 'Bleibt' })]))
    })
    expect(result).toMatchObject({ imported: 0, updated: 1, ended: 1 })

    const rows = await db.select().from(ebayListings)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.ebayItemId === '2')!.status).toBe('ended')
    expect(rows.find((r) => r.ebayItemId === '1')!.status).toBe('active')

    // A re-appearing listing flips back to active.
    const third = await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({ id: '1', title: 'Bleibt' }),
          itemXml({ id: '2', title: 'Wieder da' })
        ])
      )
    })
    expect(third.ended).toBe(0)
    const revived = await db.select().from(ebayListings)
    expect(revived.find((r) => r.ebayItemId === '2')!.status).toBe('active')
  })

  it('skips unmappable items (missing ItemID) and counts them as failed', async () => {
    await seedConnection()
    const result = await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({ id: '1', title: 'Gut' }),
          '<Item><Title>Ohne ItemID</Title></Item>'
        ])
      )
    })
    expect(result.imported).toBe(1)
    expect(result.failed).toBe(1)
    const [run] = await db.select().from(ebayImportRuns)
    expect(run.failed).toBe(1)
  })
})

describe('importEbayListings — error mapping (curated German only)', () => {
  it('throws the not-connected hint when no account is linked', async () => {
    const transport = vi.fn()
    let caught: unknown
    try {
      await importEbayListings({ transport })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).status).toBe(409)
    expect(httpErrorOf(caught).body?.message).toBe(
      EBAY_IMPORT_ERRORS.notConnected
    )
    expect(transport).not.toHaveBeenCalled()
    // No run row is written before a token exists.
    expect(await db.select().from(ebayImportRuns)).toHaveLength(0)
  })

  it('maps a hard-expired token (ErrorCode 932) to the reconnect hint', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({ transport: okTransport(failureXml('932')) })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).status).toBe(409)
    expect(httpErrorOf(caught).body?.message).toBe(
      EBAY_IMPORT_ERRORS.tokenExpired
    )
    // The failed run is recorded with the curated message only.
    const [run] = await db.select().from(ebayImportRuns)
    expect(run.status).toBe('failed')
    expect(run.error).toBe(EBAY_IMPORT_ERRORS.tokenExpired)
    expect(run.error).not.toContain(ACCESS_TOKEN)
  })

  it('maps HTTP 401 to the reconnect hint', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({
        transport: vi.fn(async () => ({ status: 401, body: '' }))
      })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).body?.message).toBe(
      EBAY_IMPORT_ERRORS.tokenExpired
    )
  })

  it('maps other API failures (Ack=Failure) to the rejected message', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({ transport: okTransport(failureXml('10007')) })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).status).toBe(502)
    expect(httpErrorOf(caught).body?.message).toBe(EBAY_IMPORT_ERRORS.rejected)
  })

  it('maps HTTP 500 to the unreachable message', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({
        transport: vi.fn(async () => ({ status: 500, body: 'oops' }))
      })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).body?.message).toBe(
      EBAY_IMPORT_ERRORS.unreachable
    )
  })

  it('maps a network failure / timeout to the unreachable message', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({
        transport: vi.fn(async () => {
          throw new Error('fetch failed: ETIMEDOUT')
        })
      })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).body?.message).toBe(
      EBAY_IMPORT_ERRORS.unreachable
    )
    const [run] = await db.select().from(ebayImportRuns)
    expect(run.status).toBe('failed')
    expect(run.error).toBe(EBAY_IMPORT_ERRORS.unreachable)
  })

  it('maps a malformed (non-Trading-API) response to the malformed message', async () => {
    await seedConnection()
    let caught: unknown
    try {
      await importEbayListings({
        transport: okTransport('<html>totally not xml we expect</html>')
      })
    } catch (err) {
      caught = err
    }
    expect(httpErrorOf(caught).body?.message).toBe(EBAY_IMPORT_ERRORS.malformed)
  })
})

describe('listEbayListings / getEbayImportInfo', () => {
  it('paginates, searches and filters by status', async () => {
    await seedConnection()
    await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({ id: '1', title: 'Winterreifen Continental', sku: 'WR-1' }),
          itemXml({ id: '2', title: 'Sommerreifen Michelin', sku: 'SR-2' }),
          itemXml({ id: '3', title: 'Ganzjahresreifen Goodyear' })
        ])
      )
    })
    // End listing 3.
    await importEbayListings({
      transport: okTransport(
        pageXml([
          itemXml({ id: '1', title: 'Winterreifen Continental', sku: 'WR-1' }),
          itemXml({ id: '2', title: 'Sommerreifen Michelin', sku: 'SR-2' })
        ])
      )
    })

    const all = await listEbayListings({ page: 1, size: 25 })
    expect(all.total).toBe(3)
    expect(all.pageCount).toBe(1)
    // Active listings sort before ended ones.
    expect(all.items[all.items.length - 1].ebayItemId).toBe('3')

    const bySearch = await listEbayListings({ page: 1, size: 25, q: 'WR-1' })
    expect(bySearch.total).toBe(1)
    expect(bySearch.items[0].ebayItemId).toBe('1')

    const byItemId = await listEbayListings({ page: 1, size: 25, q: '2' })
    expect(byItemId.items.some((l) => l.ebayItemId === '2')).toBe(true)

    const ended = await listEbayListings({ page: 1, size: 25, status: 'ended' })
    expect(ended.total).toBe(1)
    expect(ended.items[0].ebayItemId).toBe('3')

    const paged = await listEbayListings({ page: 2, size: 25 })
    expect(paged.items).toHaveLength(0)
    expect(paged.page).toBe(2)
  })

  it('reports the last run and counts; never exposes token material', async () => {
    const empty = await getEbayImportInfo()
    expect(empty.lastRun).toBeNull()
    expect(empty.listingCount).toBe(0)

    await seedConnection()
    await importEbayListings({
      transport: okTransport(pageXml([itemXml({ id: '1', title: 'Reifen' })]))
    })
    const info = await getEbayImportInfo()
    expect(info.lastRun?.status).toBe('success')
    expect(info.lastRun?.imported).toBe(1)
    expect(info.listingCount).toBe(1)
    expect(info.activeCount).toBe(1)
    expect(JSON.stringify(info)).not.toContain(ACCESS_TOKEN)
    expect(JSON.stringify(info)).not.toContain('SECRET-REFRESH-TOKEN')
  })
})
