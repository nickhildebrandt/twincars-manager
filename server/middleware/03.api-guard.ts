/**
 * A second lock on `/api/**`.
 *
 * Every endpoint starts with its own guard. This middleware exists because a
 * forgotten guard should be a 401, not open data access — the predecessor had
 * only the per-endpoint discipline, and three endpoints had quietly lost it
 * (B-002, B-003, B-041).
 *
 * It answers 401 only. Which permission is needed stays the endpoint's
 * decision, because only the endpoint knows its module.
 */
import { isApiPath, isPublicPath } from '../utils/auth-paths.ts'
import { unauthorized } from '../utils/errors.ts'

export default defineEventHandler((event) => {
  if (!isApiPath(event.path)) return
  if (isPublicPath(event.path)) return
  if (event.context.auth) return
  throw unauthorized()
})
