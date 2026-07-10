/**
 * eBay listing import (integration Phase 2, see ADR-014 and
 * docs/integrations/ebay.md).
 *
 * Pulls the seller account's **active listings** via the Trading API
 * (`GetMyeBaySelling`) — listings created in the eBay web UI are NOT
 * visible to the Inventory API, so the Trading API is the only way to
 * read them. Auth is the OAuth user token from `ebay-auth-service`
 * sent in the `X-EBAY-API-IAF-TOKEN` header (no extra scopes).
 *
 * Import semantics (idempotent):
 *   - keyed on `(environment, ebay_item_id)` — re-running refreshes
 *     existing rows instead of duplicating them,
 *   - listings that disappeared from the active list are flipped to
 *     `status = 'ended'` (never deleted),
 *   - photos are stored **by URL only** (eBay-hosted),
 *   - every run writes one `ebay_import_runs` row (append-only) that
 *     backs the "last sync" info on `/settings/ebay`.
 *
 * The HTTP layer is injectable (`EbayTradingTransport`) so tests mock
 * it without touching global `fetch`. All user-facing failures throw
 * SvelteKit `error(status, german)`; raw eBay payloads/errors are
 * logged server-side only and NEVER contain token material.
 *
 * @group integration
 * @module ebay
 */
import { error, isHttpError } from '@sveltejs/kit'
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  ebayImportRuns,
  ebayListings,
  type EbayImportRun,
  type EbayListing
} from '$lib/server/db/schema'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import {
  ebayEnvironment,
  getValidAccessToken,
  type EbayEnvironment
} from '$lib/server/services/ebay-auth-service'

/* ── Curated German errors (the only messages users ever see) ────── */

export const EBAY_IMPORT_ERRORS = {
  notConnected:
    'Kein eBay-Konto verbunden. Bitte zuerst unter Einstellungen → eBay verbinden.',
  tokenExpired:
    'Die eBay-Anmeldung ist abgelaufen oder wurde widerrufen. Bitte die eBay-Verbindung trennen und neu verbinden.',
  refreshFailed:
    'Die eBay-Anmeldung konnte nicht erneuert werden. Bitte die eBay-Verbindung trennen und neu verbinden.',
  unreachable:
    'eBay ist derzeit nicht erreichbar. Bitte später erneut versuchen.',
  rejected: 'eBay hat die Anfrage abgelehnt. Bitte später erneut versuchen.',
  malformed:
    'Die Antwort von eBay konnte nicht verarbeitet werden. Bitte später erneut versuchen.'
} as const

/* ── Injectable Trading API transport ────────────────────────────── */

export type EbayTradingRequest = {
  url: string
  headers: Record<string, string>
  body: string
}

export type EbayTradingResponse = { status: number; body: string }

/** Narrow HTTP seam — tests provide a mock, production uses fetch. */
export type EbayTradingTransport = (
  req: EbayTradingRequest
) => Promise<EbayTradingResponse>

const TRADING_URL: Record<EbayEnvironment, string> = {
  production: 'https://api.ebay.com/ws/api.dll',
  sandbox: 'https://api.sandbox.ebay.com/ws/api.dll'
}

/** Trading API schema version (stable, 2024+). */
const COMPATIBILITY_LEVEL = '1193'
/** eBay site id 77 = Germany (ebay.de). */
const SITE_ID = '77'
const REQUEST_TIMEOUT_MS = 30_000
/** Hard cap so a runaway pagination loop can never spin forever. */
const MAX_PAGES = 50
const ENTRIES_PER_PAGE = 200

const defaultTransport: EbayTradingTransport = async ({
  url,
  headers,
  body
}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  return { status: res.status, body: await res.text() }
}

/* ── Minimal XML helpers (no XML dependency in the project) ──────── */

const decodeXmlEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** First `<tag>…</tag>` inner text (entity-decoded, trimmed) or null. */
function textOf(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return m ? decodeXmlEntities(m[1].trim()) : null
}

/**
 * First `<tag>…</tag>` inner content WITHOUT entity decoding — for
 * container blocks whose children are parsed individually (decoding a
 * container first would double-decode leaf values).
 */
function blockOf(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return m ? m[1] : null
}

/** All `<tag>…</tag>` inner texts. */
function allTextsOf(xml: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
  for (const m of xml.matchAll(re)) out.push(decodeXmlEntities(m[1].trim()))
  return out
}

/** Attribute value of the first `<tag attr="…">` occurrence. */
function attrOf(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*>`))
  return m ? decodeXmlEntities(m[1]) : null
}

const toInt = (raw: string | null): number | null => {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

const toMoney = (raw: string | null): string | null => {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n.toFixed(2) : null
}

const toDate = (raw: string | null): Date | null => {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d : null
}

/* ── Request building / response classification ──────────────────── */

function buildActiveListRequest(pageNumber: number): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    '  <ActiveList>',
    '    <Include>true</Include>',
    '    <Pagination>',
    `      <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>`,
    `      <PageNumber>${pageNumber}</PageNumber>`,
    '    </Pagination>',
    '  </ActiveList>',
    '</GetMyeBaySellingRequest>'
  ].join('\n')
}

/**
 * Trading API error codes signalling an invalid/expired/revoked user
 * token — mapped to the curated "reconnect" hint.
 */
const TOKEN_ERROR_CODES = new Set(['931', '932', '17470', '21916984'])

type ParsedItem = {
  ebayItemId: string
  sku: string | null
  title: string
  priceValue: string | null
  priceCurrency: string | null
  quantityAvailable: number | null
  quantitySold: number | null
  listingType: string | null
  viewItemUrl: string | null
  galleryUrl: string | null
  pictureUrls: string[]
  startTime: Date | null
  endTime: Date | null
}

type ParsedPage = {
  items: ParsedItem[]
  skipped: number
  totalPages: number
  totalEntries: number
}

/** Map one `<Item>` block; returns null when unmappable. */
function parseItem(block: string): ParsedItem | null {
  const ebayItemId = textOf(block, 'ItemID')
  const title = textOf(block, 'Title')
  if (!ebayItemId || !title) return null
  return {
    ebayItemId,
    sku: textOf(block, 'SKU'),
    title: title.slice(0, 255),
    priceValue: toMoney(textOf(block, 'CurrentPrice')),
    priceCurrency: attrOf(block, 'CurrentPrice', 'currencyID'),
    quantityAvailable:
      toInt(textOf(block, 'QuantityAvailable')) ??
      toInt(textOf(block, 'Quantity')),
    quantitySold: toInt(textOf(block, 'QuantitySold')),
    listingType: textOf(block, 'ListingType'),
    viewItemUrl: textOf(block, 'ViewItemURL'),
    galleryUrl: textOf(block, 'GalleryURL'),
    pictureUrls: allTextsOf(block, 'PictureURL'),
    startTime: toDate(textOf(block, 'StartTime')),
    endTime: toDate(textOf(block, 'EndTime'))
  }
}

/**
 * Classify + parse one GetMyeBaySelling response page. Throws curated
 * `error(...)` for every failure class; raw payload details go to the
 * server log only.
 */
function parseActiveListResponse(res: EbayTradingResponse): ParsedPage {
  if (res.status === 401) {
    console.error('[ebay-import] Trading API returned HTTP 401')
    error(409, EBAY_IMPORT_ERRORS.tokenExpired)
  }
  if (res.status !== 200) {
    console.error(
      `[ebay-import] Trading API returned HTTP ${res.status}:`,
      res.body.slice(0, 500)
    )
    error(502, EBAY_IMPORT_ERRORS.unreachable)
  }
  if (!res.body.includes('<GetMyeBaySellingResponse')) {
    console.error(
      '[ebay-import] unexpected Trading API payload:',
      res.body.slice(0, 500)
    )
    error(502, EBAY_IMPORT_ERRORS.malformed)
  }

  const ack = textOf(res.body, 'Ack')
  if (ack !== 'Success' && ack !== 'Warning') {
    const codes = allTextsOf(res.body, 'ErrorCode')
    console.error(
      '[ebay-import] Trading API Ack=Failure, codes:',
      codes.join(', ') || '(none)',
      '-',
      allTextsOf(res.body, 'LongMessage').join(' | ').slice(0, 500)
    )
    if (codes.some((c) => TOKEN_ERROR_CODES.has(c))) {
      error(409, EBAY_IMPORT_ERRORS.tokenExpired)
    }
    error(502, EBAY_IMPORT_ERRORS.rejected)
  }

  // The ActiveList block carries the item array + pagination result.
  // Extracted RAW (no entity decoding) — leaf values decode in
  // `parseItem`, decoding twice would corrupt titles like "A &amp; B".
  const activeList = blockOf(res.body, 'ActiveList') ?? ''
  const items: ParsedItem[] = []
  let skipped = 0
  for (const m of activeList.matchAll(
    /<Item(?:\s[^>]*)?>([\s\S]*?)<\/Item>/g
  )) {
    const parsed = parseItem(m[1])
    if (parsed) items.push(parsed)
    else skipped++
  }
  return {
    items,
    skipped,
    totalPages: toInt(textOf(activeList, 'TotalNumberOfPages')) ?? 1,
    totalEntries: toInt(textOf(activeList, 'TotalNumberOfEntries')) ?? 0
  }
}

/* ── Token acquisition with curated mapping ──────────────────────── */

async function requireAccessToken(): Promise<string> {
  try {
    return await getValidAccessToken()
  } catch (err) {
    if (isHttpError(err)) throw err
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.startsWith('Kein eBay-Konto')) {
      error(409, EBAY_IMPORT_ERRORS.notConnected)
    }
    // Refresh-grant failure — the auth service's message may embed the
    // raw eBay response; log it, surface only the curated hint.
    console.error('[ebay-import] token refresh failed:', msg.slice(0, 300))
    error(502, EBAY_IMPORT_ERRORS.refreshFailed)
  }
}

/* ── Import ──────────────────────────────────────────────────────── */

export type EbayImportResult = {
  runId: string
  imported: number
  updated: number
  ended: number
  failed: number
  totalActive: number
}

/**
 * Fetch all active listings of the connected account and upsert them
 * into `ebay_listings` (idempotent, see module docs). Operator- or
 * cron-triggered — there is no in-process scheduler (ADR-009).
 */
export async function importEbayListings(
  opts: { transport?: EbayTradingTransport } = {}
): Promise<EbayImportResult> {
  const transport = opts.transport ?? defaultTransport
  const environment = ebayEnvironment()
  const accessToken = await requireAccessToken()

  const [run] = await db
    .insert(ebayImportRuns)
    .values({ environment })
    .returning()

  try {
    // 1. Fetch every active-list page.
    const items: ParsedItem[] = []
    let failed = 0
    let totalActive = 0
    let page = 1
    for (;;) {
      const res = await transport({
        url: TRADING_URL[environment],
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-COMPATIBILITY-LEVEL': COMPATIBILITY_LEVEL,
          'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
          'X-EBAY-API-SITEID': SITE_ID,
          'X-EBAY-API-IAF-TOKEN': accessToken
        },
        body: buildActiveListRequest(page)
      }).catch((err) => {
        // Network failure / timeout — never leaks token material.
        console.error(
          '[ebay-import] transport failed:',
          err instanceof Error ? err.message : String(err)
        )
        error(502, EBAY_IMPORT_ERRORS.unreachable)
      })
      const parsed = parseActiveListResponse(res)
      items.push(...parsed.items)
      failed += parsed.skipped
      totalActive = parsed.totalEntries || parsed.items.length
      if (page >= parsed.totalPages || page >= MAX_PAGES) break
      page++
    }

    // 2. Idempotent upsert keyed on (environment, ebay_item_id).
    const existing = await db
      .select()
      .from(ebayListings)
      .where(eq(ebayListings.environment, environment))
    const byItemId = new Map(existing.map((r) => [r.ebayItemId, r]))
    const now = new Date()
    let imported = 0
    let updated = 0
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.ebayItemId)) continue // defensive de-dupe
      seen.add(item.ebayItemId)
      const prior = byItemId.get(item.ebayItemId)
      if (prior) {
        await db
          .update(ebayListings)
          .set({
            sku: item.sku,
            title: item.title,
            priceValue: item.priceValue,
            priceCurrency: item.priceCurrency,
            quantityAvailable: item.quantityAvailable,
            quantitySold: item.quantitySold,
            listingType: item.listingType,
            status: 'active',
            viewItemUrl: item.viewItemUrl,
            galleryUrl: item.galleryUrl,
            pictureUrls: item.pictureUrls,
            startTime: item.startTime,
            endTime: item.endTime,
            lastSeenAt: now,
            updatedAt: now
          })
          .where(eq(ebayListings.id, prior.id))
        updated++
      } else {
        await db
          .insert(ebayListings)
          .values({
            ebayItemId: item.ebayItemId,
            sku: item.sku,
            title: item.title,
            priceValue: item.priceValue,
            priceCurrency: item.priceCurrency,
            quantityAvailable: item.quantityAvailable,
            quantitySold: item.quantitySold,
            listingType: item.listingType,
            status: 'active',
            viewItemUrl: item.viewItemUrl,
            galleryUrl: item.galleryUrl,
            pictureUrls: item.pictureUrls,
            startTime: item.startTime,
            endTime: item.endTime,
            environment
          })
        imported++
      }
    }

    // 3. Previously active listings not in the fetched set → ended.
    const goneIds = existing
      .filter((r) => r.status === 'active' && !seen.has(r.ebayItemId))
      .map((r) => r.id)
    if (goneIds.length > 0) {
      await db
        .update(ebayListings)
        .set({ status: 'ended', lastSeenAt: now, updatedAt: now })
        .where(inArray(ebayListings.id, goneIds))
    }

    const result: EbayImportResult = {
      runId: run.id,
      imported,
      updated,
      ended: goneIds.length,
      failed,
      totalActive
    }
    await db
      .update(ebayImportRuns)
      .set({
        finishedAt: new Date(),
        status: 'success',
        imported,
        updated,
        ended: goneIds.length,
        failed,
        totalActive
      })
      .where(eq(ebayImportRuns.id, run.id))
    return result
  } catch (err) {
    // Record the failed run with the CURATED message only.
    const message = isHttpError(err)
      ? err.body.message
      : 'Der Import ist unerwartet fehlgeschlagen.'
    await db
      .update(ebayImportRuns)
      .set({ finishedAt: new Date(), status: 'failed', error: message })
      .where(eq(ebayImportRuns.id, run.id))
    throw err
  }
}

/* ── Reads for the settings UI ───────────────────────────────────── */

export type EbayListingFilters = { status?: 'active' | 'ended' }

/**
 * Paginated imported listings of the current environment. Search
 * matches title, SKU and the eBay item id.
 */
export async function listEbayListings(
  params: ListParams & EbayListingFilters
): Promise<ListResult<EbayListing>> {
  const { page, size, q, status } = params
  const offset = (page - 1) * size
  const filters = [eq(ebayListings.environment, ebayEnvironment())]
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(ebayListings.title, term),
        ilike(ebayListings.sku, term),
        ilike(ebayListings.ebayItemId, term)
      )!
    )
  }
  if (status) filters.push(eq(ebayListings.status, status))
  const where = and(...filters)

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(ebayListings)
      .where(where)
      .orderBy(asc(ebayListings.status), asc(ebayListings.title))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(ebayListings).where(where)
  ])
  return { items, total, page, size, pageCount: Math.ceil(total / size) }
}

export type EbayImportInfo = {
  lastRun: EbayImportRun | null
  listingCount: number
  activeCount: number
}

/** Last import run + listing counts for the settings card. */
export async function getEbayImportInfo(): Promise<EbayImportInfo> {
  const environment = ebayEnvironment()
  const [lastRun] = await db
    .select()
    .from(ebayImportRuns)
    .where(eq(ebayImportRuns.environment, environment))
    .orderBy(desc(ebayImportRuns.startedAt))
    .limit(1)
  const [{ value: listingCount }] = await db
    .select({ value: count() })
    .from(ebayListings)
    .where(eq(ebayListings.environment, environment))
  const [{ value: activeCount }] = await db
    .select({ value: count() })
    .from(ebayListings)
    .where(
      and(
        eq(ebayListings.environment, environment),
        eq(ebayListings.status, 'active')
      )
    )
  return { lastRun: lastRun ?? null, listingCount, activeCount }
}
