/**
 * No page without a session, except the ones that exist to get one.
 *
 * The target is carried along so the visitor lands where they wanted after
 * signing in — checked by `safeRedirectTarget`, because a target from the
 * address bar is a target an attacker can write (B-002, B-056).
 */
import { loginPathFor } from '#shared/redirect'
import type { ModuleKey } from '#shared/permissions'

/** Pages that are reachable before signing in. */
const PUBLIC_ROUTES = ['/login', '/setup']

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_ROUTES.some(route => to.path === route || to.path.startsWith(`${route}/`))) {
    return
  }

  const state = useAuthState()
  if (!state.value.user) {
    return navigateTo(loginPathFor(to.fullPath), { replace: true })
  }

  // A page may name the module it belongs to:
  //   definePageMeta({ permission: 'customers' })
  const required = to.meta.permission as ModuleKey | undefined
  if (required && state.value.modules[required] !== true) {
    return navigateTo('/403', { replace: true })
  }
})
