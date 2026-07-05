/**
 * eBay OAuth (Authorization Code Grant) — connect, token storage,
 * refresh. Facts verified against the official docs 2026-06 (see
 * docs/ebay-integration.md, Phase 1):
 *
 * - Consent URL: `https://auth.ebay.com/oauth2/authorize` with
 *   `redirect_uri=<RuName>` (the eBay-generated Redirect-URL *name*,
 *   not a URL). The accepted URL receives `code` (single-use, ~5 min)
 *   and our `state`.
 * - Exchange/refresh: `POST https://api.ebay.com/identity/v1/oauth2/token`
 *   with `Authorization: Basic base64(client_id:cert_id)` and a
 *   form-urlencoded body. Access token ≈ 2 h; refresh token ≈ 18
 *   months and is NOT rotated on refresh.
 * - Scope `sell.inventory` covers the whole Inventory API surface;
 *   `commerce.identity.readonly` lets us label the connection with the
 *   seller's username.
 *
 * Tokens are stored AES-256-GCM-encrypted via `$lib/server/crypto`.
 * Single-row semantics: connecting replaces any existing connection.
 *
 * CSRF protection for the redirect round-trip: `state` is a
 * self-contained HMAC-signed value (`<ts>.<nonce>.<sig>`, APP_SECRET
 * key, 10-minute TTL) — no server-side session storage needed.
 *
 * @group integration
 * @module ebay
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db/client'
import { ebayCredentials, type EbayCredentials } from '$lib/server/db/schema'
import { encryptSecret, decryptSecret } from '$lib/server/crypto'

const readEnv = (key: string): string | undefined =>
  process.env[key] ?? env[key]

/* ── Environment / configuration ─────────────────────────────────── */

export type EbayEnvironment = 'production' | 'sandbox'

export const ebayEnvironment = (): EbayEnvironment =>
  readEnv('EBAY_ENV') === 'sandbox' ? 'sandbox' : 'production'

const AUTH_HOST: Record<EbayEnvironment, string> = {
  production: 'https://auth.ebay.com',
  sandbox: 'https://auth.sandbox.ebay.com'
}
const API_HOST: Record<EbayEnvironment, string> = {
  production: 'https://api.ebay.com',
  sandbox: 'https://api.sandbox.ebay.com'
}
/** Identity API lives on the `apiz` subdomain. */
const APIZ_HOST: Record<EbayEnvironment, string> = {
  production: 'https://apiz.ebay.com',
  sandbox: 'https://apiz.sandbox.ebay.com'
}

export const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
].join(' ')

type EbayConfig = { clientId: string; certId: string; ruName: string }

/** Env keys still missing for OAuth — empty array means ready. */
export function missingEbayConfig(): string[] {
  return (['EBAY_CLIENT_ID', 'EBAY_CERT_ID', 'EBAY_RU_NAME'] as const).filter(
    (k) => !readEnv(k)?.trim()
  )
}

function requireConfig(): EbayConfig {
  const missing = missingEbayConfig()
  if (missing.length > 0) {
    throw new Error(
      `eBay ist nicht konfiguriert — fehlende Umgebungsvariablen: ${missing.join(', ')}.`
    )
  }
  return {
    clientId: readEnv('EBAY_CLIENT_ID')!.trim(),
    certId: readEnv('EBAY_CERT_ID')!.trim(),
    ruName: readEnv('EBAY_RU_NAME')!.trim()
  }
}

/* ── CSRF state (HMAC-signed, stateless) ─────────────────────────── */

const STATE_TTL_MS = 10 * 60 * 1000

function stateKey(): Buffer {
  const secret = readEnv('APP_SECRET')
  if (!secret) throw new Error('APP_SECRET ist nicht gesetzt.')
  return Buffer.from(secret)
}

const signPayload = (payload: string): string =>
  createHmac('sha256', stateKey()).update(payload).digest('hex')

export function createOauthState(now = Date.now()): string {
  const payload = `${now}.${randomBytes(16).toString('hex')}`
  return `${payload}.${signPayload(payload)}`
}

export function verifyOauthState(state: string, now = Date.now()): boolean {
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [tsRaw, nonce, sig] = parts
  const expected = signPayload(`${tsRaw}.${nonce}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const ts = Number(tsRaw)
  return Number.isFinite(ts) && now - ts >= 0 && now - ts <= STATE_TTL_MS
}

/* ── Consent URL ─────────────────────────────────────────────────── */

/** Build the eBay consent URL the operator's browser is sent to. */
export function buildAuthorizeUrl(): { url: string; state: string } {
  const cfg = requireConfig()
  const state = createOauthState()
  const u = new URL(`${AUTH_HOST[ebayEnvironment()]}/oauth2/authorize`)
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', cfg.ruName)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', EBAY_SCOPES)
  u.searchParams.set('state', state)
  u.searchParams.set('locale', 'de-DE')
  return { url: u.toString(), state }
}

/* ── Token endpoint plumbing ─────────────────────────────────────── */

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  token_type: string
}

async function callTokenEndpoint(
  body: URLSearchParams
): Promise<TokenResponse> {
  const cfg = requireConfig()
  const basic = Buffer.from(`${cfg.clientId}:${cfg.certId}`).toString('base64')
  const res = await fetch(
    `${API_HOST[ebayEnvironment()]}/identity/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`
      },
      body: body.toString()
    }
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `eBay-Token-Endpunkt antwortete mit ${res.status}: ${detail.slice(0, 300)}`
    )
  }
  return (await res.json()) as TokenResponse
}

/** Best-effort seller username via the Identity API. Never throws. */
async function fetchEbayUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${APIZ_HOST[ebayEnvironment()]}/commerce/identity/v1/user/`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { username?: string }
    return data.username ?? null
  } catch {
    return null
  }
}

/* ── Connect / refresh / status ──────────────────────────────────── */

/**
 * Exchange the one-time authorization code and persist the connection
 * (replacing any existing one). Returns the stored row's public shape.
 */
export async function exchangeAuthCode(code: string): Promise<void> {
  const cfg = requireConfig()
  const now = Date.now()
  const tokens = await callTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      // eBay delivers the code URL-encoded; SvelteKit's searchParams
      // already decoded it, URLSearchParams re-encodes exactly once.
      code,
      redirect_uri: cfg.ruName
    })
  )
  if (!tokens.refresh_token) {
    throw new Error('eBay lieferte keinen Refresh-Token.')
  }

  const username = await fetchEbayUsername(tokens.access_token)

  // Single-row semantics: replace whatever connection existed.
  await db.delete(ebayCredentials)
  await db
    .insert(ebayCredentials)
    .values({
      ebayUsername: username,
      accessToken: encryptSecret(tokens.access_token),
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshToken: encryptSecret(tokens.refresh_token),
      refreshTokenExpiresAt: tokens.refresh_token_expires_in
        ? new Date(now + tokens.refresh_token_expires_in * 1000)
        : null,
      scopes: EBAY_SCOPES,
      environment: ebayEnvironment()
    })
}

async function loadRow(): Promise<EbayCredentials | null> {
  const [row] = await db.select().from(ebayCredentials).limit(1)
  return row ?? null
}

/**
 * Return a currently valid access token, refreshing it via the stored
 * refresh token when expired (60 s clock-skew safety margin). This is
 * the single entry point every later eBay API call goes through.
 */
export async function getValidAccessToken(): Promise<string> {
  const row = await loadRow()
  if (!row) {
    throw new Error(
      'Kein eBay-Konto verbunden. Bitte unter Einstellungen → eBay verbinden.'
    )
  }
  const skewMs = 60_000
  if (
    row.accessToken &&
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() - skewMs > Date.now()
  ) {
    return decryptSecret(row.accessToken)
  }

  // Expired (or missing) — refresh. eBay does not rotate the refresh
  // token, so only the access-token columns change.
  const tokens = await callTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptSecret(row.refreshToken)
    })
  )
  await db
    .update(ebayCredentials)
    .set({
      accessToken: encryptSecret(tokens.access_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date()
    })
    .where(eq(ebayCredentials.id, row.id))
  return tokens.access_token
}

export type EbayConnectionStatus = {
  configured: boolean
  missingConfig: string[]
  environment: EbayEnvironment
  connected: boolean
  ebayUsername: string | null
  connectedAt: Date | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
}

/** Connection status for the settings UI — never exposes token material. */
export async function getConnectionStatus(): Promise<EbayConnectionStatus> {
  const row = await loadRow()
  return {
    configured: missingEbayConfig().length === 0,
    missingConfig: missingEbayConfig(),
    environment: ebayEnvironment(),
    connected: row != null,
    ebayUsername: row?.ebayUsername ?? null,
    connectedAt: row?.connectedAt ?? null,
    accessTokenExpiresAt: row?.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: row?.refreshTokenExpiresAt ?? null
  }
}

/**
 * Drop the stored connection. eBay offers no server-side revocation
 * endpoint for user tokens — the seller can additionally revoke the
 * app's access from their eBay account settings.
 */
export async function disconnectEbay(): Promise<void> {
  await db.delete(ebayCredentials)
}
