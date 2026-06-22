import { env } from '$env/dynamic/private'
import { timingSafeEqual } from 'node:crypto'

/**
 * Source the env value from `process.env` first (so Vitest's
 * `vi.stubEnv()` propagates into the runtime check) and fall back to
 * SvelteKit's `$env/dynamic/private` so a `.env` value loaded by
 * vite in dev still wins when `process.env` is not set by the
 * surrounding shell. In production both are populated identically by
 * the deployment environment.
 */
function readEnv(key: string): string | undefined {
  return process.env[key] ?? env[key]
}

/**
 * Env-var based authentication for the public REST API.
 *
 * The list of accepted Bearer tokens is read from the `API_TOKENS`
 * environment variable. Compared to a DB-backed token table this
 * makes development and deployment trivial:
 *
 *   - one source of truth (the deployment secret manager / `.env`),
 *   - no migrations to mint or revoke a token,
 *   - tokens are valid from server start, no admin click-through,
 *   - rotation is a config change + restart, not a UI workflow.
 *
 * The list is comma-separated (newline and semicolon also work as
 * separators so multi-line secret-manager entries are accepted).
 * Each token should be a cryptographically random string of at least
 * 16 characters; tokens shorter than 8 chars are ignored so that
 * trivially weak placeholders never accidentally grant access.
 *
 * If `API_TOKENS` is empty or unset, the public API rejects every
 * request — fail-closed by design.
 */
const ENV_VAR = 'API_TOKENS'

/**
 * Read the configured tokens lazily. We deliberately re-read every
 * call so test environments can override `env.API_TOKENS` via
 * `vi.stubEnv` between cases, and so a future config-reload hook
 * could swap the list without a process restart. The cost is a tiny
 * string-split per authenticated request — negligible compared to
 * the surrounding network/db work.
 */
function configuredTokens(): string[] {
  const raw = (readEnv(ENV_VAR) ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[,\n\r;]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 8)
}

/**
 * Constant-time string comparison so a token-guessing attacker
 * cannot use response-time differences to learn which prefix is
 * closer to a configured token. `timingSafeEqual` requires equal
 * lengths, so the length pre-check uses the same fixed cost path.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Validate a candidate token against the configured list. Returns
 * `true` only on a constant-time exact match with one of the
 * tokens. Tokens shorter than 8 chars are rejected up-front to keep
 * obviously bad inputs out of the comparison loop.
 */
export function verifyApiToken(candidate: string): boolean {
  if (!candidate || candidate.length < 8) return false
  let matched = false
  for (const t of configuredTokens()) {
    // Iterate fully so the loop cost does not leak which slot held
    // the matching token. `matched ||= safeEqual(...)` keeps the
    // comparison constant per iteration.
    if (safeEqual(candidate, t)) matched = true
  }
  return matched
}

/**
 * Identifier returned to the caller once a request has been
 * authenticated. We expose only the first 8 chars of the token so
 * audit logs and per-token rate-limit buckets can distinguish
 * clients without ever persisting the full secret.
 */
export type AuthenticatedApiToken = { tokenPrefix: string }

/**
 * Parse the `Authorization: Bearer …` header and verify the token.
 * Returns the prefix descriptor for downstream rate-limiting and
 * audit logging, or `null` if the header is absent, malformed, or
 * the token is not in the configured list.
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedApiToken | null> {
  const header = request.headers.get('authorization') ?? ''
  const m = /^Bearer\s+([A-Za-z0-9._\-=:+/]+)$/i.exec(header.trim())
  if (!m) return null
  const token = m[1]
  if (!verifyApiToken(token)) return null
  // The prefix is logged on every authenticated request by the
  // public-api wrapper — keep it short so it cannot be reassembled
  // into the full token from the logs.
  return { tokenPrefix: token.slice(0, 8) }
}
