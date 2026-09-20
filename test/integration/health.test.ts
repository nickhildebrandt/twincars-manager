/**
 * The liveness check, against a real database and against a broken one.
 */
import { afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { checkHealth } from '../../server/utils/health.ts'
import { openTestDatabase } from '../setup/drizzle'

const { db, close } = openTestDatabase()
afterAll(close)

describe('checkHealth', () => {
  it('meldet eine erreichbare Datenbank', async () => {
    const health = await checkHealth(db)
    expect(health.status).toBe('ok')
    expect(health.database).toBe('ok')
    expect(health.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('verrät nichts über die Installation', async () => {
    // Der Endpunkt ist öffentlich. Version, Konfiguration und Zahlen aus dem
    // Betrieb gehören deshalb nicht in die Antwort.
    expect(Object.keys(await checkHealth(db)).sort()).toEqual(['database', 'latencyMs', 'status'])
  })

  it('scheitert, wenn die Datenbank nicht antwortet', async () => {
    const broken = drizzle(postgres({
      host: '127.0.0.1',
      port: 1,
      database: 'gibtsnicht',
      username: 'niemand',
      connect_timeout: 1,
      max: 1,
      onnotice: () => {},
    }))
    await expect(checkHealth(broken)).rejects.toThrow()
  })
})
