/**
 * Which paths may be reached without a session, and which parts of the
 * authentication library are exposed at all.
 *
 * Two separate questions, both decided here rather than in the middleware, so
 * both can be tested without a request.
 */

/**
 * Prefixes under `/api/` that carry their own authentication or need none.
 *
 * Everything else under `/api/` requires a session — as a second line of
 * defence behind the guard each endpoint starts with. The predecessor had only
 * the guards: one forgotten `requirePermission` was open data access (B-041).
 */
/**
 * Paths under `/api/` that carry their own authentication or need none.
 *
 * Everything else under `/api/` requires a session — as a second line of
 * defence behind the guard each endpoint starts with. The predecessor had only
 * the guards: one forgotten `requirePermission` was open data access (B-041).
 */
const PUBLIC_API_EXACT = [
  '/api/ebay/account-deletion', // eBay calls this directly, unauthenticated
  '/api/health', // liveness check for the container
  // Answers the anonymous case itself, with an empty state. The login page has
  // to render before there is a session, and it cannot know in advance whether
  // there is one.
  '/api/me',
] as const

const PUBLIC_API_PREFIXES = [
  '/api/auth', // the library's own endpoints, filtered below
  '/api/public', // bearer-token REST interface, guards itself
] as const

/** Paths that are served before any session exists. */
const PUBLIC_PAGE_EXACT = ['/login', '/setup', '/favicon.ico', '/robots.txt'] as const

const PUBLIC_PAGE_PREFIXES = ['/login', '/setup', '/_nuxt', '/__nuxt', '/_ipx'] as const

/**
 * Whether a request path may be answered without a session.
 *
 * A prefix has to end at a segment boundary. Matching on the bare string would
 * make `/api/healthy-profits` public because `/api/health` is public — the
 * kind of hole that is invisible until somebody names an endpoint badly.
 */
export function isPublicPath(path: string): boolean {
  const clean = path.split('?')[0] ?? path

  if (PUBLIC_API_EXACT.includes(clean as typeof PUBLIC_API_EXACT[number])) return true
  if (PUBLIC_PAGE_EXACT.includes(clean as typeof PUBLIC_PAGE_EXACT[number])) return true

  const under = (prefix: string) => clean === prefix || clean.startsWith(`${prefix}/`)
  return PUBLIC_API_PREFIXES.some(under) || PUBLIC_PAGE_PREFIXES.some(under)
}

/**
 * Paths for which looking the session up would be wasted work.
 *
 * Not the same question as `isPublicPath`. `/api/me` needs no session but must
 * report one when it exists — the interface asks it exactly to find out. Only
 * static assets and the library's own endpoints, which read the cookie
 * themselves, are skipped.
 */
export function skipsSessionLookup(path: string): boolean {
  const clean = path.split('?')[0] ?? path
  const under = (prefix: string) => clean === prefix || clean.startsWith(`${prefix}/`)
  return under('/api/auth')
    || ['/_nuxt', '/__nuxt', '/_ipx'].some(under)
    || clean === '/favicon.ico'
    || clean === '/robots.txt'
}

/** Whether the path belongs to the application's own API. */
export function isApiPath(path: string): boolean {
  return (path.split('?')[0] ?? path).startsWith('/api/')
}

/**
 * The **only** endpoints of the authentication library this application
 * exposes.
 *
 * An allow list, not a block list. The library's catch-all otherwise publishes
 * everything it happens to implement: the predecessor unintentionally offered
 * `update-user`, which let a signed-in person change their own user name
 * against the stated rule, and `is-username-available`, which answered without
 * a session and so let anyone test which logins exist (B-051, B-052). A future
 * version of the library can add endpoints; with an allow list they stay shut.
 */
const EXPOSED_AUTH_ENDPOINTS = [
  '/sign-in/username',
  '/sign-out',
  '/get-session',
  '/change-password',
] as const

/**
 * The part after `/api/auth`, e.g. `/sign-in/username`.
 *
 * Tolerates a path that already had the prefix removed, because an h3
 * application mounted with a prefix strips it before the handler sees it.
 */
export function authEndpointOf(path: string): string {
  const clean = path.split('?')[0] ?? path
  const endpoint = clean.startsWith('/api/auth') ? clean.slice('/api/auth'.length) : clean
  return endpoint || '/'
}

/** Whether this endpoint of the authentication library is exposed. */
export function isExposedAuthEndpoint(path: string): boolean {
  const endpoint = authEndpointOf(path)
  return EXPOSED_AUTH_ENDPOINTS.some(allowed => endpoint === allowed)
}

/** For the documentation page. */
export const exposedAuthEndpoints = (): readonly string[] => EXPOSED_AUTH_ENDPOINTS
