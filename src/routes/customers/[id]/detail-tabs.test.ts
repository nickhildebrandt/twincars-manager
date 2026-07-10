import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

/**
 * Component tests for the tabbed customer detail page — the standard
 * TabGroup renders Übersicht / Fahrzeuge / Rechnungen, the related
 * counts appear as badges, and switching tabs keeps every panel's
 * content mounted (tables reachable without a reload).
 *
 * @group component
 * @module customer-detail-tabs
 */

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
  sendAdHocCustomerEmailRemote: vi.fn(),
  setCustomerArchivedRemote: vi.fn()
}))

import DetailHost from './DetailHost.svelte'

describe('customer detail tabs', () => {
  it('renders the three detail tabs with count badges', async () => {
    render(DetailHost)
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Übersicht' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fahrzeuge' })).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Rechnungen' })
    ).toBeInTheDocument()
    // Related counts as badges (1 vehicle, 1 invoice).
    expect(screen.getAllByText('1')).toHaveLength(2)
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
