import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the shared CalendarForm — kind selector only in
 * `new` mode, the validity gate, the appointment payload including the
 * overlap-confirm flow (with `excludeId` in edit mode) and the closure
 * branch (no overlap check, all-day payload).
 *
 * @group component
 * @module CalendarForm
 */

// Overlap lookup — hoisted so the module mock below can reference it.
const { overlapsMock } = vi.hoisted(() => ({ overlapsMock: vi.fn() }))

vi.mock('./calendar.remote', () => ({
  findOverlappingAppointmentsRemote: (args: unknown) => ({
    run: () => overlapsMock(args)
  })
}))

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

import CalendarForm from './CalendarForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

beforeEach(() => {
  formDirty.clear()
  overlapsMock.mockReset()
  overlapsMock.mockResolvedValue([])
  // jsdom does not implement <dialog>; provide minimal stubs so the
  // SearchablePicker can mount.
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

const appointmentInitial = {
  id: 'entry-1',
  kind: 'appointment' as const,
  title: 'Inspektion Müller',
  allDay: false,
  startsAt: new Date('2026-07-10T09:00:00'),
  endsAt: new Date('2026-07-10T10:00:00'),
  status: 'scheduled',
  customerId: null,
  customerLabel: null,
  vehicleId: null,
  vehicleLabel: null,
  employeeId: null,
  employeeLabel: null,
  notes: null
}

describe('CalendarForm', () => {
  it('new mode shows the kind selector and gates Speichern on the title', () => {
    render(CalendarForm, { props: { mode: 'new', onSave: vi.fn() } })
    expect(screen.getByLabelText('Art *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /speichern/i })).toBeDisabled()
  })

  it('edit mode hides the kind selector and seeds from initial', () => {
    render(CalendarForm, {
      props: { mode: 'edit', initial: appointmentInitial, onSave: vi.fn() }
    })
    expect(screen.queryByLabelText('Art *')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Titel *')).toHaveValue('Inspektion Müller')
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('saves an appointment with trimmed values when no overlap exists', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CalendarForm, { props: { mode: 'new', onSave } })

    await user.type(screen.getByLabelText('Titel *'), '  Ölwechsel  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const payload = onSave.mock.calls[0][0]
    expect(payload.kind).toBe('appointment')
    expect(payload.title).toBe('Ölwechsel')
    expect(payload.allDay).toBe(false)
    expect(payload.status).toBe('scheduled')
    expect(overlapsMock).toHaveBeenCalledTimes(1)
  })

  it('passes the entry id as excludeId to the overlap check in edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CalendarForm, {
      props: { mode: 'edit', initial: appointmentInitial, onSave }
    })

    await user.click(screen.getByRole('button', { name: /speichern/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(overlapsMock).toHaveBeenCalledWith(
      expect.objectContaining({ excludeId: 'entry-1' })
    )
  })

  it('opens the collision dialog and saves only after confirmation', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    overlapsMock.mockResolvedValue([
      {
        id: 'other-1',
        title: 'Reifenwechsel',
        startsAt: '2026-07-10T09:30:00',
        endsAt: '2026-07-10T10:30:00'
      }
    ])
    render(CalendarForm, {
      props: { mode: 'edit', initial: appointmentInitial, onSave }
    })

    await user.click(screen.getByRole('button', { name: /speichern/i }))

    expect(await screen.findByText('Terminkollision')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    // jsdom keeps <dialog> content aria-hidden — locate the confirm
    // button by its text and dispatch the click directly.
    await fireEvent.click(await screen.findByText('Trotzdem speichern'))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].kind).toBe('appointment')
  })

  it('saves a closure as all-day date range without an overlap check', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CalendarForm, { props: { mode: 'new', onSave } })

    await user.selectOptions(screen.getByLabelText('Art *'), 'closure')
    await user.type(screen.getByLabelText('Titel *'), 'Betriebsurlaub')
    await fireEvent.input(screen.getByLabelText('Von *'), {
      target: { value: '2026-08-03' }
    })
    await fireEvent.input(screen.getByLabelText('Bis *'), {
      target: { value: '2026-08-07' }
    })

    await user.click(screen.getByRole('button', { name: /speichern/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toEqual({
      kind: 'closure',
      title: 'Betriebsurlaub',
      startsAt: '2026-08-03',
      endsAt: '2026-08-07',
      allDay: true,
      notes: undefined
    })
    expect(overlapsMock).not.toHaveBeenCalled()
  })

  it('disables Speichern when the closure end date is before the start', async () => {
    const user = userEvent.setup()
    render(CalendarForm, { props: { mode: 'new', onSave: vi.fn() } })

    await user.selectOptions(screen.getByLabelText('Art *'), 'closure')
    await user.type(screen.getByLabelText('Titel *'), 'Betriebsurlaub')
    await fireEvent.input(screen.getByLabelText('Von *'), {
      target: { value: '2026-08-07' }
    })
    await fireEvent.input(screen.getByLabelText('Bis *'), {
      target: { value: '2026-08-03' }
    })

    expect(screen.getByRole('button', { name: /speichern/i })).toBeDisabled()
  })
})
