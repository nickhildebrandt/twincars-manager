/**
 * Column types that Drizzle does not ship a helper for.
 */
import { customType } from 'drizzle-orm/pg-core'

/**
 * PostgreSQL `bytea`. Used for the three binary columns of the application:
 * rendered document PDFs, reminder PDFs and uploaded vehicle documents.
 *
 * Whether these stay in the database is a deliberate open decision
 * (../../../../docs/rewrite/08-entscheidungen.md E-17); what is already
 * settled is that the bytes are never loaded by a list query.
 */
export const bytea = customType<{ data: Buffer, driverData: Buffer }>({
  dataType: () => 'bytea',
})
