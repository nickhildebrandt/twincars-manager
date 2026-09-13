/**
 * The handful of globals Nitro provides at runtime.
 *
 * Server code reads its configuration through `useRuntimeConfig()`, which Nitro
 * defines as a global. An integration test runs without Nitro, so the global is
 * defined here — pointing at this worker's database, so the code under test
 * talks to a real PostgreSQL and nothing is mocked away.
 */
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  getRequestIP,
  getRouterParams,
  readBody,
  setResponseHeader,
  toWebRequest,
} from 'h3'
import { testDatabaseUrl } from './db-per-worker'

export const TEST_ORIGIN = 'http://localhost:3000'

export type StubConfig = {
  databaseUrl: string
  appSecret: string
  appEncryptionKey: string
  origin: string
  betterAuthUrl: string
  trustProxy: string
  apiTokens: string
  public: { appVersion: string, idleTimeoutMinutes: number }
}

/**
 * The h3 helpers Nitro auto-imports. Server code calls them unqualified, so
 * they have to exist as globals before such a module is imported.
 */
const H3_GLOBALS = {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  getRequestIP,
  getRouterParams,
  readBody,
  setResponseHeader,
  toWebRequest,
}

/** Defines `useRuntimeConfig` and the h3 helpers for the current test file. */
export function installNitroGlobals(overrides: Partial<StubConfig> = {}): StubConfig {
  const config: StubConfig = {
    databaseUrl: testDatabaseUrl(),
    appSecret: 'test-secret-please-do-not-use-in-production-0000',
    appEncryptionKey: 'test-encryption-key-0000000000000000000000',
    origin: TEST_ORIGIN,
    betterAuthUrl: TEST_ORIGIN,
    trustProxy: 'off',
    apiTokens: '',
    public: { appVersion: '0.0.0-test', idleTimeoutMinutes: 60 },
    ...overrides,
  }
  const target = globalThis as Record<string, unknown>
  target.useRuntimeConfig = () => config
  for (const [name, value] of Object.entries(H3_GLOBALS)) target[name] ??= value
  return config
}
