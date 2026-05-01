import { defineConfig } from 'drizzle-kit'
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env')) {
  const lines = readFileSync('.env', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://admin:TwinCars2026!@localhost:5432/twincars-manager'
  },
  strict: true,
  verbose: false
})
