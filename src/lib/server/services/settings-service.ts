import { db } from '$lib/server/db/client'
import { companySettings, type CompanySettings } from '$lib/server/db/schema'

/**
 * Load (and lazily create) the singleton company-settings row.
 */
export async function getSettings(): Promise<CompanySettings> {
  const rows = await db.select().from(companySettings).limit(1)
  if (rows.length === 0) {
    const [created] = await db.insert(companySettings).values({}).returning()
    return created
  }
  return rows[0]
}
