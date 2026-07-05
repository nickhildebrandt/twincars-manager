import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
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

const createCustomerMock = vi.fn()

// HoursForm awaits the picker queries directly (no `.run()`), so the
// mocks must be plain promises resolving to an empty result page.
const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })

vi.mock('../pickers.remote', () => ({
  pickEmployeesRemote: () => emptyPage(),
  pickDocumentsRemote: () => emptyPage(),
  pickCustomersRemote: () => emptyPage()
}))

// The inline quick-create form inside the customer picker calls the real
// customer create command — mock the remote module.
vi.mock('../customers/customers.remote', () => ({
  createCustomerRemote: (args: unknown) => createCustomerMock(args)
}))

import HoursForm from './HoursForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

beforeEach(() => {
  formDirty.clear()
  createCustomerMock.mockReset()
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
    // The message shows in the alert and under the field.
    expect(
      screen.getAllByText(/positive Stundenzahl eingeben/i).length
    ).toBeGreaterThan(0)
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
    // The message shows in the alert and under the field.
    expect(screen.getAllByText(/Maximal 24 Stunden/i).length).toBeGreaterThan(0)
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

  it('creates a customer inline from the customer picker and selects it', async () => {
    const user = userEvent.setup()
    createCustomerMock.mockResolvedValue({
      id: 'c9',
      company: null,
      firstName: 'Nora',
      lastName: 'Neukund',
      customerNumber: 'K-9',
      city: 'Berlin'
    })
    render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })

    await user.click(screen.getByRole('radio', { name: /^Kunde$/i }))
    // The trigger's accessible name is the FormField label ("Kunde *")
    // — click the placeholder text inside it instead.
    await user.click(screen.getByText('- Kunde suchen und auswählen -'))
    // Several matches: the FormField <label> leaks the dialog text into
    // the trigger's accessible name, and the affordance shows twice
    // (footer + empty state). Click a real affordance button (class
    // btn), not the trigger (class input).
    const createBtn = screen
      .getAllByRole('button', { name: /Neuen Kunden anlegen/ })
      .find((b) => b.className.includes('btn'))
    expect(createBtn).toBeTruthy()
    await user.click(createBtn!)
    await user.type(screen.getByLabelText('Nachname'), 'Neukund')
    await user.click(screen.getByRole('button', { name: 'Kunde anlegen' }))

    await waitFor(() =>
      expect(screen.getByText('Nora Neukund · Berlin')).toBeInTheDocument()
    )
    expect(createCustomerMock).toHaveBeenCalledWith({
      lastName: 'Neukund',
      firstName: undefined,
      company: undefined,
      phone: undefined
    })
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

  it('keeps a pristine form free of error messages', () => {
    render(HoursForm, { props: { onSave: vi.fn() } })
    expect(
      screen.queryByText(/Bitte einen Mitarbeiter auswählen/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Bitte eine Aufgabe eingeben/i)
    ).not.toBeInTheDocument()
  })

  it('shows the task error only after blur', async () => {
    const { container } = render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    const taskInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    expect(
      screen.queryByText('Bitte eine Aufgabe eingeben.')
    ).not.toBeInTheDocument()
    await fireEvent.blur(taskInput)
    expect(screen.getByText('Bitte eine Aufgabe eingeben.')).toBeInTheDocument()
    expect(taskInput.className).toContain('input-error')
  })

  it('surfaces the employee error after a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(HoursForm, {
      props: { onSave, initial: { task: 'Reinigung' } }
    })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Bitte einen Mitarbeiter auswählen/i).length
    ).toBeGreaterThan(0)
  })
})
