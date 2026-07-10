import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the tabbed customer detail page — the standard
 * TabGroup renders Übersicht / Fahrzeuge / Rechnungen / Aufträge, the
 * related counts appear as badges, and switching tabs keeps every
 * panel's content mounted (tables reachable without a reload).
 *
 * @group component
 * @module customer-detail-tabs
 */

const state = vi.hoisted(() => ({
  orders: [] as Array<{
    id: string
    orderNumber: string
    title: string
    status: string
    vehiclePlate: string | null
    scheduledDate: string | null
    scheduledTime: string | null
  }>
}))

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/customers/c1'),
    params: { id: 'c1' },
    state: {}
  }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }))

vi.mock('../customers.remote', () => ({
  getCustomerRemote: async () => ({
    id: 'c1',
    kind: 'regular',
    customerNumber: 'K-1001',
    company: 'Alpha GmbH',
    salutation: null,
    firstName: null,
    lastName: null,
    street: 'Teststraße 1',
    zip: '10115',
    city: 'Berlin',
    phone: '030 123456',
    mobile: null,
    email: 'info@alpha.example',
    website: null,
    notes: 'Wichtige Notiz',
    ebayHandle: null,
    archived: false,
    wantsBroadcast: false,
    wantsTireReminders: false
  }),
  getCustomerRelatedRemote: async () => ({
    vehicles: [
      {
        id: 'v1',
        make: 'VW',
        model: 'Golf',
        licensePlate: 'B-AB 123',
        firstRegistration: '2019-01-01',
        mileageKm: 50000,
        nextHu: '2026-01-01',
        archived: false
      }
    ],
    invoices: [
      {
        id: 'i1',
        documentNumber: 'RE-2026-0001',
        type: 'invoice',
        status: 'open',
        issueDate: '2026-06-01',
        dueDate: '2026-06-15',
        grossTotal: '119.00'
      }
    ]
  }),
  listCustomerWorkOrdersRemote: async () => ({
    items: state.orders,
    total: state.orders.length,
    page: 1,
    size: 25,
    pageCount: 1
  }),
  sendAdHocCustomerEmailRemote: vi.fn(),
  setCustomerArchivedRemote: vi.fn()
}))

import DetailHost from './DetailHost.svelte'
import { goto } from '$app/navigation'

/** Count badge inside the tab label of the given radio. */
const tabBadge = (name: string): HTMLElement => {
  const label = screen.getByRole('radio', { name }).closest('label')
  expect(label).not.toBeNull()
  return within(label as HTMLElement).getByText(/^\d+$/)
}

beforeEach(() => {
  state.orders = [
    {
      id: 'o1',
      orderNumber: 'AU-2026-0007',
      title: 'Inspektion',
      status: 'in_progress',
      vehiclePlate: 'B-XY 987',
      scheduledDate: '2026-07-03',
      scheduledTime: '09:00'
    },
    {
      id: 'o2',
      orderNumber: 'AU-2026-0008',
      title: 'Reifenwechsel',
      status: 'done',
      vehiclePlate: null,
      scheduledDate: null,
      scheduledTime: null
    }
  ]
  vi.mocked(goto).mockClear()
})

describe('customer detail tabs', () => {
  it('renders the four detail tabs with count badges', async () => {
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Übersicht' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fahrzeuge' })).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Rechnungen' })
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Aufträge' })).toBeInTheDocument()
    // Related counts as badges (1 vehicle, 1 invoice, 2 orders).
    expect(tabBadge('Fahrzeuge')).toHaveTextContent('1')
    expect(tabBadge('Rechnungen')).toHaveTextContent('1')
    expect(tabBadge('Aufträge')).toHaveTextContent('2')
  })

  it('keeps master data and related tables mounted across tab switches', async () => {
    const user = userEvent.setup()
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    // Übersicht content.
    expect(screen.getByText('Anschrift')).toBeInTheDocument()
    expect(screen.getByText('Wichtige Notiz')).toBeInTheDocument()
    // Related panels stay mounted (DaisyUI hides them via CSS).
    expect(screen.getByText('B-AB 123')).toBeInTheDocument()
    expect(screen.getByText('RE-2026-0001')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Fahrzeuge' }))
    expect(screen.getByRole('radio', { name: 'Fahrzeuge' })).toBeChecked()
    expect(screen.getByText('B-AB 123')).toBeInTheDocument()
  })

  it('keeps the global actions (email, archive) outside the tabs', async () => {
    render(DetailHost)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /e-mail schreiben/i })
      ).toBeInTheDocument()
    )
    expect(
      screen.getByRole('button', { name: /archivieren/i })
    ).toBeInTheDocument()
  })
})

describe('customer detail tabs — Aufträge tab', () => {
  it('renders the work orders with German status labels and plate', async () => {
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(screen.getByText('AU-2026-0007')).toBeInTheDocument()
    expect(screen.getByText('Inspektion')).toBeInTheDocument()
    expect(screen.getByText('In Bearbeitung')).toBeInTheDocument()
    expect(screen.getByText('Abgeschlossen')).toBeInTheDocument()
    expect(screen.getByText('B-XY 987')).toBeInTheDocument()
    // Termin renders date + optional start time.
    expect(screen.getByText('03.07.2026, 09:00')).toBeInTheDocument()
  })

  it('navigates to the order detail when a row is clicked', async () => {
    const user = userEvent.setup()
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    await user.click(screen.getByRole('radio', { name: 'Aufträge' }))
    await user.click(screen.getByText('AU-2026-0007'))
    expect(goto).toHaveBeenCalledWith('/orders/o1')
  })

  it('shows the German empty state without orders', async () => {
    state.orders = []
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(tabBadge('Aufträge')).toHaveTextContent('0')
    expect(
      screen.getByText('Bisher keine Aufträge für diesen Kunden.')
    ).toBeInTheDocument()
  })
})
