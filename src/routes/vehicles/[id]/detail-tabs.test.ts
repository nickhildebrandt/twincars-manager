import { render, screen, waitFor } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the tabbed vehicle detail page — the standard
 * TabGroup with the STOCK-conditional tab set: Fotos tab and the
 * Verkaufsschild action exist only for stock vehicles
 * (`customerId === null`), the Halter tab plus the Ankauf action only
 * for customer-owned vehicles.
 *
 * @group component
 * @module vehicle-detail-tabs
 */

const state = vi.hoisted(() => ({
  customerId: null as string | null,
  photosCalls: 0
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

const renderPage = async () => {
  render(DetailHost)
  await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
}

beforeEach(() => {
  state.customerId = null
  state.photosCalls = 0
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
