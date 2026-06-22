import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for HoursForm — required employee + date + hours,
 * link-kind branching (document / customer / task), max-hours guard
 * and locked-employee read-only path.
 *
 * @group component
 * @module HoursForm
 */

vi.mock('../pickers.remote', () => ({
  pickEmployeesRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  }),
  pickDocumentsRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  }),
  pickCustomersRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import HoursForm from './HoursForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

beforeEach(() => {
  formDirty.clear()
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

describe('HoursForm', () => {
  it('renders the core labels and three link-kind radios', () => {
    render(HoursForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Mitarbeiter *')).toBeInTheDocument()
    expect(screen.getByText('Datum *')).toBeInTheDocument()
    expect(screen.getByText('Stunden *')).toBeInTheDocument()
    // Three link-kind radios.
    expect(
      screen.getByRole('radio', { name: /Auftrag \/ Rechnung/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Kunde/i })).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: /Freie Aufgabe/i })
    ).toBeInTheDocument()
  })

  it('keeps Speichern disabled without an employee selected', async () => {
    const onSave = vi.fn()
    render(HoursForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects when the hours field is set to zero', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: {
        onSave,
        lockedEmployee: { id: 'emp-1', label: 'Max Mustermann' },
        initial: { task: 'Reinigung' }
      }
    })
    const hoursInput = container.querySelector(
      'input[type="number"][min="0.25"]'
    ) as HTMLInputElement
    await user.clear(hoursInput)
    await user.type(hoursInput, '0')
    // The type=number input has min=0.25 — jsdom blocks button-click
    // submit on invalid HTML5 values. Fire the submit event directly.
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getByText(/positive Stundenzahl eingeben/i)
    ).toBeInTheDocument()
  })

  it('rejects when hours exceeds 24', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: {
        onSave,
        lockedEmployee: { id: 'emp-1', label: 'Max Mustermann' },
        initial: { task: 'Reinigung' }
      }
    })
    const hoursInput = container.querySelector(
      'input[type="number"][min="0.25"]'
    ) as HTMLInputElement
    await user.clear(hoursInput)
    await user.type(hoursInput, '25')
    // type=number max=24 → jsdom marks the form invalid on click; fire
    // submit directly.
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/Maximal 24 Stunden/i)).toBeInTheDocument()
  })

  it('renders the locked-employee field read-only and submits the locked id', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: {
        onSave,
        lockedEmployee: { id: 'emp-locked', label: 'Erika Locked' },
        initial: { task: 'Werkstattorganisation' }
      }
    })
    // The locked input is a readonly <input> with the employee label.
    const lockedInput = container.querySelector(
      'input[readonly]'
    ) as HTMLInputElement
    expect(lockedInput).toBeTruthy()
    expect(lockedInput.value).toBe('Erika Locked')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].employeeId).toBe('emp-locked')
    expect(onSave.mock.calls[0][0].task).toBe('Werkstattorganisation')
  })

  it('keeps Speichern disabled in task link-kind with empty task', async () => {
    const onSave = vi.fn()
    render(HoursForm, {
      props: { onSave, lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('emits trimmed task as the task value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: { onSave, lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    const taskInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(taskInput, '  Werkstattorga  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.task).toBe('Werkstattorga')
    expect(payload.documentId).toBeNull()
    expect(payload.customerId).toBeNull()
  })

  it('switching linkKind to "customer" hides the task input', async () => {
    const user = userEvent.setup()
    render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    // Default kind = task → input visible.
    expect(screen.getByText('Aufgabe *')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Kunde$/i }))
    expect(screen.queryByText('Aufgabe *')).not.toBeInTheDocument()
    expect(screen.getByText('Kunde *')).toBeInTheDocument()
  })

  it('marks dirty on first input and clears on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    expect(formDirty.dirty).toBe(false)
    const taskInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(taskInput, 'X')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(false)
  })

  it('disables Speichern when date is cleared', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: {
        onSave,
        lockedEmployee: { id: 'emp-1', label: 'Test' },
        initial: { task: 'X' }
      }
    })
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement
    await user.clear(dateInput)
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(HoursForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
