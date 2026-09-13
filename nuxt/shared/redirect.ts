/**
 * Where the login may send someone afterwards.
 *
 * The predecessor checked `startsWith('/')` and rejected a leading `//`. That
 * is not enough: browsers follow the WHATWG URL rules, where a **backslash is
 * a slash**, so `/\evil.example` is read as `//evil.example` — a different
 * host. A successful login would have handed the visitor to a phishing page
 * (B-002, B-056).
 *
 * Nothing is patched up here. A target is either an unambiguous path inside
 * this application, or it is discarded.
 */

/** The path used when the requested target is missing or not ours. */
export const DEFAULT_REDIRECT = '/'

/**
 * Backslashes, whitespace and control characters — none belong in a path this
 * application produced, and each of them changes how a browser reads the rest.
 */
function hasForbiddenCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (character === '\\' || code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Returns the target if it stays inside this application, otherwise the
 * fallback.
 *
 * Accepted: `/customers`, `/customers?page=2`, `/customers#top`.
 * Rejected: everything else — absolute URLs, protocol-relative `//host`,
 * backslash variants, `javascript:`, control characters, and anything that
 * does not start with a single slash.
 */
export function safeRedirectTarget(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (typeof raw !== 'string' || raw === '') return fallback

  // Percent-encoding can hide a second slash: `/%2fevil.example`.
  let target: string
  try {
    target = decodeURIComponent(raw)
  }
  catch {
    return fallback
  }

  if (hasForbiddenCharacter(target)) return fallback
  if (!target.startsWith('/')) return fallback
  if (target.startsWith('//')) return fallback

  // Last line of defence: parse it the way the browser will. If the result
  // leaves our origin, it was never ours.
  try {
    const base = 'https://twincars.invalid'
    const url = new URL(target, base)
    if (url.origin !== base) return fallback
    return url.pathname + url.search + url.hash
  }
  catch {
    return fallback
  }
}

/** Builds `/login?redirectTo=…`, leaving out the parameter for the start page. */
export function loginPathFor(target: string | null | undefined): string {
  const safe = safeRedirectTarget(target)
  if (safe === DEFAULT_REDIRECT) return '/login'
  return `/login?redirectTo=${encodeURIComponent(safe)}`
}
