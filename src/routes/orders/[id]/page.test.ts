import { render, screen, waitFor } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the work-order detail page — the Arbeitserfassung
 * lock: while an active invoice exists the item editing affordances are
 * hidden and the German lock hint (Storno path) renders; after a Storno
 * (order reopened, no active invoice) the editing form returns. Also
 * asserts the invoice-history card lists Storno + new invoice.
 *
 * @group component
 * @module orders-detail-page
 */

type Detail = Record<string, unknown>

const detailHolder = vi.hoisted(() => ({ detail: null as Detail | null }))

vi.mock('$app/state', () => ({ page: { params: { id: 'wo-1' } } }))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 100, pageCount: 1 })

vi.mock('../../pickers.remote', () => ({
  pickEmployeesRemote: () =>
    Object.assign(emptyPage(), { run: () => emptyPage() }),
  pickItemsRemote: () => ({ run: () => emptyPage() })
}))

// The detail query proxy: thenable for the page's top-level await AND
// `.current` for the reactive read — both serve the fixture.
vi.mock('../orders.remote', () => ({
  getWorkOrderRemote: () => ({
    get current() {
      return detailHolder.detail
    },
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve(detailHolder.detail).then(resolve),
    refresh: async () => undefined,
    withOverride: () => ({})
  }),
  getLaborRateRemote: () => Promise.resolve(null),
  addWorkOrderItemRemote: vi.fn(),
  updateWorkOrderItemRemote: vi.fn(),
  deleteWorkOrderItemRemote: vi.fn(),
  deleteWorkOrderRemote: vi.fn(),
  moveWorkOrderStatusRemote: vi.fn(),
  completeWorkOrderRemote: vi.fn()
}))

import DetailHost from './DetailHost.svelte'

const baseOrder = {
  id: 'wo-1',
  orderNumber: 'AU-2026-0001',
  title: 'Bremsen erneuern',
  description: null,
  status: 'in_progress',
  customerId: null,
  vehicleId: null,
  appointmentId: null,
  invoiceId: null as string | null,
  scheduledDate: null,
  scheduledTime: null,
  completedAt: null as Date | null,
  createdAt: new Date('2026-07-06T08:00:00Z'),
  updatedAt: new Date('2026-07-06T08:00:00Z')
}

const materialItem = {
  id: 'item-1',
  workOrderId: 'wo-1',
  position: 1,
  kind: 'material',
  itemId: null,
  description: 'Bremsscheibe',
  quantity: '2',
  unit: 'Stk',
  unitPriceNet: '45.00',
  employeeId: null,
  hours: null,
  doneAt: '2026-07-06',
  createdAt: new Date('2026-07-06T08:00:00Z'),
  updatedAt: new Date('2026-07-06T08:00:00Z')
}

const invoiceRef = (
  id: string,
  documentNumber: string,
  status: string
): Record<string, unknown> => ({
  id,
  documentNumber,
  status,
  issueDate: '2026-07-06',
  grossTotal: '107.10',
  cancelledAt: status === 'cancelled' ? new Date() : null
})

const makeDetail = (overrides: {
  order?: Partial<typeof baseOrder>
  invoices?: Array<Record<string, unknown>>
  invoiceNumber?: string | null
}): Detail => ({
  order: { ...baseOrder, ...(overrides.order ?? {}) },
  items: [materialItem],
  assignees: [],
  customerLabel: null,
  vehicleLabel: null,
  appointmentTitle: null,
  invoiceNumber: overrides.invoiceNumber ?? null,
  invoices: overrides.invoices ?? []
})

const renderPage = async () => {
  const result = render(DetailHost)
  await waitFor(() =>
    expect(screen.queryByTestId('page-pending')).not.toBeInTheDocument()
  )
  return result
}

beforeEach(() => {
  // jsdom does not implement <dialog>; minimal stubs for the pickers.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  }
})

describe('orders detail page — Arbeitserfassung lock', () => {
  it('locks items and shows the German hint while an active invoice exists', async () => {
    detailHolder.detail = makeDetail({
      order: {
        status: 'done',
        invoiceId: 'inv-2',
        completedAt: new Date('2026-07-08T10:00:00Z')
      },
      invoiceNumber: 'RE-2026-0002',
      invoices: [
        invoiceRef('inv-1', 'RE-2026-0001', 'cancelled'),
        invoiceRef('storno-1', 'S-0001', 'storno'),
        invoiceRef('inv-2', 'RE-2026-0002', 'created')
      ]
    })
    await renderPage()

    // Lock hint (mode gate, mirrors the server 409).
    expect(
      screen.getByText(
        /Positionen sind gesperrt, solange eine gültige Rechnung existiert/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Stornieren Sie die Rechnung, um Änderungen/)
    ).toBeInTheDocument()

    // Editing affordances are gone: no add form, no per-item actions,
    // no completion CTA.
    expect(
      screen.queryByRole('button', { name: /Position hinzufügen/i })
    ).not.toBeInTheDocument()
    expect(screen.queryAllByLabelText('Position bearbeiten')).toHaveLength(0)
    expect(screen.queryAllByLabelText('Position löschen')).toHaveLength(0)
    expect(
      screen.queryByRole('button', {
        name: /Abschließen & Rechnung erstellen/i
      })
    ).not.toBeInTheDocument()

    // Invoice history: cancelled original, Storno and active invoice
    // all listed with their numbers and German status badges.
    expect(screen.getByText('RE-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('S-0001')).toBeInTheDocument()
    expect(screen.getAllByText('RE-2026-0002').length).toBeGreaterThan(0)
    expect(screen.getByText('Storniert')).toBeInTheDocument()
    expect(screen.getByText('Stornorechnung')).toBeInTheDocument()
  })

  it('unlocks item editing again after the Storno reopened the order', async () => {
    detailHolder.detail = makeDetail({
      order: { status: 'in_progress', invoiceId: null },
      invoices: [
        invoiceRef('inv-1', 'RE-2026-0001', 'cancelled'),
        invoiceRef('storno-1', 'S-0001', 'storno')
      ]
    })
    await renderPage()

    // No lock hint, the add form and the completion CTA are back.
    expect(
      screen.queryByText(/Positionen sind gesperrt/)
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Position hinzufügen/i })
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText('Position bearbeiten').length).toBe(2)
    expect(
      screen.getByRole('button', { name: /Abschließen & Rechnung erstellen/i })
    ).toBeInTheDocument()

    // The history keeps the Storno visible (GoBD traceability).
    expect(screen.getByText('S-0001')).toBeInTheDocument()
    expect(screen.getByText('Stornorechnung')).toBeInTheDocument()
  })
})
