/**
 * Resolves a Chromium binary from the local Playwright cache.
 *
 * Browsers are never downloaded in this project (the environment has no
 * network budget for it and CI installs them explicitly). Playwright often
 * asks for a build number that the cache does not have, so the newest cached
 * build is used instead. `CHROMIUM_PATH` overrides the search.
 */
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function resolveChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH
  }

  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cache)) return undefined

  const builds = readdirSync(cache)
    .filter(name => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))

  for (const build of builds) {
    const candidate = join(cache, build, 'chrome-linux64', 'chrome')
    if (existsSync(candidate)) return candidate
    const legacy = join(cache, build, 'chrome-linux', 'chrome')
    if (existsSync(legacy)) return legacy
  }
  return undefined
}
