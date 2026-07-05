import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component + accessibility tests for the eBay settings page: the
 * three states (unconfigured / disconnected / connected) expose their
 * information through proper ARIA roles and accessible names, the
 * connect click navigates to the consent URL, disconnect requires the
 * confirm dialog, and the OAuth-callback flags surface as toasts.
 *
 * @group component
 * @module ebay
 */

type Status = {
  configured: boolean
  missingConfig: string[]
  environment: 'production' | 'sandbox'
  connected: boolean
  ebayUsername: string | null
  connectedAt: Date | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
}

const baseStatus: Status = {
  configured: true,
  missingConfig: [],
  environment: 'production',
  connected: false,
  ebayUsername: null,
  connectedAt: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null
}

let statusValue: Status = { ...baseStatus }
const startConnectMock = vi.fn<() => Promise<{ url: string }>>()
const disconnectMock = vi.fn<() => Promise<void>>()

vi.mock('./ebay.remote', () => ({
  getEbayStatusRemote: () =>
    Object.assign(Promise.resolve(statusValue), {
      current: undefined,
      refresh: () => Promise.resolve()
    }),
  startEbayConnectRemote: () => startConnectMock(),
  disconnectEbayRemote: () =>
    Object.assign(disconnectMock(), { refresh: () => Promise.resolve() })
}))

const replaceStateMock = vi.fn()
vi.mock('$app/navigation', () => ({
  replaceState: (...args: unknown[]) => replaceStateMock(...args)
}))

// The page reads the OAuth round-trip flags from window.location in a
// deferred onMount handler (see the page comment on hydration
// recovery) — tests set the jsdom URL via history.replaceState.
const setTestUrl = (pathAndQuery: string) =>
  window.history.replaceState({}, '', pathAndQuery)

const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()
vi.mock('$lib/stores/toast.svelte', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: (...a: unknown[]) => toastErrorMock(...a),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

import EbayHost from './EbayHost.svelte'

const renderPage = async () => {
  const result = render(EbayHost)
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /eBay-Verkäuferkonto/i })
    ).toBeInTheDocument()
  )
  return result
}

beforeEach(() => {
  statusValue = { ...baseStatus }
  setTestUrl('/settings/ebay')
  startConnectMock.mockReset()
  disconnectMock.mockReset()
  replaceStateMock.mockReset()
  toastSuccessMock.mockReset()
  toastErrorMock.mockReset()
})

describe('/settings/ebay — states & accessibility', () => {
  it('unconfigured: announces the missing env vars via role="alert", no connect button', async () => {
    statusValue = {
      ...baseStatus,
      configured: false,
      missingConfig: ['EBAY_CLIENT_ID', 'EBAY_CERT_ID', 'EBAY_RU_NAME']
    }
    await renderPage()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('EBAY_CLIENT_ID')
    expect(alert).toHaveTextContent('EBAY_CERT_ID')
    expect(
      screen.queryByRole('button', { name: /Mit eBay verbinden/i })
    ).toBeNull()
  })

  it('disconnected: offers an accessible connect button and navigates to the consent URL', async () => {
    startConnectMock.mockResolvedValue({
      url: 'https://auth.ebay.com/oauth2/authorize?client_id=x'
    })
    // jsdom's window.location cannot be assigned — intercept via a
    // writable stub so the click handler's redirect is observable.
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, href: original.href },
      writable: true,
      configurable: true
    })

    const user = userEvent.setup()
    await renderPage()

    const button = screen.getByRole('button', { name: /Mit eBay verbinden/i })
    await user.click(button)
    await waitFor(() => expect(startConnectMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(window.location.href).toContain('auth.ebay.com/oauth2/authorize')
    )
    Object.defineProperty(window, 'location', {
      value: original,
      configurable: true
    })
  })

  it('connected: announces the connection via role="status" incl. username', async () => {
    statusValue = {
      ...baseStatus,
      connected: true,
      ebayUsername: 'twincast-seller',
      connectedAt: new Date('2026-06-23T10:00:00Z'),
      accessTokenExpiresAt: new Date('2026-06-23T12:00:00Z'),
      refreshTokenExpiresAt: new Date('2027-12-23T10:00:00Z')
    }
    await renderPage()

    const statusEl = screen.getByRole('status')
    expect(statusEl).toHaveTextContent('twincast-seller')
    expect(
      screen.getByRole('button', { name: /Verbindung trennen/i })
    ).toBeInTheDocument()
  })

  it('disconnect goes through the confirm dialog before calling the remote', async () => {
    statusValue = { ...baseStatus, connected: true, ebayUsername: 's' }
    disconnectMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage()

    await user.click(
      screen.getByRole('button', { name: /Verbindung trennen/i })
    )
    expect(disconnectMock).not.toHaveBeenCalled()

    // Confirm inside the dialog. jsdom treats <dialog> without the
    // `open` attribute as hidden (DaisyUI shows it via the modal-open
    // class instead), so the role query must include hidden elements.
    await user.click(
      await screen.findByRole('button', { name: /^Trennen$/i, hidden: true })
    )
    await waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1))
  })

  it('sandbox environment is visibly badged', async () => {
    statusValue = { ...baseStatus, environment: 'sandbox' }
    await renderPage()
    expect(screen.getByText('Sandbox')).toBeInTheDocument()
  })

  it('?connected=1 surfaces a success toast and strips the flag shallowly', async () => {
    setTestUrl('/settings/ebay?connected=1')
    await renderPage()
    // The handler is deferred (~150 ms) to survive hydration recovery.
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled(), {
      timeout: 2000
    })
    expect(replaceStateMock).toHaveBeenCalledWith('/settings/ebay', {})
  })

  it('?error=state surfaces the expired-request error toast', async () => {
    setTestUrl('/settings/ebay?error=state')
    await renderPage()
    await waitFor(
      () =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          expect.stringMatching(/abgelaufen|ungültig/i)
        ),
      { timeout: 2000 }
    )
  })
})
