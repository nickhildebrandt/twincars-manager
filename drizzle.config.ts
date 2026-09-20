import { defineConfig } from 'drizzle-kit'

// Schema and migrations: ./docs/rewrite/03-architektur.md §7.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/*.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
