import { existsSync, readFileSync, rmSync } from 'node:fs'

const PID_PATH = 'e2e/.auth/webserver.pid'

/**
 * Global teardown: stops the `node build` server that global setup
 * spawned when `E2E_WEB_SERVER=1` was set. A developer-managed server
 * (the default workflow) is never touched — the PID file only exists
 * when the harness started the process itself.
 */
export default async function globalTeardown() {
  if (!existsSync(PID_PATH)) return
  const pid = Number(readFileSync(PID_PATH, 'utf8').trim())
  rmSync(PID_PATH, { force: true })
  if (!Number.isInteger(pid) || pid <= 1) return
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`[e2e-teardown] stopped managed web server (pid ${pid})`)
  } catch {
    // Already gone — nothing to do.
  }
}
