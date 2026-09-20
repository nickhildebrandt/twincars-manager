/**
 * Turns `DATABASE_URL` into connection options for postgres.js.
 *
 * Why not hand the URL to the driver directly? Because postgres.js accepts a
 * unix socket only through the options object, not through the
 * `?host=/var/run/postgresql` form that libpq (and therefore `psql`, CI and
 * most tooling) understands. Local development connects through the socket, so
 * the translation happens here — once, for the application, the migration
 * runner and the tests alike.
 */
import type { Options } from 'postgres'

export type ConnectionOptions = Options<Record<string, never>>

/**
 * @param url  connection string, e.g. `postgres://user:pw@host:5432/db` or
 *             `postgres:///db?host=/var/run/postgresql`
 * @param overrides  merged on top, e.g. `{ max: 1 }` for the migration runner
 */
export function connectionOptionsFrom(
  url: string,
  overrides: Partial<ConnectionOptions> = {},
): ConnectionOptions {
  if (!url) {
    throw new Error(
      'DATABASE_URL fehlt. Ohne Verbindung kann die Anwendung nicht arbeiten.',
    )
  }

  const parsed = new URL(url)
  const socket = parsed.searchParams.get('host')
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))

  const options: ConnectionOptions = {
    database,
    onnotice: () => {},
    ...overrides,
  }

  if (socket?.startsWith('/')) {
    options.host = socket
  }
  else {
    options.host = parsed.hostname || '127.0.0.1'
    if (parsed.port) options.port = Number(parsed.port)
  }

  if (parsed.username) options.username = decodeURIComponent(parsed.username)
  if (parsed.password) options.password = decodeURIComponent(parsed.password)

  return options
}

/** Same, with the database name replaced — used when creating test databases. */
export function connectionOptionsForDatabase(
  url: string,
  database: string,
  overrides: Partial<ConnectionOptions> = {},
): ConnectionOptions {
  return { ...connectionOptionsFrom(url, overrides), database }
}
