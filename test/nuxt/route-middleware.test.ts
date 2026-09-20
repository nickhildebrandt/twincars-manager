/**
 * Die Wächter vor den Seiten.
 *
 * Sie ersetzen keine Serverprüfung — jeder Endpoint prüft für sich. Sie sorgen
 * dafür, dass niemand in einer Oberfläche landet, die nichts anzeigen kann:
 * der Vorgänger zeigte in diesem Fall eine leere Seite (B-058).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { RouteLocationNormalized } from 'vue-router'
import authGlobal from '~/middleware/auth.global'
import permissionMiddleware from '~/middleware/permission'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const route = (path: string, meta: Record<string, unknown> = {}) => ({
  path,
  fullPath: path,
  meta,
} as unknown as RouteLocationNormalized)

const from = route('/')

const signIn = (modules: Record<string, boolean> = {}) => {
  useAuthState().value = {
    user: { id: 'u-1', username: 'mmustermann', displayName: 'Max', roles: [] },
    permissions: Object.keys(modules),
    modules,
  }
}

beforeEach(() => {
  navigate.mockReset()
  useAuthState().value = { user: null, permissions: [], modules: {} }
})

describe('auth.global', () => {
  it.each(['/login', '/login/', '/setup', '/setup/schritt-2'])(
    'lässt %s ohne Anmeldung durch',
    (path) => {
      expect(authGlobal(route(path), from)).toBeUndefined()
      expect(navigate).not.toHaveBeenCalled()
    },
  )

  it('schickt ohne Anmeldung zur Anmeldeseite', () => {
    authGlobal(route('/customers'), from)
    expect(navigate).toHaveBeenCalledWith('/login?redirectTo=%2Fcustomers', { replace: true })
  })

  it('merkt sich das ursprüngliche Ziel', () => {
    authGlobal(route('/invoices/9f1c'), from)
    expect(navigate).toHaveBeenCalledWith('/login?redirectTo=%2Finvoices%2F9f1c', { replace: true })
  })

  it('lässt den Angemeldeten durch', () => {
    signIn({ customers: true })
    expect(authGlobal(route('/customers'), from)).toBeUndefined()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('führt ohne die nötige Berechtigung auf die 403-Seite', () => {
    // Kein leerer Bildschirm mehr, sondern eine Seite, die erklärt, was fehlt.
    signIn({ customers: true })
    authGlobal(route('/settings', { permission: 'settings' }), from)
    expect(navigate).toHaveBeenCalledWith('/403', { replace: true })
  })

  it('lässt eine Seite ohne erklärte Berechtigung durch', () => {
    signIn({ customers: true })
    expect(authGlobal(route('/'), from)).toBeUndefined()
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('permission', () => {
  it('tut nichts ohne erklärte Berechtigung', () => {
    signIn({ customers: true })
    expect(permissionMiddleware(route('/customers'), from)).toBeUndefined()
  })

  it('lässt mit Berechtigung durch', () => {
    signIn({ customers: true })
    expect(permissionMiddleware(route('/customers', { permission: 'customers' }), from))
      .toBeUndefined()
  })

  it('führt ohne Berechtigung auf die 403-Seite', () => {
    signIn({ orders: true })
    permissionMiddleware(route('/customers', { permission: 'customers' }), from)
    expect(navigate).toHaveBeenCalledWith('/403', { replace: true })
  })

  it('überlässt den anonymen Fall der globalen Middleware', () => {
    // Sonst bekäme der Abgemeldete eine 403-Seite statt der Anmeldung.
    permissionMiddleware(route('/customers', { permission: 'customers' }), from)
    expect(navigate).not.toHaveBeenCalled()
  })
})
