/**
 * Environment variables. The application refuses to start when the
 * configuration is incomplete or implausible
 * (../../../docs/rewrite/03-architektur.md §6.6).
 *
 * The predecessor fell back to a hard-coded session secret and a hard-coded
 * database password when the variables were missing, so a production instance
 * could silently run with publicly known credentials (B-558, B-559).
 */
import * as v from 'valibot'

/**
 * A missing object key produces Valibot's own object-level message, not the
 * message of the entry schema. To keep control of the wording, required
 * variables are declared optional here and their presence is checked
 * separately with a forwarded rule (see `required` below).
 */
const secret = (name: string, min = 32) =>
  v.optional(
    v.pipe(
      v.string(),
      v.minLength(min, `${name} muss mindestens ${min} Zeichen lang sein.`),
    ),
  )

export const envSchema = v.pipe(
  v.object({
    NODE_ENV: v.optional(
      v.picklist(['development', 'test', 'production'], 'NODE_ENV ist ungültig.'),
      'development',
    ),

    DATABASE_URL: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^postgres(ql)?:\/\//, 'DATABASE_URL muss mit postgres:// beginnen.'),
      ),
    ),

    APP_SECRET: secret('APP_SECRET'),

    /** Falls back to APP_SECRET outside production; checked below. */
    APP_ENCRYPTION_KEY: v.optional(v.string()),

    ORIGIN: v.optional(
      v.pipe(v.string(), v.url('ORIGIN muss eine vollständige Adresse sein.')),
    ),

    /**
     * Where better-auth believes it lives. Defaults to `ORIGIN`.
     *
     * Both are used to build the trusted-origin list, so that a mismatch
     * cannot leave the CSRF check looking at the wrong address (B-071).
     */
    BETTER_AUTH_URL: v.optional(
      v.pipe(v.string(), v.url('BETTER_AUTH_URL muss eine vollständige Adresse sein.')),
    ),

    /** Fixed: appointment slots and period boundaries depend on it. */
    TZ: v.optional(
      v.literal('Europe/Berlin', 'TZ muss auf Europe/Berlin stehen.'),
      'Europe/Berlin',
    ),

    /**
     * `on` only behind a proxy that overwrites `x-forwarded-for`.
     *
     * Left off, the rate limiter counts the socket address, which nobody can
     * choose. Turned on without a proxy in front, the protection is worthless
     * (B-003).
     */
    TRUST_PROXY: v.optional(
      v.picklist(['on', 'off'], 'TRUST_PROXY muss "on" oder "off" sein.'),
      'off',
    ),

    /** Minutes of inactivity before the session ends. */
    IDLE_TIMEOUT_MINUTES: v.optional(
      v.pipe(
        v.number('IDLE_TIMEOUT_MINUTES muss eine Zahl sein.'),
        v.integer('IDLE_TIMEOUT_MINUTES muss eine ganze Zahl sein.'),
        v.minValue(5, 'IDLE_TIMEOUT_MINUTES muss mindestens 5 betragen.'),
        v.maxValue(1440, 'IDLE_TIMEOUT_MINUTES darf höchstens 1440 betragen.'),
      ),
      60,
    ),

    /** `off` silences the schedule; the buttons keep working (E-12). */
    TASKS_SCHEDULE: v.optional(
      v.picklist(['on', 'off'], 'TASKS_SCHEDULE muss "on" oder "off" sein.'),
      'on',
    ),

    /** Comma separated, each at least 16 characters. Empty disables the API. */
    API_TOKENS: v.optional(v.string(), ''),

    EBAY_CLIENT_ID: v.optional(v.string()),
    EBAY_CERT_ID: v.optional(v.string()),
    EBAY_RU_NAME: v.optional(v.string()),
    EBAY_ENV: v.optional(v.picklist(['sandbox', 'production']), 'production'),
    EBAY_VERIFICATION_TOKEN: v.optional(
      v.pipe(
        v.string(),
        v.regex(
          /^[A-Za-z0-9_-]{32,80}$/,
          'EBAY_VERIFICATION_TOKEN muss 32 bis 80 Zeichen aus A-Z, a-z, 0-9, _ und - haben.',
        ),
      ),
    ),
    EBAY_DELETION_ENDPOINT_URL: v.optional(v.pipe(v.string(), v.url())),
  }),

  // Required variables first, so "fehlt" beats every follow-up rule.
  v.forward(
    v.check(env => Boolean(env.DATABASE_URL), 'DATABASE_URL fehlt.'),
    ['DATABASE_URL'],
  ),
  v.forward(
    v.check(env => Boolean(env.APP_SECRET), 'APP_SECRET fehlt.'),
    ['APP_SECRET'],
  ),

  // Production needs a public address and its own encryption key.
  v.forward(
    v.check(
      env => env.NODE_ENV !== 'production' || Boolean(env.ORIGIN),
      'ORIGIN muss in der Produktion gesetzt sein.',
    ),
    ['ORIGIN'],
  ),
  v.forward(
    v.check(
      env => env.NODE_ENV !== 'production' || (env.APP_ENCRYPTION_KEY ?? '').length >= 32,
      'APP_ENCRYPTION_KEY muss in der Produktion gesetzt sein (mindestens 32 Zeichen).',
    ),
    ['APP_ENCRYPTION_KEY'],
  ),

  // Public API tokens: every entry must be long enough to be worth something.
  v.forward(
    v.check(
      env => parseTokens(env.API_TOKENS).every(token => token.length >= 16),
      'Jeder Eintrag in API_TOKENS muss mindestens 16 Zeichen lang sein.',
    ),
    ['API_TOKENS'],
  ),

  // eBay is all or nothing: a half-configured connection fails at runtime.
  v.forward(
    v.check(
      (env) => {
        const parts = [env.EBAY_CLIENT_ID, env.EBAY_CERT_ID, env.EBAY_RU_NAME]
        const set = parts.filter(Boolean).length
        return set === 0 || set === parts.length
      },
      'EBAY_CLIENT_ID, EBAY_CERT_ID und EBAY_RU_NAME müssen gemeinsam gesetzt sein.',
    ),
    ['EBAY_CLIENT_ID'],
  ),
)

export type Env = v.InferOutput<typeof envSchema>

/** Splits the token list. Comma, semicolon and newline all separate. */
export function parseTokens(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\n]/)
    .map(token => token.trim())
    .filter(token => token.length > 0)
}
