/**
 * Wer angemeldet ist, aus Sicht der Oberfläche.
 *
 * Wichtig sind hier zwei Dinge: die Meldungen sind deutsch und für falsches
 * Passwort wie unbekannten Namen dieselbe, und ein Fehlschlag beim Lesen der
 * Sitzung hinterlässt einen sauberen leeren Zustand statt eines halben.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const { signInUsername, signOutCall, requestFetch, navigate } = vi.hoisted(() => ({
  signInUsername: vi.fn(),
  signOutCall: vi.fn(),
  requestFetch: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('~/utils/auth-client', () => ({
  authClient: {
    signIn: { username: signInUsername },
    signOut: signOutCall,
  },
}))

mockNuxtImport('useRequestFetch', () => () => requestFetch)
mockNuxtImport('navigateTo', () => navigate)
mockNuxtImport('useToast', () => () => ({
  add: vi.fn(), clear: vi.fn(), remove: vi.fn(), update: vi.fn(), toasts: [],
}))

const ME = {
  user: { id: 'u-1', username: 'mmustermann', displayName: 'Max Mustermann', roles: ['Mitarbeiter'] },
  permissions: ['customers', 'orders'],
  modules: { customers: true, orders: true, settings: false },
}

beforeEach(() => {
  signInUsername.mockReset()
  signOutCall.mockReset()
  requestFetch.mockReset()
  navigate.mockReset()
  useAuthState().value = { user: null, permissions: [], modules: {} }
})

describe('signIn', () => {
  it('meldet an und liest den Zustand nach', async () => {
    signInUsername.mockResolvedValue({ error: null })
    requestFetch.mockResolvedValue(ME)

    const result = await useAuth().signIn('mmustermann', 'ein-gutes-passwort')

    expect(result).toEqual({ ok: true })
    expect(signInUsername).toHaveBeenCalledWith({
      username: 'mmustermann',
      password: 'ein-gutes-passwort',
    })
    expect(useAuthState().value.user?.displayName).toBe('Max Mustermann')
  })

  it('nennt falsches Passwort und unbekannten Namen gleich', async () => {
    // Jeder Unterschied wäre eine Auskunft darüber, welche Zugänge es gibt.
    signInUsername.mockResolvedValue({ error: { status: 401 } })
    const wrongPassword = await useAuth().signIn('mmustermann', 'falsch')

    signInUsername.mockResolvedValue({ error: { status: 404 } })
    const unknownUser = await useAuth().signIn('gibtsnicht', 'falsch')

    expect(wrongPassword).toEqual({ ok: false, message: 'Benutzername oder Passwort ist falsch.' })
    expect(unknownUser).toEqual(wrongPassword)
  })

  it('erklärt ein gesperrtes Konto', async () => {
    signInUsername.mockResolvedValue({ error: { status: 403 } })
    const result = await useAuth().signIn('mmustermann', 'ein-gutes-passwort')
    expect(result).toEqual({
      ok: false,
      message: 'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Verwaltung.',
    })
  })

  it('erklärt die Drossel', async () => {
    signInUsername.mockResolvedValue({ error: { status: 429 } })
    const result = await useAuth().signIn('mmustermann', 'ein-gutes-passwort')
    expect(result).toEqual({ ok: false, message: 'Zu viele Versuche. Bitte warten Sie eine Minute.' })
  })

  it('lässt den Zustand bei einem Fehlschlag leer', async () => {
    signInUsername.mockResolvedValue({ error: { status: 401 } })
    await useAuth().signIn('mmustermann', 'falsch')
    expect(useAuthState().value.user).toBeNull()
  })
})

describe('refresh', () => {
  it('übernimmt, was der Server sagt', async () => {
    requestFetch.mockResolvedValue(ME)
    await useAuth().refresh()
    expect(useAuthState().value.permissions).toEqual(['customers', 'orders'])
  })

  it('hinterlässt bei einem Fehler einen sauberen leeren Zustand', async () => {
    // Ein halber Zustand wäre schlimmer als gar keiner: die Navigation zeigte
    // Einträge, hinter denen nichts steht.
    useAuthState().value = ME
    requestFetch.mockRejectedValue(new Error('Netzwerk weg'))

    await useAuth().refresh()

    expect(useAuthState().value).toEqual({ user: null, permissions: [], modules: {} })
  })
})

describe('signOut', () => {
  it('meldet ab und führt zur Anmeldung', async () => {
    useAuthState().value = ME
    signOutCall.mockResolvedValue(undefined)

    await useAuth().signOut()

    expect(useAuthState().value.user).toBeNull()
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('nennt den Grund einer automatischen Abmeldung', async () => {
    signOutCall.mockResolvedValue(undefined)
    await useAuth().signOut('idle')
    expect(navigate).toHaveBeenCalledWith('/login?reason=idle', { replace: true })
  })

  it('räumt auch auf, wenn der Server nicht antwortet', async () => {
    // Sonst bliebe der Nutzer in einer Oberfläche, die nicht mehr funktioniert.
    useAuthState().value = ME
    signOutCall.mockRejectedValue(new Error('Netzwerk weg'))

    await expect(useAuth().signOut()).rejects.toThrow()
    expect(useAuthState().value.user).toBeNull()
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})

describe('can', () => {
  it('folgt dem, was der Server geantwortet hat', async () => {
    requestFetch.mockResolvedValue(ME)
    const auth = useAuth()
    await auth.refresh()

    expect(auth.can('customers')).toBe(true)
    expect(auth.can('settings')).toBe(false)
  })

  it('ist ohne Anmeldung überall falsch', () => {
    expect(useAuth().can('customers')).toBe(false)
  })

  it('ist für ein unbekanntes Modul falsch, nicht undefiniert', async () => {
    requestFetch.mockResolvedValue(ME)
    const auth = useAuth()
    await auth.refresh()
    expect(auth.can('tires')).toBe(false)
  })
})

describe('Der veröffentlichte Zustand', () => {
  it('folgt dem Zustand', async () => {
    const auth = useAuth()
    expect(auth.isSignedIn.value).toBe(false)
    expect(auth.user.value).toBeNull()
    expect(auth.permissions.value).toEqual([])

    requestFetch.mockResolvedValue(ME)
    await auth.refresh()

    expect(auth.isSignedIn.value).toBe(true)
    expect(auth.user.value?.username).toBe('mmustermann')
    expect(auth.permissions.value).toEqual(['customers', 'orders'])
  })

  it('nennt die Rollen des Angemeldeten', async () => {
    requestFetch.mockResolvedValue(ME)
    const auth = useAuth()
    await auth.refresh()
    expect(auth.user.value?.roles).toEqual(['Mitarbeiter'])
  })
})
