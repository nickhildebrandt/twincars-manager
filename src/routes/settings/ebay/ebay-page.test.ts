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

type Listing = {
  id: string
  ebayItemId: string
  sku: string | null
  title: string
  priceValue: string | null
  priceCurrency: string | null
  quantityAvailable: number | null
  quantitySold: number | null
  listingType: string | null
  status: string
  viewItemUrl: string | null
  galleryUrl: string | null
  pictureUrls: string[]
  startTime: Date | null
  endTime: Date | null
}

type ImportInfo = {
  lastRun: {
    id: string
    startedAt: Date
    finishedAt: Date | null
    status: string
    imported: number
    updated: number
    ended: number
    failed: number
    totalActive: number
    error: string | null
    environment: string
  } | null
  listingCount: number
  activeCount: number
}

const sampleListing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l-1',
  ebayItemId: '110001',
  sku: 'WR-1',
  title: 'Winterreifen Continental 205/55 R16',
  priceValue: '349.00',
  priceCurrency: 'EUR',
  quantityAvailable: 8,
  quantitySold: 2,
  listingType: 'FixedPriceItem',
  status: 'active',
  viewItemUrl: 'https://www.ebay.de/itm/110001',
  galleryUrl: 'https://i.ebayimg.com/gal.jpg',
  pictureUrls: [],
  startTime: new Date('2026-06-01T08:00:00Z'),
  endTime: new Date('2026-09-01T08:00:00Z'),
  ...over
})

let statusValue: Status = { ...baseStatus }
let listingsValue: Listing[] = []
let importInfoValue: ImportInfo = {
  lastRun: null,
  listingCount: 0,
  activeCount: 0
}
const startConnectMock = vi.fn<() => Promise<{ url: string }>>()
const disconnectMock = vi.fn<() => Promise<void>>()
const importMock =
  vi.fn<
    () => Promise<{
      imported: number
      updated: number
      ended: number
      failed: number
    }>
  >()

vi.mock('./ebay.remote', () => ({
  getEbayStatusRemote: () =>
    Object.assign(Promise.resolve(statusValue), {
      current: undefined,
      refresh: () => Promise.resolve()
    }),
  startEbayConnectRemote: () => startConnectMock(),
  disconnectEbayRemote: () =>
    Object.assign(disconnectMock(), { refresh: () => Promise.resolve() }),
  getEbayImportInfoRemote: () =>
    Object.assign(Promise.resolve(importInfoValue), {
      current: undefined,
      refresh: () => Promise.resolve()
    }),
  listEbayListingsRemote: (args: { page: number; size: number }) => {
    const result = {
      items: listingsValue,
      total: listingsValue.length,
      page: args.page,
      size: args.size,
      pageCount: listingsValue.length > 0 ? 1 : 0
    }
    return Object.assign(Promise.resolve(result), {
      current: result,
      error: undefined,
      refresh: () => Promise.resolve()
    })
  },
  importEbayListingsRemote: () => importMock()
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
  listingsValue = []
  importInfoValue = { lastRun: null, listingCount: 0, activeCount: 0 }
  setTestUrl('/settings/ebay')
  startConnectMock.mockReset()
  disconnectMock.mockReset()
  importMock.mockReset()
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

describe('/settings/ebay — listing import (Phase 2)', () => {
  it('disconnected: shows the hint but keeps the import button clickable', async () => {
    await renderPage()

    expect(
      screen.getByText(/Noch kein eBay-Konto verbunden/i)
    ).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Angebote importieren/i })
    // Never disabled for missing prerequisites — click-time errors only.
    expect(button).toBeEnabled()
    expect(screen.getByText(/Noch kein Import durchgeführt/i)).toBeVisible()
  })

  it('successful import surfaces the German count summary as a toast', async () => {
    importMock.mockResolvedValue({
      imported: 3,
      updated: 2,
      ended: 1,
      failed: 0
    })
    const user = userEvent.setup()
    await renderPage()

    await user.click(
      screen.getByRole('button', { name: /Angebote importieren/i })
    )
    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Import abgeschlossen: 3 neu, 2 aktualisiert, 1 beendet.'
      )
    )
  })

  it('failed import shows the curated German error via handleClientError', async () => {
    const { error } = await import('@sveltejs/kit')
    // `error()` returns `never`, so the mock's return type stays
    // assignable to the success shape.
    importMock.mockImplementation(async () =>
      error(
        409,
        'Kein eBay-Konto verbunden. Bitte zuerst unter Einstellungen → eBay verbinden.'
      )
    )
    const user = userEvent.setup()
    await renderPage()

    await user.click(
      screen.getByRole('button', { name: /Angebote importieren/i })
    )
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /Der Angebots-Import ist fehlgeschlagen: Kein eBay-Konto verbunden/
        )
      )
    )
  })

  it('renders the last-run summary and the imported listings table', async () => {
    importInfoValue = {
      lastRun: {
        id: 'r-1',
        startedAt: new Date('2026-07-01T10:00:00Z'),
        finishedAt: new Date('2026-07-01T10:00:05Z'),
        status: 'success',
        imported: 5,
        updated: 1,
        ended: 0,
        failed: 0,
        totalActive: 6,
        error: null,
        environment: 'production'
      },
      listingCount: 6,
      activeCount: 5
    }
    listingsValue = [
      sampleListing(),
      sampleListing({
        id: 'l-2',
        ebayItemId: '110002',
        sku: null,
        title: 'Sommerreifen Michelin',
        status: 'ended'
      })
    ]
    await renderPage()

    const lastImport = screen.getByTestId('last-import')
    expect(lastImport).toHaveTextContent('5 neu')
    expect(lastImport).toHaveTextContent('1 aktualisiert')

    expect(
      screen.getByText('Winterreifen Continental 205/55 R16')
    ).toBeInTheDocument()
    expect(screen.getByText('Sommerreifen Michelin')).toBeInTheDocument()
    // 'Aktiv'/'Beendet' also exist as filter <option>s — assert the badges.
    expect(
      screen.getAllByText('Aktiv').some((el) => el.classList.contains('badge'))
    ).toBe(true)
    expect(
      screen
        .getAllByText('Beendet')
        .some((el) => el.classList.contains('badge'))
    ).toBe(true)
    expect(screen.getByText('110001')).toBeInTheDocument()
  })

  it('a failed last run is announced with its curated error text', async () => {
    importInfoValue = {
      lastRun: {
        id: 'r-2',
        startedAt: new Date('2026-07-01T10:00:00Z'),
        finishedAt: new Date('2026-07-01T10:00:01Z'),
        status: 'failed',
        imported: 0,
        updated: 0,
        ended: 0,
        failed: 0,
        totalActive: 0,
        error:
          'Die eBay-Anmeldung ist abgelaufen oder wurde widerrufen. Bitte die eBay-Verbindung trennen und neu verbinden.',
        environment: 'production'
      },
      listingCount: 0,
      activeCount: 0
    }
    await renderPage()

    const lastImport = screen.getByTestId('last-import')
    expect(lastImport).toHaveTextContent(/fehlgeschlagen/)
    expect(lastImport).toHaveTextContent(/abgelaufen oder wurde widerrufen/)
  })

  it('clicking a listing row opens the eBay offer in a new tab', async () => {
    listingsValue = [sampleListing()]
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(null as unknown as Window)
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByText('Winterreifen Continental 205/55 R16'))
    expect(openSpy).toHaveBeenCalledWith(
      'https://www.ebay.de/itm/110001',
      '_blank',
      'noopener'
    )
    openSpy.mockRestore()
  })

  it('empty state distinguishes "nothing imported yet"', async () => {
    await renderPage()
    expect(
      screen.getByText('Noch keine Angebote importiert')
    ).toBeInTheDocument()
  })
})
