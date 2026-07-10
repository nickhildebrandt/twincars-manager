import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the tabbed vehicle detail page — the standard
 * TabGroup with the STOCK-conditional tab set: Fotos tab and the
 * Verkaufsschild action exist only for stock vehicles
 * (`customerId === null`), the Halter tab plus the Ankauf action only
 * for customer-owned vehicles. Plus the always-present Aufträge tab
 * (paginated work orders) and Historie tab (Ankauf / Verkauf /
 * Kennzeichen events).
 *
 * @group component
 * @module vehicle-detail-tabs
 */

const state = vi.hoisted(() => ({
  customerId: null as string | null,
  photosCalls: 0,
  orders: [] as Array<{
    id: string
    orderNumber: string
    title: string
    status: string
    scheduledDate: string | null
    scheduledTime: string | null
    completedAt: Date | null
  }>,
  history: [] as Array<{
    id: string
    kind: 'purchase' | 'sale' | 'plate'
    date: string
    amount: string | null
    counterpartLabel: string | null
    customerId: string | null
    licensePlate: string | null
  }>
}))

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/vehicles/v1'),
    params: { id: 'v1' },
    state: {}
  }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }))

vi.mock('../vehicles.remote', () => ({
  getVehicleRemote: async () => ({
    id: 'v1',
    customerId: state.customerId,
    make: 'VW',
    model: 'Golf',
    licensePlate: 'B-AB 123',
    vin: 'WVWZZZ1KZ6W000001',
    firstRegistration: '2019-01-01',
    mileageKm: 50000,
    nextHu: '2026-01-01',
    hsn: '0603',
    tsn: 'BJM',
    displacementCcm: 1998,
    powerKw: 110,
    fuelType: 'Benzin',
    gearbox: 'Schaltgetriebe',
    bodyType: 'Limousine',
    notes: null,
    archived: false,
    previousOwnerCustomerId: null,
    previousOwnerLabel: null
  }),
  getVehicleRelatedRemote: async () => ({
    customer: state.customerId
      ? {
          customerId: state.customerId,
          customerNumber: 'K-1001',
          company: 'Alpha GmbH',
          firstName: null,
          lastName: null,
          phone: '030 123456',
          email: 'info@alpha.example'
        }
      : null,
    invoices: { items: [], total: 0, page: 1, size: 25, pageCount: 0 }
  }),
  listVehicleWorkOrdersRemote: async () => ({
    items: state.orders,
    total: state.orders.length,
    page: 1,
    size: 25,
    pageCount: 1
  }),
  getVehicleHistoryRemote: async () => state.history,
  listVehiclePhotosRemote: async () => {
    state.photosCalls += 1
    return []
  },
  addVehiclePhotoRemote: vi.fn(),
  deleteVehiclePhotoRemote: vi.fn(),
  setMainVehiclePhotoRemote: vi.fn(),
  setVehicleArchivedRemote: vi.fn(),
  purchaseVehicleIntoStockRemote: vi.fn()
}))

vi.mock('../sale-sign.remote', () => ({ getVehicleSaleSignPdfRemote: vi.fn() }))

vi.mock('../vehicle-documents.remote', () => ({
  listVehicleDocumentsRemote: async () => [],
  getVehicleDocumentRemote: vi.fn(),
  uploadVehicleDocumentRemote: vi.fn(),
  deleteVehicleDocumentRemote: vi.fn()
}))

import DetailHost from './DetailHost.svelte'
import { goto } from '$app/navigation'

const renderPage = async () => {
  render(DetailHost)
  await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
}

/** Count badge inside the tab label of the given radio. */
const tabBadge = (name: string): HTMLElement => {
  const label = screen.getByRole('radio', { name }).closest('label')
  expect(label).not.toBeNull()
  return within(label as HTMLElement).getByText(/^\d+$/)
}

beforeEach(() => {
  state.customerId = null
  state.photosCalls = 0
  state.orders = []
  state.history = []
  vi.mocked(goto).mockClear()
})

describe('vehicle detail tabs — stock vehicle (customerId === null)', () => {
  it('shows the Fotos tab and the Verkaufsschild action, no Halter tab', async () => {
    await renderPage()
    expect(screen.getByRole('radio', { name: 'Übersicht' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fotos' })).toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: 'Halter' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /verkaufsschild drucken/i })
    ).toBeInTheDocument()
    // Ankauf is a customer-vehicle action.
    expect(
      screen.queryByRole('button', { name: /ankauf/i })
    ).not.toBeInTheDocument()
    // Photos are fetched for stock vehicles.
    expect(state.photosCalls).toBe(1)
  })

  it('keeps Rechnungen, Dokumente and the archive action available', async () => {
    await renderPage()
    expect(
      screen.getByRole('radio', { name: 'Rechnungen' })
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dokumente' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /archivieren/i })
    ).toBeInTheDocument()
  })
})

describe('vehicle detail tabs — customer-owned vehicle', () => {
  beforeEach(() => {
    state.customerId = 'c1'
  })

  it('hides Fotos tab and Verkaufsschild, shows Halter tab and Ankauf', async () => {
    await renderPage()
    expect(
      screen.queryByRole('radio', { name: 'Fotos' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /verkaufsschild/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Halter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ankauf/i })).toBeInTheDocument()
    // No photo fetch for customer vehicles (server guard is stock-only).
    expect(state.photosCalls).toBe(0)
  })

  it('renders the compact holder card with a link to the customer', async () => {
    await renderPage()
    expect(screen.getByText('Alpha GmbH')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Kunden' })).toHaveAttribute(
      'href',
      '/customers/c1'
    )
  })
})

describe('vehicle detail tabs — Aufträge tab', () => {
  beforeEach(() => {
    state.orders = [
      {
        id: 'o1',
        orderNumber: 'AU-2026-0001',
        title: 'Bremsen erneuern',
        status: 'open',
        scheduledDate: '2026-07-01',
        scheduledTime: '08:30',
        completedAt: null
      },
      {
        id: 'o2',
        orderNumber: 'AU-2026-0002',
        title: 'Zahnriemen',
        status: 'done',
        scheduledDate: null,
        scheduledTime: null,
        completedAt: new Date('2026-07-02T12:00:00Z')
      }
    ]
  })

  it('shows the tab with the order count badge and German status labels', async () => {
    await renderPage()
    expect(screen.getByRole('radio', { name: 'Aufträge' })).toBeInTheDocument()
    expect(tabBadge('Aufträge')).toHaveTextContent('2')
    // Panel content stays mounted (state-mode TabGroup).
    expect(screen.getByText('AU-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('Bremsen erneuern')).toBeInTheDocument()
    expect(screen.getByText('Offen')).toBeInTheDocument()
    expect(screen.getByText('Abgeschlossen')).toBeInTheDocument()
    // Termin renders date + optional start time.
    expect(screen.getByText('01.07.2026, 08:30')).toBeInTheDocument()
  })

  it('navigates to the order detail when a row is clicked', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('radio', { name: 'Aufträge' }))
    await user.click(screen.getByText('AU-2026-0001'))
    expect(goto).toHaveBeenCalledWith('/orders/o1')
  })

  it('shows the German empty state without orders', async () => {
    state.orders = []
    await renderPage()
    expect(tabBadge('Aufträge')).toHaveTextContent('0')
    expect(
      screen.getByText('Keine Aufträge für dieses Fahrzeug.')
    ).toBeInTheDocument()
  })
})

describe('vehicle detail tabs — Historie tab', () => {
  beforeEach(() => {
    state.history = [
      {
        id: 'sale-s1',
        kind: 'sale',
        date: '2026-03-05',
        amount: '7990.00',
        counterpartLabel: 'Neu Käufer',
        customerId: 'c9',
        licensePlate: null
      },
      {
        id: 'plate-p1',
        kind: 'plate',
        date: '2026-02-01',
        amount: null,
        counterpartLabel: null,
        customerId: null,
        licensePlate: 'KI-XY 1'
      },
      {
        id: 'purchase-pu1',
        kind: 'purchase',
        date: '2026-01-10',
        amount: '4500.00',
        counterpartLabel: 'Alt Besitzer',
        customerId: null,
        licensePlate: null
      }
    ]
  })

  it('renders the merged history with German event labels', async () => {
    await renderPage()
    expect(screen.getByRole('radio', { name: 'Historie' })).toBeInTheDocument()
    expect(tabBadge('Historie')).toHaveTextContent('3')
    // Ankauf row: rename-proof snapshot, plain text, with amount.
    expect(screen.getByText('Ankauf von Alt Besitzer')).toBeInTheDocument()
    // Verkauf row: buyer as a live customer link.
    const buyerLink = screen.getByRole('link', { name: 'Neu Käufer' })
    expect(buyerLink).toHaveAttribute('href', '/customers/c9')
    // Kennzeichen row.
    expect(screen.getByText('KI-XY 1')).toBeInTheDocument()
  })

  it('shows the German empty state without history', async () => {
    state.history = []
    await renderPage()
    expect(
      screen.getByText('Noch keine Historie für dieses Fahrzeug.')
    ).toBeInTheDocument()
  })
})
