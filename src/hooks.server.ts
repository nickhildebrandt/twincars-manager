import type {
  Handle,
  HandleServerError,
  HandleValidationError,
  RequestEvent
} from '@sveltejs/kit'
import { json, redirect } from '@sveltejs/kit'
import { building } from '$app/environment'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { auth } from '$lib/server/auth'
import { loadUserPermissions } from '$lib/server/auth-permissions'
import { isUserActive, isUsernameDeactivated } from '$lib/server/auth-users'
import { seedDefaults } from '$lib/server/db/seed-defaults'
import { rateLimit } from '$lib/server/rate-limit'

/** Sign-in attempts per IP per minute before further attempts are denied. */
const SIGNIN_RATE_PER_MINUTE = 10

/**
 * Public-API overload shield: steady-state requests per caller per
 * minute plus a burst allowance. Generous enough for a website that
 * renders car listings and booking slots, tight enough that a runaway
 * client or scraper cannot saturate the single-replica container.
 */
const PUBLIC_API_RATE_PER_MINUTE = 120
const PUBLIC_API_BURST = 60

/**
 * Schema migrations are NOT run here. Production runs `node
 * scripts/migrate.js` once before the server boots (see
 * `Dockerfile` CMD) — by the time the SvelteKit handler accepts a
 * request, the database is already at the target schema.
 *
 * What stays at runtime is `seedDefaults()`: an idempotent insert of
 * default rows (mail templates, ledger categories, number ranges)
 * that is content, not schema. Running it on the first request keeps
 * dev `npm run dev` self-contained without forcing a separate seed
 * step in the dev workflow. In production it's a no-op after the
 * first hit.
 */
let seeded = false
let seedPromise: Promise<void> | null = null

const ensureSeeded = () => {
  if (seeded) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedDefaults()
      seeded = true
    })()
  }
  return seedPromise
}

/**
 * Routes that are always allowed without an authenticated session:
 * the login page itself, the better-auth catch-all, the first-run
 * setup wizard (the admin creates the very first user there), and
 * any static asset / public API namespace.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth',
  '/api/public',
  // eBay compliance endpoint — eBay's servers call it directly
  // (challenge handshake + account-deletion notifications). Narrow on
  // purpose: only this one path, not a whole /api/ebay namespace.
  '/api/ebay/account-deletion',
  '/setup',
  '/_app',
  '/favicon'
]

const isPublicRoute = (pathname: string): boolean =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Resolve the best-effort client IP for rate-limiting purposes. Prefer
 * `x-forwarded-for` when the app sits behind a reverse proxy (Caddy /
 * nginx / Traefik in front of the Node container) — the first entry in
 * the comma-separated list is the originating IP. Falls back to
 * `event.getClientAddress()` which reads the socket remote address.
 *
 * Returns `'unknown'` as a last resort so the limiter still has a
 * stable bucket — anonymous floods then share one bucket, which is
 * the desired fail-closed behaviour.
 */
export const resolveClientIp = (event: RequestEvent): string => {
  const fwd = event.request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  try {
    return event.getClientAddress()
  } catch {
    return 'unknown'
  }
}

/**
 * Brute-force shield on the better-auth sign-in endpoint. POST requests
 * to `/api/auth/sign-in/*` are bucketed per client IP at 10 attempts
 * per minute. Denied requests get a 429 with a friendly German body so
 * the login form's existing error handling renders a useful message.
 *
 * Sign-up, sign-out, session-refresh and other auth sub-paths are not
 * throttled: sign-up is `disableSignUp: true` anyway, and the others
 * are not brute-force vectors.
 */
const rateLimitSignIn: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (
    event.request.method === 'POST' &&
    pathname.startsWith('/api/auth/sign-in')
  ) {
    const ip = resolveClientIp(event)
    const result = rateLimit(`signin:${ip}`, {
      perMinute: SIGNIN_RATE_PER_MINUTE
    })
    if (!result.allowed) {
      return json(
        { message: 'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfter ?? 60) }
        }
      )
    }
  }
  return resolve(event)
}

/**
 * Throttle the token-authenticated public REST API (and the eBay
 * compliance endpoint) per caller. The bucket key prefers the Bearer
 * token's first 8 chars — stable per third-party client, never the
 * full secret — and falls back to the client IP for unauthenticated
 * requests, so failed-auth floods are contained too.
 */
const rateLimitPublicApi: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/api/ebay/account-deletion')
  ) {
    const header = event.request.headers.get('authorization') ?? ''
    const m = /^Bearer\s+(\S+)/i.exec(header.trim())
    const bucket = m
      ? `token:${m[1].slice(0, 8)}`
      : `ip:${resolveClientIp(event)}`
    const result = rateLimit(`public-api:${bucket}`, {
      perMinute: PUBLIC_API_RATE_PER_MINUTE,
      burst: PUBLIC_API_BURST
    })
    if (!result.allowed) {
      return json(
        { message: 'Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfter ?? 60) }
        }
      )
    }
  }
  return resolve(event)
}

/**
 * Reject a sign-in attempt for a deactivated account *before* better-auth
 * validates credentials and mints a session. Returns a 403 with a curated
 * German message that the login form surfaces directly (it reads
 * `error.message`). The body is cloned so better-auth still sees the
 * original request on the (rare) active-account path. Unknown usernames
 * fall through to better-auth's normal "invalid credentials" response —
 * no account enumeration.
 */
const blockDeactivatedSignIn: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (
    event.request.method === 'POST' &&
    pathname.startsWith('/api/auth/sign-in')
  ) {
    let username: string | undefined
    try {
      const body = await event.request.clone().json()
      if (body && typeof body.username === 'string') username = body.username
    } catch {
      // Non-JSON / empty body — let better-auth handle it.
    }
    if (username && (await isUsernameDeactivated(username))) {
      return json(
        {
          message:
            'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.'
        },
        { status: 403 }
      )
    }
  }
  return resolve(event)
}

const populateAuthLocals: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers })
  // Re-check `active` against the DB on every request (not the possibly
  // cached session user) so deactivation takes effect immediately, even
  // inside the 5-minute session-cookie cache window.
  if (session && (await isUserActive(session.user.id))) {
    event.locals.session = session.session
    event.locals.user = session.user
    event.locals.permissions = await loadUserPermissions(session.user.id)
  } else {
    event.locals.session = null
    event.locals.user = null
    event.locals.permissions = new Set()
  }
  return resolve(event)
}

const requireAuthHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (!isPublicRoute(pathname) && !event.locals.user) {
    // Preserve the requested URL so we can bounce back after login.
    const redirectTo = encodeURIComponent(pathname + event.url.search)
    throw redirect(303, `/login?redirectTo=${redirectTo}`)
  }
  return resolve(event)
}

export const handle: Handle = async ({ event, resolve }) => {
  await ensureSeeded()
  return rateLimitSignIn({
    event,
    resolve: (eA) =>
      rateLimitPublicApi({
        event: eA,
        resolve: (e0) =>
          blockDeactivatedSignIn({
            event: e0,
            resolve: (e1) =>
              svelteKitHandler({
                event: e1,
                resolve: (e) =>
                  populateAuthLocals({
                    event: e,
                    resolve: (e2) => requireAuthHandle({ event: e2, resolve })
                  }),
                auth,
                building
              })
          })
      })
  })
}

/**
 * German labels for the field keys that appear across the remote
 * function schemas. `handleValidationError` renders the offending
 * field through this map so users see "IBAN" instead of the raw
 * `bankIban` identifier. Unknown keys fall back to the raw key —
 * still better than hiding which input failed.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Person / address
  company: 'Firma',
  salutation: 'Anrede',
  title: 'Titel',
  firstName: 'Vorname',
  lastName: 'Nachname',
  name: 'Name',
  street: 'Straße',
  zip: 'PLZ',
  city: 'Ort',
  country: 'Land',
  phone: 'Telefon',
  privatePhone: 'Telefon (privat)',
  mobile: 'Mobilnummer',
  fax: 'Fax',
  email: 'E-Mail',
  privateEmail: 'E-Mail (privat)',
  website: 'Website',
  notes: 'Notiz',
  // Finance / tax
  paymentTermDays: 'Zahlungsziel (Tage)',
  vatId: 'USt-IdNr.',
  taxNumber: 'Steuernummer',
  bankIban: 'IBAN',
  iban: 'IBAN',
  bankBic: 'BIC',
  bic: 'BIC',
  bankName: 'Bank',
  bankAccountHolder: 'Kontoinhaber',
  amount: 'Betrag',
  taxRate: 'Steuersatz',
  discountPercent: 'Rabatt (%)',
  // Customer / vehicle
  customerNumber: 'Kundennummer',
  ebayHandle: 'eBay-Name',
  customerId: 'Kunde',
  vehicleId: 'Fahrzeug',
  employeeId: 'Mitarbeiter',
  supplierId: 'Lieferant',
  licensePlate: 'Kennzeichen',
  vin: 'FIN',
  hsn: 'HSN',
  tsn: 'TSN',
  make: 'Marke',
  model: 'Modell',
  firstRegistration: 'Erstzulassung',
  mileageKm: 'km-Stand',
  nextHu: 'Nächste HU',
  nextAu: 'Nächste AU',
  displacementCcm: 'Hubraum (ccm)',
  powerKw: 'Leistung (kW)',
  colorCode: 'Farbcode',
  engineNumber: 'Motornummer',
  fuelType: 'Kraftstoff',
  gearbox: 'Getriebe',
  bodyType: 'Aufbau',
  purchasePrice: 'Ankaufspreis',
  purchaseDate: 'Ankaufsdatum',
  // Employee
  personnelNumber: 'Personalnummer',
  birthday: 'Geburtstag',
  birthplace: 'Geburtsort',
  nationality: 'Staatsangehörigkeit',
  hireDate: 'Eintrittsdatum',
  terminationDate: 'Austrittsdatum',
  position: 'Position',
  department: 'Abteilung',
  employmentType: 'Beschäftigungsart',
  weeklyHours: 'Wochenstunden',
  monthlySalary: 'Monatsgehalt',
  hourlyWage: 'Stundenlohn',
  vacationDaysPerYear: 'Urlaubstage pro Jahr',
  halfDay: 'Halber Tag',
  taxId: 'Steuer-ID',
  taxClass: 'Steuerklasse',
  socialInsuranceNumber: 'Sozialversicherungsnummer',
  healthInsurance: 'Krankenkasse',
  // Documents / items
  documentNumber: 'Belegnummer',
  issueDate: 'Belegdatum',
  serviceDate: 'Leistungsdatum',
  dueDate: 'Fälligkeitsdatum',
  validFrom: 'Gültig ab',
  dateFrom: 'Datum von',
  dateTo: 'Datum bis',
  from: 'Von',
  to: 'Bis',
  items: 'Positionen',
  quantity: 'Menge',
  unit: 'Einheit',
  unitPriceNet: 'Einzelpreis (netto)',
  purchasePriceNet: 'Einkaufspreis (netto)',
  description: 'Beschreibung',
  articleNumber: 'Artikelnummer',
  brand: 'Hersteller',
  stockOnHand: 'Bestand',
  // Mail / auth / settings
  subject: 'Betreff',
  body: 'Nachricht',
  filename: 'Dateiname',
  attachments: 'Anhänge',
  username: 'Benutzername',
  password: 'Passwort',
  host: 'Server',
  port: 'Port',
  fromName: 'Absendername',
  q: 'Suchbegriff',
  page: 'Seite',
  size: 'Seitengröße',
  status: 'Status'
}

/**
 * Render an issue path (already flattened to string segments) as a
 * German field label. Wrapper keys without user-facing meaning
 * (`values` from `object({ id, values })` update commands) are
 * skipped; an array index in the path becomes "(Position N)" so list
 * rows stay identifiable (1-based). Returns `null` when nothing
 * meaningful remains.
 */
const fieldLabelForPath = (segments: string[]): string | null => {
  const meaningful = segments.filter((s) => s !== 'values')
  if (meaningful.length === 0) return null
  let last = meaningful.pop()!
  let index: number | null = null
  if (/^\d+$/.test(last)) {
    // Path ends on an array index — label the array itself.
    index = Number(last) + 1
    const parent = meaningful.pop()
    if (!parent) return null
    last = parent
  } else if (
    meaningful.length > 0 &&
    /^\d+$/.test(meaningful[meaningful.length - 1])
  ) {
    // `items.0.quantity` → "Menge (Position 1)".
    index = Number(meaningful[meaningful.length - 1]) + 1
  }
  const label = FIELD_LABELS[last] ?? last
  return index != null ? `${label} (Position ${index})` : label
}

/**
 * Convert a Valibot validation failure into a single user-safe German
 * message. The shape returned here lands in `App.Error` and is consumed
 * by `+error.svelte` and `handleClientError` — so the message is the
 * only thing the user ever sees.
 *
 * Notes:
 * - Only the first issue is surfaced. Showing all issues at once is
 *   noisy and confusing for non-technical users.
 * - The offending field is rendered through {@link FIELD_LABELS} so
 *   users see "IBAN" / "Kennzeichen" instead of raw schema keys like
 *   `bankIban`; unmapped keys keep the raw key as fallback.
 * - If the underlying schema didn't supply a German message (Valibot's
 *   built-in defaults are English), we fall back to a generic German
 *   sentence rather than leaking the English text.
 */
export const handleValidationError: HandleValidationError = ({ issues }) => {
  const first = issues[0]
  const segments =
    first && 'path' in first && Array.isArray(first.path) && first.path.length
      ? first.path.map((p: unknown) =>
          typeof p === 'object' && p !== null && 'key' in p
            ? String((p as { key: unknown }).key)
            : String(p)
        )
      : []
  const label = fieldLabelForPath(segments)
  const raw = first?.message?.trim() ?? ''
  // Heuristic: Valibot's built-in messages are English ASCII without
  // umlauts. If we haven't given the schema a curated German message,
  // fall back to a generic sentence instead of leaking English to the
  // user.
  const looksGerman = /[äöüÄÖÜß]/.test(raw) || raw === ''
  const detail = looksGerman && raw ? raw : 'Bitte prüfen Sie Ihre Eingabe.'
  return {
    message: label
      ? `Ungültige Eingabe für „${label}“: ${detail}`
      : `Ungültige Eingabe: ${detail}`
  }
}

/**
 * Translate any unhandled server error into a user-safe German message.
 *
 * Three buckets:
 * - 5xx: log the original (stack, SQL, etc.) for ops; return a generic
 *   German sentence — never leak internals to the browser.
 * - 4xx that we explicitly threw (`error(404, 'Kunde nicht gefunden.')`,
 *   etc.): SvelteKit already passes the message through; we don't
 *   override it. Returning `undefined` lets the original message stand.
 * - Unknown 4xx without a message: provide a German fallback.
 */
export const handleError: HandleServerError = ({ error, status, message }) => {
  if (status >= 500) {
    console.error('[server-error]', error)
    return { message: 'Ein interner Fehler ist aufgetreten.' }
  }
  // Curated 4xx (`error(404, '…')`) already supplies a German message —
  // let SvelteKit forward it untouched.
  if (typeof message === 'string' && message.trim().length > 0) {
    return undefined
  }
  return { message: 'Die Anfrage konnte nicht bearbeitet werden.' }
}
