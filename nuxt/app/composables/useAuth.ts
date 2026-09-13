/**
 * Who is signed in, for the interface.
 *
 * The state is filled once while the page renders on the server and then lives
 * in `useState`, so navigation and buttons are correct in the first HTML
 * instead of appearing a moment later.
 *
 * Permissions are **never** decided here. This composable only repeats what the
 * server said; every endpoint checks again for itself.
 */
import { authClient } from '../utils/auth-client'
import type { ModuleKey } from '#shared/permissions'

export type CurrentUser = {
  id: string
  username: string
  displayName: string
  roles: string[]
}

export type AuthState = {
  user: CurrentUser | null
  permissions: string[]
  modules: Partial<Record<ModuleKey, boolean>>
}

const EMPTY: AuthState = { user: null, permissions: [], modules: {} }

export function useAuthState() {
  return useState<AuthState>('auth', () => ({ ...EMPTY }))
}

export function useAuth() {
  const state = useAuthState()

  /** Re-reads the session. Called after signing in and after signing out. */
  async function refresh(): Promise<void> {
    try {
      state.value = await useRequestFetch()('/api/me') as AuthState
    }
    catch {
      state.value = { ...EMPTY }
    }
  }

  /**
   * Signs in.
   *
   * Wrong password and unknown user name produce the **same** sentence. Any
   * difference would let somebody test which logins exist.
   */
  async function signIn(username: string, password: string): Promise<{ ok: true } | { ok: false, message: string }> {
    const { error } = await authClient.signIn.username({ username, password })

    if (error) {
      if (error.status === 429) {
        return { ok: false, message: 'Zu viele Versuche. Bitte warten Sie eine Minute.' }
      }
      if (error.status === 403) {
        return { ok: false, message: 'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Verwaltung.' }
      }
      return { ok: false, message: 'Benutzername oder Passwort ist falsch.' }
    }

    await refresh()
    return { ok: true }
  }

  /** Signs out and returns to the login. `reason` explains an automatic one. */
  async function signOut(reason?: 'idle'): Promise<void> {
    try {
      await authClient.signOut()
    }
    finally {
      state.value = { ...EMPTY }
      await navigateTo(reason ? `/login?reason=${reason}` : '/login', { replace: true })
    }
  }

  /** Whether the signed-in person may see a module. Only for the interface. */
  function can(module: ModuleKey): boolean {
    return state.value.modules[module] === true
  }

  return {
    user: computed(() => state.value.user),
    permissions: computed(() => state.value.permissions),
    isSignedIn: computed(() => state.value.user !== null),
    can,
    refresh,
    signIn,
    signOut,
  }
}
