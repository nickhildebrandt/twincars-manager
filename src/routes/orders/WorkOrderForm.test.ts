import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for WorkOrderForm — pristine render, the
 * always-enabled submit button (rule 1.1) with click-time German
 * errors, the customer-OR-vehicle link rule, the auto-composed title,
 * the date-gated time input and the assignee multi-picker round-trip.
 *
 * @group component
 * @module WorkOrderForm
 */

// The embedded pickers call the picker remotes — mock them (and the
// quick-create commands they can reach) with empty pages.
const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({ run: () => emptyPage() }),
  pickCustomerVehiclesRemote: () => ({ run: () => emptyPage() }),
  pickEmployeesRemote: () => ({ run: () => emptyPage() })
}))
vi.mock('../customers/customers.remote', () => ({
  createCustomerRemote: vi.fn()
}))
vi.mock('../vehicles/vehicles.remote', () => ({ createVehicleRemote: vi.fn() }))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

import WorkOrderForm from './WorkOrderForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'
import { creationFlow } from '$lib/stores/creation-flow.svelte'

const LINK_ERROR = 'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'

const titleInput = (container: HTMLElement): HTMLInputElement =>
  container.querySelector('input[maxlength="200"]') as HTMLInputElement

beforeEach(() => {
  formDirty.clear()
  creationFlow.reset()
  window.sessionStorage.clear()
  // jsdom does not implement <dialog>; provide minimal stubs so the
  // pickers can mount.
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

describe('WorkOrderForm', () => {
  it('renders pristine without any error highlight or message', () => {
    const { container } = render(WorkOrderForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Titel *')).toBeInTheDocument()
    expect(screen.getByText('Beschreibung')).toBeInTheDocument()
    expect(screen.getByText('Zugewiesene Mitarbeiter')).toBeInTheDocument()
    // No red field, no alert on first render.
    expect(container.querySelector('.input-error')).toBeNull()
    expect(container.querySelector('.alert-error')).toBeNull()
  })

  it('keeps Speichern enabled even while the form is invalid (rule 1.1)', () => {
    render(WorkOrderForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the link rule error on submit without customer or vehicle', async () => {
    const onSave = vi.fn()
    const { container } = render(WorkOrderForm, {
      props: { initial: { title: 'Inspektion' }, onSave }
    })
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getAllByText(LINK_ERROR).length).toBeGreaterThan(0)
  })

  it('surfaces the required-title message on a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(WorkOrderForm, { props: { onSave } })
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Der Titel darf nicht leer sein.').length
    ).toBeGreaterThan(0)
  })

  it('saves with only a vehicle linked (customer optional)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(WorkOrderForm, {
      props: {
        initial: {
          title: 'Bremsen erneuern',
          vehicleId: 'veh-1',
          vehicleLabel: 'B-XY 123 · VW Golf'
        },
        onSave
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.vehicleId).toBe('veh-1')
    expect(payload.customerId).toBeUndefined()
  })

  it('auto-composes the title from vehicle and customer labels', () => {
    const { container } = render(WorkOrderForm, {
      props: {
        initial: {
          customerId: 'cust-1',
          customerLabel: 'Müller · Berlin',
          vehicleId: 'veh-1',
          vehicleLabel: 'B-AA 100 · VW Golf VII · Müller'
        },
        onSave: vi.fn()
      }
    })
    expect(titleInput(container).value).toBe('VW Golf VII · B-AA 100 · Müller')
  })

  it('stops auto-composing once the user types and resumes when cleared', async () => {
    const user = userEvent.setup()
    const { container } = render(WorkOrderForm, {
      props: {
        initial: {
          customerId: 'cust-1',
          customerLabel: 'Müller · Berlin',
          vehicleId: 'veh-1',
          vehicleLabel: 'B-AA 100 · VW Golf VII · Müller'
        },
        onSave: vi.fn()
      }
    })
    const input = titleInput(container)
    expect(input.value).toBe('VW Golf VII · B-AA 100 · Müller')

    // Manual input arms manual mode; the field stays as typed.
    await user.clear(input)
    expect(input.value).toBe('')
    await user.type(input, 'Eigener Titel')
    expect(input.value).toBe('Eigener Titel')

    // Clearing completely re-arms auto mode — the next picker change
    // recomposes (here: clearing the vehicle leaves the customer).
    await user.clear(input)
    const clearButtons = screen.getAllByRole('button', {
      name: 'Auswahl entfernen'
    })
    await user.click(clearButtons[1])
    expect(input.value).toBe('Müller')
  })

  it('keeps an initial title untouched (edit mode)', () => {
    const { container } = render(WorkOrderForm, {
      props: {
        initial: {
          title: 'Handgeschrieben',
          vehicleId: 'veh-1',
          vehicleLabel: 'B-AA 100 · VW Golf VII'
        },
        onSave: vi.fn()
      }
    })
    expect(titleInput(container).value).toBe('Handgeschrieben')
  })

  it('disables the time input until a date is set', async () => {
    const { container } = render(WorkOrderForm, { props: { onSave: vi.fn() } })
    const timeInput = container.querySelector(
      'input[type="time"]'
    ) as HTMLInputElement
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement
    expect(timeInput).toBeDisabled()
    await fireEvent.input(dateInput, { target: { value: '2026-07-10' } })
    expect(timeInput).not.toBeDisabled()
  })

  it('round-trips initial assignees through the multi-picker', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(WorkOrderForm, {
      props: {
        initial: {
          title: 'Inspektion',
          customerId: 'cust-1',
          customerLabel: 'Mustermann GmbH',
          assignees: [
            { id: 'emp-1', label: 'Max Schrauber · P-001' },
            { id: 'emp-2', label: 'Erika Werk · P-002' }
          ]
        },
        onSave
      }
    })
    // The trigger shows the joined labels for up to two selections.
    expect(
      screen.getByText('Max Schrauber · P-001, Erika Werk · P-002')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].assigneeIds).toEqual(['emp-1', 'emp-2'])
  })

  describe('creation flow (vehicle leaf with holder)', () => {
    it('hands the picked customer to the vehicle leaf as leafInitial', async () => {
      const user = userEvent.setup()
      const startSpy = vi.spyOn(creationFlow, 'start')
      render(WorkOrderForm, {
        props: {
          initial: {
            customerId: 'cust-1',
            customerLabel: 'Alpha GmbH · Berlin'
          },
          onSave: vi.fn()
        }
      })
      await user.click(screen.getByText('Fahrzeug dieses Kunden suchen'))
      const createBtn = screen
        .getAllByRole('button', { name: /Neues Fahrzeug anlegen/ })
        .filter((b) => b.className.includes('btn'))[0]
      await user.click(createBtn)

      expect(startSpy).toHaveBeenCalledTimes(1)
      const frame = startSpy.mock.calls[0][0]
      expect(frame.entity).toBe('vehicle')
      expect(frame.leafInitial).toEqual({
        customerId: 'cust-1',
        customerLabel: 'Alpha GmbH · Berlin'
      })
      startSpy.mockRestore()
    })

    it("re-syncs the customer to the created vehicle's holder on return", () => {
      creationFlow.start({
        entity: 'vehicle',
        returnUrl: window.location.pathname + window.location.search,
        originField: 'vehicleId',
        draft: {
          title: '',
          titleTouched: false,
          description: '',
          customerId: 'cust-1',
          customerLabel: 'Alpha GmbH · Berlin',
          vehicleId: '',
          vehicleLabel: '',
          scheduledDate: '',
          scheduledTime: '',
          assigneeIds: [],
          assigneeLabels: []
        },
        createdAt: Date.now(),
        leafInitial: {
          customerId: 'cust-1',
          customerLabel: 'Alpha GmbH · Berlin'
        }
      })
      // The leaf saved the vehicle under a DIFFERENT holder.
      creationFlow.finish({
        id: 'veh-9',
        label: 'B-XY 9 · Opel Corsa',
        holder: { id: 'cust-2', label: 'Beta GmbH · Hamburg' }
      })

      const { container } = render(WorkOrderForm, {
        props: { onSave: vi.fn() }
      })
      // Vehicle auto-selected, customer re-synced to the holder.
      expect(screen.getByText('B-XY 9 · Opel Corsa')).toBeInTheDocument()
      expect(screen.getByText('Beta GmbH · Hamburg')).toBeInTheDocument()
      expect(screen.queryByText('Alpha GmbH · Berlin')).toBeNull()
      // The auto-title composes with the synced holder, not the stale one.
      expect(titleInput(container).value).toBe(
        'Opel Corsa · B-XY 9 · Beta GmbH'
      )
    })

    it('keeps the customer when the created vehicle has the same holder', () => {
      creationFlow.start({
        entity: 'vehicle',
        returnUrl: window.location.pathname + window.location.search,
        originField: 'vehicleId',
        draft: {
          title: '',
          titleTouched: false,
          description: '',
          customerId: 'cust-1',
          customerLabel: 'Alpha GmbH · Berlin',
          vehicleId: '',
          vehicleLabel: '',
          scheduledDate: '',
          scheduledTime: '',
          assigneeIds: [],
          assigneeLabels: []
        },
        createdAt: Date.now()
      })
      creationFlow.finish({
        id: 'veh-9',
        label: 'B-XY 9 · Opel Corsa',
        holder: { id: 'cust-1', label: 'Alpha GmbH · Berlin' }
      })

      render(WorkOrderForm, { props: { onSave: vi.fn() } })
      expect(screen.getByText('B-XY 9 · Opel Corsa')).toBeInTheDocument()
      expect(screen.getByText('Alpha GmbH · Berlin')).toBeInTheDocument()
    })
  })
})
