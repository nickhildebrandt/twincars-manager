/**
 * Named route middleware for a page that needs one module permission.
 *
 *   definePageMeta({ middleware: 'permission', permission: 'customers' })
 *
 * The global middleware already enforces this when the page declares it; this
 * one exists so a page can be explicit, and so a layout can apply it.
 */
import type { ModuleKey } from '#shared/permissions'

export default defineNuxtRouteMiddleware((to) => {
  const required = to.meta.permission as ModuleKey | undefined
  if (!required) return

  const state = useAuthState()
  if (!state.value.user) return
  if (state.value.modules[required] === true) return
  return navigateTo('/403', { replace: true })
})
