import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tick } from 'svelte'

/**
 * Component tests for the AppShell — the single global loading bar and
 * slow overlay (busy store), permission-filtered sidebar navigation,
 * the user menu, the global-search triggers (navbar + Cmd/Ctrl+K), the
 * unsaved-changes guard dialog and the pageHeader-driven top bar
 * (title, back button, primary action).
 *
 * SvelteKit runtime pieces are mocked: `$app/stores` provides a manual
 * page store, `$app/navigation` records the beforeNavigate callback so
 * tests can simulate a cancelled navigation.
 *
 * @group component
 * @module AppShell
 */

type BeforeNav = { type: string; cancel: () => void; to: { url: URL } | null }

const mocks = vi.hoisted(() => {
  let pageValue = { url: new URL('http://localhost/') }
  const subscribers = new Set<(v: typeof pageValue) => void>()
  return {
    gotoMock: vi.fn(),
    signOutMock: vi.fn<() => Promise<void>>(),
    startIdleLogoutMock: vi.fn((_config: unknown) => () => {}),
    handleClientErrorMock: vi.fn(),
    searchMock: vi.fn(),
    navCallbacks: {
      before: null as ((nav: BeforeNav) => void) | null,
      after: null as ((nav: unknown) => void) | null
    },
    pageStore: {
      subscribe(fn: (v: typeof pageValue) => void) {
        subscribers.add(fn)
        fn(pageValue)
        return () => subscribers.delete(fn)
      },
      setUrl(url: string) {
        pageValue = { url: new URL(url) }
        for (const fn of subscribers) fn(pageValue)
      }
    }
  }
})

vi.mock('$app/navigation', () => ({
  goto: (...args: unknown[]) => mocks.gotoMock(...args),
  beforeNavigate: (cb: (nav: BeforeNav) => void) => {
    mocks.navCallbacks.before = cb
  },
  afterNavigate: (cb: (nav: unknown) => void) => {
    mocks.navCallbacks.after = cb
  }
}))

vi.mock('$app/stores', () => ({ page: mocks.pageStore }))

vi.mock('$lib/client/auth-client', () => ({
  authClient: { signOut: () => mocks.signOutMock() }
}))

vi.mock('$lib/stores/idle-logout.svelte', () => ({
  startIdleLogout: (config: unknown) => mocks.startIdleLogoutMock(config)
}))

vi.mock('$lib/utils/client-error', () => ({
  handleClientError: (...args: unknown[]) =>
    mocks.handleClientErrorMock(...args)
}))

// GlobalSearch (child) talks to the search remote — inert stub.
vi.mock('../../../routes/search.remote', () => ({
  globalSearchRemote: (args: { q: string }) => ({
    run: () => mocks.searchMock(args)
  })
}))

import AppShell from './AppShell.svelte'
import { busy } from '$lib/stores/busy.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'
import { pageHeader } from '$lib/stores/page-title.svelte'

const adminUser = {
  id: 'u1',
  username: 'admin',
  name: 'Anna Admin',
  permissions: ['*']
}

beforeEach(() => {
  mocks.gotoMock.mockReset()
  mocks.signOutMock.mockReset().mockResolvedValue(undefined)
  mocks.startIdleLogoutMock.mockClear()
  mocks.handleClientErrorMock.mockReset()
  mocks.searchMock.mockReset()
  mocks.navCallbacks.before = null
  mocks.navCallbacks.after = null
  mocks.pageStore.setUrl('http://localhost/')
  pageHeader.reset()
  formDirty.clear()
})

afterEach(() => {
  pageHeader.reset()
  formDirty.clear()
})

const navLabels = () =>
  Array.from(document.querySelectorAll('aside nav a span')).map(
    (s) => s.textContent
  )

describe('AppShell — global loading bar & overlay', () => {
  it('hides the loading bar while idle and shows it while busy', async () => {
    render(AppShell, { props: { currentUser: adminUser } })
    const bar = screen.getByTestId('global-loading-bar')
    expect(bar).toHaveClass('opacity-0')
    expect(bar).toHaveAttribute('aria-hidden', 'true')

    const end = busy.begin()
    await tick()
    expect(bar).toHaveClass('opacity-100')
    expect(bar).toHaveAttribute('aria-hidden', 'false')
    // The bar is the single loading bar — exactly one progress element.
    expect(document.querySelectorAll('progress')).toHaveLength(1)

    end()
    await tick()
    expect(bar).toHaveClass('opacity-0')
  })

  it('mounts the inert overlay only after an operation turns slow (≥ 250 ms)', async () => {
    const { container } = render(AppShell, {
      props: { currentUser: adminUser }
    })
    const main = container.querySelector('main') as HTMLElement & {
      inert: boolean
    }
    const end = busy.begin()
    try {
      await tick()
      // Fast window: bar only, no overlay, main stays interactive.
      expect(main.inert).toBe(false)
      expect(main.getAttribute('aria-busy')).toBe('false')

      await waitFor(() => expect(busy.slow).toBe(true), { timeout: 1000 })
      await tick()
      expect(main.getAttribute('aria-busy')).toBe('true')
      // Svelte assigns `inert` as a DOM property; jsdom mirrors it there.
      expect(main.inert).toBe(true)
      expect(screen.getByText('Inhalte werden geladen')).toBeInTheDocument()
    } finally {
      end()
    }
    await tick()
    expect(main.inert).toBe(false)
    expect(screen.queryByText('Inhalte werden geladen')).not.toBeInTheDocument()
  })
})

describe('AppShell — sidebar navigation & user block', () => {
  it('filters nav items by the current user permissions', () => {
    render(AppShell, {
      props: { currentUser: { ...adminUser, permissions: ['customers'] } }
    })
    const labels = navLabels()
    expect(labels).toContain('Kunden')
    expect(labels).not.toContain('Fahrzeuge')
    expect(labels).not.toContain('Einstellungen')
  })

  it('shows the full navigation for the wildcard permission', () => {
    render(AppShell, { props: { currentUser: adminUser } })
    const labels = navLabels()
    expect(labels).toContain('Kunden')
    expect(labels).toContain('Fahrzeuge')
    expect(labels).toContain('Einstellungen')
    expect(labels).toContain('Offene Rechnungen')
  })

  it('falls back to the bare Start item without any permissions', () => {
    render(AppShell, { props: { currentUser: null } })
    expect(navLabels()).toEqual(['Start'])
    // No signed-in user — no user menu either.
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument()
  })

  it('renders company name, user identity and the profile link', () => {
    render(AppShell, {
      props: { currentUser: adminUser, companyName: 'Twin Cars GmbH' }
    })
    expect(screen.getByText('Twin Cars GmbH')).toBeInTheDocument()
    expect(screen.getByText('Anna Admin')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Profil/ })).toHaveAttribute(
      'href',
      '/settings/account'
    )
  })

  it('arms the 1 h idle logout only for signed-in users', () => {
    render(AppShell, { props: { currentUser: adminUser } })
    expect(mocks.startIdleLogoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 60 * 60 * 1000 })
    )
  })

  it('Abmelden signs out via the auth client', async () => {
    // Reject so the flow stops before the jsdom-unsupported full-page
    // redirect; the curated German base message goes to the central
    // client-error handler.
    mocks.signOutMock.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    await user.click(screen.getByRole('button', { name: /Abmelden/ }))
    await waitFor(() => expect(mocks.signOutMock).toHaveBeenCalledTimes(1))
    expect(mocks.handleClientErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      'Abmeldung fehlgeschlagen.'
    )
  })
})

describe('AppShell — global search triggers', () => {
  it('opens the global search from the navbar trigger', async () => {
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    expect(screen.queryByTestId('global-search-dialog')).toBeNull()
    await user.click(screen.getByTestId('global-search-trigger'))
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
  })

  it('opens the global search via Ctrl+K from anywhere', async () => {
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    // Non-Mac platform (jsdom) shows the Strg+K hint.
    expect(screen.getByText('Strg+K')).toBeInTheDocument()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
  })
})

describe('AppShell — unsaved-changes guard', () => {
  const simulateNavigation = (href: string) => {
    const cancel = vi.fn()
    mocks.navCallbacks.before!({
      type: 'link',
      cancel,
      to: { url: new URL(`http://localhost${href}`) }
    })
    return cancel
  }

  it('lets navigation pass when no form is dirty', () => {
    render(AppShell, { props: { currentUser: adminUser } })
    const cancel = simulateNavigation('/customers')
    expect(cancel).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Ungespeicherte Änderungen')
    ).not.toBeInTheDocument()
  })

  it('cancels navigation and re-targets it after Verwerfen', async () => {
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    formDirty.set(true)

    const cancel = simulateNavigation('/customers?page=2')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('Ungespeicherte Änderungen')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?'
      )
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Verwerfen', hidden: true })
    )
    // The form state is cleared BEFORE the retargeted goto (house rule).
    expect(formDirty.dirty).toBe(false)
    expect(mocks.gotoMock).toHaveBeenCalledWith('/customers?page=2')
  })

  it('Bleiben keeps the dirty form and does not navigate', async () => {
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    formDirty.set(true)
    simulateNavigation('/vehicles')
    await screen.findByText('Ungespeicherte Änderungen')

    await user.click(
      screen.getByRole('button', { name: 'Bleiben', hidden: true })
    )
    expect(formDirty.dirty).toBe(true)
    expect(mocks.gotoMock).not.toHaveBeenCalled()
  })
})

describe('AppShell — top bar (title, back, primary action)', () => {
  it('derives the page title from the route when no PageHeader is set', async () => {
    render(AppShell, { props: { currentUser: adminUser } })
    mocks.pageStore.setUrl('http://localhost/customers')
    await tick()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Kunden')
  })

  it('falls back to the app name on unknown routes', async () => {
    render(AppShell, { props: { currentUser: adminUser } })
    mocks.pageStore.setUrl('http://localhost/does-not-exist')
    await tick()
    expect(screen.getByTestId('page-title')).toHaveTextContent(
      'TwinCarsManager'
    )
  })

  it('prefers an explicit pageHeader title over the route title', async () => {
    render(AppShell, { props: { currentUser: adminUser } })
    mocks.pageStore.setUrl('http://localhost/customers')
    pageHeader.set({ title: 'Kunde bearbeiten' })
    await tick()
    expect(screen.getByTestId('page-title')).toHaveTextContent(
      'Kunde bearbeiten'
    )
  })

  it('shows the Zurück button only with a back target and invokes it', async () => {
    const user = userEvent.setup()
    render(AppShell, { props: { currentUser: adminUser } })
    expect(
      screen.queryByRole('button', { name: /Zurück/ })
    ).not.toBeInTheDocument()

    const back = vi.fn()
    pageHeader.set({ title: 'Detail', back })
    await tick()
    await user.click(screen.getByRole('button', { name: /Zurück/ }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('renders an href primary action as a link', async () => {
    render(AppShell, { props: { currentUser: adminUser } })
    pageHeader.set({
      title: 'Kunden',
      primaryAction: { label: 'Neuer Kunde', href: '/customers/new' }
    })
    await tick()
    const action = screen.getByTestId('header-primary-action')
    expect(action.tagName).toBe('A')
    expect(action).toHaveAttribute('href', '/customers/new')
    expect(action).toHaveTextContent('Neuer Kunde')
  })

  it('invokes an onClick primary action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(AppShell, { props: { currentUser: adminUser } })
    pageHeader.set({
      title: 'Kunden',
      primaryAction: { label: 'Aktion', onClick }
    })
    await tick()
    await user.click(screen.getByTestId('header-primary-action'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
