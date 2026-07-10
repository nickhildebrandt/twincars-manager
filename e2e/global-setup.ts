import { chromium, type FullConfig } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Global setup for the E2E suite. Runs once before all specs:
 *
 *   1. Optionally reseeds the database (`SEED=1` runs
 *      scripts/seed-test-db.mjs against DATABASE_URL).
 *   2. Verifies a server answers on `baseURL`. If nothing answers and
 *      `E2E_WEB_SERVER=1` is set, spawns `node build` itself (the
 *      production build must exist) and remembers the PID so global
 *      teardown can stop it again.
 *   3. Logs in through the real login form once and saves the
 *      authenticated storage state to e2e/.auth/admin.json — every
 *      spec (except the anonymous auth specs) starts logged in.
 */

const STATE_PATH = 'e2e/.auth/admin.json'
const PID_PATH = 'e2e/.auth/webserver.pid'
const LOG_PATH = 'e2e/.auth/webserver.log'

const USERNAME = process.env.E2E_USERNAME ?? 'e2eadmin'
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-passwort-123'

/** True when an HTTP server answers (any status counts, incl. redirects). */
const serverAnswers = async (baseURL: string): Promise<boolean> => {
  try {
    await fetch(baseURL, { redirect: 'manual' })
    return true
  } catch {
    return false
  }
}

const waitForServer = async (baseURL: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await serverAnswers(baseURL)) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server unter ${baseURL} antwortet nicht (Timeout).`)
}

const seedDatabase = () => {
  console.log('[e2e-setup] SEED=1 — seeding test database …')
  const res = spawnSync(process.execPath, ['scripts/seed-test-db.mjs'], {
    stdio: 'inherit'
  })
  if (res.status !== 0) {
    throw new Error('Seeding failed (scripts/seed-test-db.mjs exited non-0).')
  }
}

const startWebServer = async (baseURL: string) => {
  const buildEntry = resolve('build/index.js')
  if (!existsSync(buildEntry)) {
    throw new Error(
      'E2E_WEB_SERVER=1 but ./build does not exist — run `pnpm build` first.'
    )
  }
  const url = new URL(baseURL)
  console.log(`[e2e-setup] starting \`node build\` on port ${url.port} …`)
  mkdirSync(dirname(PID_PATH), { recursive: true })
  const out = openSync(LOG_PATH, 'w')
  const child = spawn(process.execPath, ['build'], {
    env: {
      ...process.env,
      PORT: url.port || '4173',
      ORIGIN: url.origin,
      BODY_SIZE_LIMIT: process.env.BODY_SIZE_LIMIT ?? '64M'
    },
    stdio: ['ignore', out, out],
    detached: true
  })
  child.unref()
  closeSync(out)
  writeFileSync(PID_PATH, String(child.pid), 'utf8')
  await waitForServer(baseURL, 60_000)
}

const createAdminStorageState = async (config: FullConfig, baseURL: string) => {
  const { launchOptions } = config.projects[0].use
  const browser = await chromium.launch(launchOptions)
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('Benutzername').fill(USERNAME)
    await page.getByLabel('Passwort').fill(PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), {
      timeout: 20_000
    })
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    await context.storageState({ path: STATE_PATH })
    console.log(`[e2e-setup] logged in as ${USERNAME}, state → ${STATE_PATH}`)
  } finally {
    await browser.close()
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:4173'

  // Stale artifacts from previous runs never leak into this one.
  rmSync(STATE_PATH, { force: true })
  rmSync(PID_PATH, { force: true })

  if (process.env.SEED === '1') seedDatabase()

  if (!(await serverAnswers(baseURL))) {
    if (process.env.E2E_WEB_SERVER === '1') {
      await startWebServer(baseURL)
    } else {
      throw new Error(
        `No server answers on ${baseURL}. Start the production build first:\n` +
          `  pnpm build && ORIGIN=${baseURL} PORT=${new URL(baseURL).port || 4173} node build\n` +
          `or run with E2E_WEB_SERVER=1 to let the harness manage it.`
      )
    }
  }

  await createAdminStorageState(config, baseURL)
}
