/**
 * Authorisation. **Every** endpoint starts with one of these calls, before it
 * touches the request body and before it touches the database
 * (../../../docs/rewrite/03-architektur.md §5.1, §9.3).
 *
 * The predecessor checked permissions inside the handler body, sometimes after
 * a query had already run, and three endpoints forgot the check entirely. Here
 * the guard is the first statement, and the ESLint rule
 * `twincars/guard-first` (T-007) keeps it that way.
 *
 * Who is signed in is decided in one place: the session middleware fills
 * `event.context.auth`. These functions only read it.
 */
import type { H3Event } from 'h3'
import { hasAnyPermission, hasPermission, MODULE_LABELS } from '#shared/permissions'
import type { ModuleKey } from '#shared/permissions'
import { forbidden, unauthorized } from './errors.ts'

/** What the session middleware puts on the event. */
export type AuthContext = {
  userId: string
  username: string
  displayName: string
  /** Flattened permission keys of every role the user holds. */
  permissions: Set<string>
}

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}

/** The signed-in user, or 401. */
export function requireUser(event: H3Event): AuthContext {
  const auth = event.context.auth
  if (!auth) throw unauthorized()
  return auth
}

/** The signed-in user, or `null` — for the few endpoints that serve both. */
export function optionalUser(event: H3Event): AuthContext | null {
  return event.context.auth ?? null
}

/**
 * The user plus one module permission, or 403.
 *
 * The message names the area in German, so the user learns what is missing
 * instead of reading "Forbidden".
 */
export function requirePermission(event: H3Event, module: ModuleKey): AuthContext {
  const auth = requireUser(event)
  if (!hasPermission(auth.permissions, module)) {
    throw forbidden(`Sie haben keine Berechtigung für ${MODULE_LABELS[module]}.`)
  }
  return auth
}

/**
 * One of several permissions is enough.
 *
 * The shop floor picks employees and catalogue items while working on an
 * order, without holding the personnel or catalogue permission itself.
 */
export function requireAnyPermission(event: H3Event, ...modules: ModuleKey[]): AuthContext {
  const auth = requireUser(event)
  if (!hasAnyPermission(auth.permissions, ...modules)) {
    const areas = modules.map(module => MODULE_LABELS[module]).join(' oder ')
    throw forbidden(`Sie haben keine Berechtigung für ${areas}.`)
  }
  return auth
}

/** True when the user may see the module. For building navigation. */
export function may(auth: AuthContext | null, module: ModuleKey): boolean {
  return auth ? hasPermission(auth.permissions, module) : false
}
