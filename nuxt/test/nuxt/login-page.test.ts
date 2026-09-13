/**
 * Die Anmeldeseite.
 *
 * Geprüft wird das, was hier schiefgehen kann: das Ziel nach der Anmeldung
 * (B-002, B-056), die einheitliche Fehlermeldung und der Hinweis nach einer
 * Abmeldung wegen Untätigkeit.
 */
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import LoginPage from '~/pages/login.vue'

const { signIn, navigate, query } = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
  query: { value: {} as Record<string, string> },
}))

mockNuxtImport('useRoute', () => () => ({ query: query.value, path: '/login', fullPath: '/login' }))
mockNuxtImport('navigateTo', () => navigate)
mockNuxtImport('useAuth', () => () => ({ signIn }))

const mount = (routeQuery: Record<string, string> = {}) => {
  query.value = routeQuery
  signIn.mockReset()
  navigate.mockReset()
  signIn.mockResolvedValue({ ok: true })
  return mountSuspended(LoginPage)
}

/** Fills the form and submits it. */
async function submit(page: Awaited<ReturnType<typeof mount>>, username = 'mmustermann') {
  await page.find('[data-testid="login-username"]').setValue(username)
  await page.find('[data-testid="login-password"]').setValue('ein-gutes-passwort')
  await page.find('[data-testid="login-form"]').trigger('submit')
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('Das Formular', () => {
  it('fragt Benutzername und Passwort', async () => {
    const page = await mount()
    expect(page.find('[data-testid="login-username"]').exists()).toBe(true)
    expect(page.find('[data-testid="login-password"]').exists()).toBe(true)
  })

  it('verbirgt das Passwort', async () => {
    const page = await mount()
    expect(page.find('[data-testid="login-password"]').attributes('type')).toBe('password')
  })

  it('setzt den Testselektor auf das Eingabefeld selbst, nicht auf eine Nuxt-UI-Klasse', async () => {
    const page = await mount()
    expect(page.find('[data-testid="login-username"]').element.tagName).toBe('INPUT')
  })

  it('zeigt ohne Grund keinen Hinweis', async () => {
    const page = await mount()
    expect(page.find('[data-testid="login-reason"]').exists()).toBe(false)
    expect(page.find('[data-testid="login-error"]').exists()).toBe(false)
  })
})

describe('Nach der Abmeldung wegen Untätigkeit', () => {
  it('erklärt, warum die Sitzung endete', async () => {
    const page = await mount({ reason: 'idle' })
    expect(page.find('[data-testid="login-reason"]').text()).toContain('Untätigkeit')
  })

  it('erfindet für einen unbekannten Grund keinen Text', async () => {
    const page = await mount({ reason: 'irgendwas' })
    expect(page.find('[data-testid="login-reason"]').exists()).toBe(false)
  })
})

describe('Das Ziel nach der Anmeldung', () => {
  it('führt ohne Angabe zur Startseite', async () => {
    const page = await mount()
    await submit(page)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('führt zum gewünschten eigenen Ziel', async () => {
    const page = await mount({ redirectTo: '/customers?page=2' })
    await submit(page)
    expect(navigate).toHaveBeenCalledWith('/customers?page=2', { replace: true })
  })

  it.each([
    ['//evil.example', 'protokollrelativ'],
    ['/\\evil.example', 'Backslash — der Browser liest ihn als Schrägstrich'],
    ['https://evil.example', 'vollständige Adresse'],
    ['javascript:alert(1)', 'Skript-Schema'],
  ])('weist %s ab (%s)', async (target) => {
    // B-002, B-056: der Vorgänger hätte hier auf eine fremde Seite geführt —
    // mit gültiger Sitzung in der Hand.
    const page = await mount({ redirectTo: target })
    await submit(page)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})

describe('Wenn die Anmeldung scheitert', () => {
  it('zeigt die Meldung und leitet nicht weiter', async () => {
    const page = await mount()
    signIn.mockResolvedValue({ ok: false, message: 'Benutzername oder Passwort ist falsch.' })

    await submit(page)

    expect(page.find('[data-testid="login-error"]').text())
      .toContain('Benutzername oder Passwort ist falsch.')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('leert das Passwortfeld, nicht den Benutzernamen', async () => {
    const page = await mount()
    signIn.mockResolvedValue({ ok: false, message: 'Benutzername oder Passwort ist falsch.' })

    await submit(page, 'mmustermann')

    expect((page.find('[data-testid="login-username"]').element as HTMLInputElement).value)
      .toBe('mmustermann')
    expect((page.find('[data-testid="login-password"]').element as HTMLInputElement).value)
      .toBe('')
  })
})
