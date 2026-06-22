/**
 * In-memory Drizzle client for integration tests.
 *
 * Backed by `pg-mem` (already a devDependency) and wired into Drizzle
 * through the driver-agnostic `pg-proxy` adapter — no `pg` /
 * `postgres-js` Node addon is required, which keeps the test setup
 * dependency-free.
 *
 * Usage in a test file:
 *
 * ```ts
 * import { createTestDb } from '$lib/server/db/test-db'
 *
 * vi.mock('$lib/server/db/client', async () => {
 *   const { createTestDb } = await import('$lib/server/db/test-db')
 *   const tdb = await createTestDb()
 *   return { db: tdb.db, schema: tdb.schema }
 * })
 * ```
 *
 * For test isolation, build a fresh db per test file (the mock above)
 * or per test (call `createTestDb()` in `beforeEach` and re-assign the
 * exported reference).
 *
 * Limitations of pg-mem we work around:
 *   - `gen_random_uuid()` is not built in — we register a JS impl.
 *   - `current_timestamp` is supported, `now()` returns a JS Date — OK.
 *   - JSONB exists but some operators are limited; we keep server queries
 *     simple enough that this is not (yet) a problem.
 *   - Some migration SQL features (CHECK with subqueries, certain index
 *     options) may be stripped via the regex sanitizer below; tests that
 *     depend on a missing migration nuance must run against a real DB.
 */
import { newDb, DataType, type IMemoryDb } from 'pg-mem'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import * as schema from './schema'

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

function applyMigrations(mem: IMemoryDb): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    const statements = raw
      .split(/-->\s*statement-breakpoint/g)
      .map((s) =>
        s
          // pg-mem can't parse `WITH TIME ZONE`; normalize.
          .replace(/timestamp with time zone/gi, 'timestamp')
          // Strip pl/pgSQL `DO $$ ... END $$` blocks (used for
          // idempotent FK adds). pg-mem doesn't support plpgsql; we
          // don't need FK enforcement in tests.
          .replace(/DO \$\$[\s\S]*?END \$\$;?/g, '')
          .trim()
      )
      .filter((s) => s.length > 0)
      // Skip data backfills (`INSERT ... SELECT`). Production migrations
      // use them to seed new tables from old columns; test fixtures
      // start empty so the work is unnecessary, and pg-mem chokes on
      // some correlated subqueries used in backfills. Match anywhere
      // in the statement since SQL comments may precede the keyword.
      .filter((s) => !/\bINSERT\s+INTO\b[\s\S]*\bSELECT\b/i.test(s))

    for (const stmt of statements) {
      try {
        mem.public.none(stmt)
      } catch (err) {
        // Swallow features pg-mem doesn't support that aren't critical
        // for test correctness (e.g. exotic index options). Re-throw
        // anything that looks structural.
        const msg = (err as Error).message ?? ''
        if (
          /already exists/i.test(msg) ||
          /unsupported/i.test(msg) ||
          /not supported/i.test(msg) ||
          // pg-mem doesn't fully honour `DROP ... IF EXISTS` for some
          // object types — treat missing-object drops as no-ops since
          // the migration intended them as such.
          /does not exist/i.test(msg)
        ) {
          continue
        }
        throw err
      }
    }
  }
}

export type TestDbHandle = {
  db: ReturnType<typeof drizzle<typeof schema>>
  mem: IMemoryDb
  schema: typeof schema
  pool: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
  }
}

/**
 * Create a fresh in-memory database with all migrations applied.
 * Each call yields an independent database instance.
 */
export async function createTestDb(): Promise<TestDbHandle> {
  const mem = newDb()

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true
  })

  applyMigrations(mem)

  // pg-mem's `public.query()` only accepts plain text. To execute the
  // parameterised statements drizzle emits ($1, $2, …), we go through
  // pg-mem's built-in pg-compatible adapter, which understands the same
  // `query(text, params)` shape as node-postgres.
  const { Pool } = mem.adapters.createPg()
  const pool = new Pool()

  const db = drizzle(
    async (sql, params, method) => {
      const result = await pool.query(sql, params)
      const rows = (result.rows as Record<string, unknown>[]).map((row) =>
        Object.values(row)
      )
      if (method === 'all') return { rows }
      return { rows: rows[0] ?? [] }
    },
    { schema }
  )

  return { db, mem, schema, pool }
}
