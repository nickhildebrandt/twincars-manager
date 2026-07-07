import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for HoursForm — required employee + date + hours,
 * link-kind branching (document / customer / task), max-hours guard,
 * locked-employee read-only path, and the full-page customer-creation
 * flow (draft snapshot, restore, auto-select).
 *
 * @group component
 * @module HoursForm
 */

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

// The picker search closures execute queries via `.run()` (event
// handler context), so the mocks expose the same shape.
const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })

vi.mock('../pickers.remote', () => ({
  pickEmployeesRemote: () => ({ run: () => emptyPage() }),
  pickDocumentsRemote: () => ({ run: () => emptyPage() }),
  pickCustomersRemote: () => ({ run: () => emptyPage() })
}))

import { goto } from '$app/navigation'
import HoursForm from './HoursForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'
import { creationFlow } from '$lib/stores/creation-flow.svelte'

beforeEach(() => {
  formDirty.clear()
  window.sessionStorage.clear()
  // Detach the creationFlow.start spies of previous tests.
  vi.restoreAllMocks()
  creationFlow.reset()
  vi.mocked(goto).mockReset()
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

  it('keeps Speichern enabled without an employee selected (rule 1.1)', () => {
    render(HoursForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the employee error on a click without an employee selected', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(HoursForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte einen Mitarbeiter auswählen.').length
    ).toBeGreaterThan(0)
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
    // The form carries `novalidate`, so the click reaches our German
    // click-time validation instead of the native min=0.25 bubble.
    await user.click(screen.getByRole('button', { name: /speichern/i }))
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
    // The form carries `novalidate`, so the click reaches our German
    // click-time validation instead of the native max=24 bubble.
    await user.click(screen.getByRole('button', { name: /speichern/i }))
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

  it('rejects a click in task link-kind with an empty task', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(HoursForm, {
      props: { onSave, lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte eine Aufgabe eingeben.').length
    ).toBeGreaterThan(0)
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

  it('starts the customer flow with a draft that round-trips and auto-selects the result', async () => {
    const user = userEvent.setup()
    const startSpy = vi.spyOn(creationFlow, 'start')
    const first = render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })

    // Fill some state so the draft has real content to restore.
    const note = first.container.querySelector(
      'textarea'
    ) as HTMLTextAreaElement
    await user.type(note, 'Bremsen geprüft')
    await user.click(screen.getByRole('radio', { name: /^Kunde$/i }))

    // Open the customer picker and hit the header "Neu anlegen" button.
    // The FormField <label> leaks the dialog text into the trigger's
    // accessible name — filter for the real affordance (class btn).
    await user.click(screen.getByText('- Kunde suchen und auswählen -'))
    const createBtn = screen
      .getAllByRole('button', { name: /Neuen Kunden anlegen/ })
      .find((b) => b.className.includes('btn'))
    expect(createBtn).toBeTruthy()
    await user.click(createBtn!)

    // The flow frame carries a serializable draft of the whole form.
    expect(startSpy).toHaveBeenCalledTimes(1)
    const frame = startSpy.mock.calls[0][0]
    expect(frame.entity).toBe('customer')
    expect(frame.originField).toBe('customerId')
    const draft = frame.draft as Record<string, unknown>
    expect(draft.note).toBe('Bremsen geprüft')
    expect(draft.linkKind).toBe('customer')
    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft)
    expect(goto).toHaveBeenCalledWith('/customers/new')
    // Drafted input must not trip the unsaved-changes guard mid-flow.
    expect(formDirty.dirty).toBe(false)

    // Simulate the leaf: create succeeds, back to this page.
    first.unmount()
    creationFlow.finish({ id: 'c9', label: 'Nora Neukund · Berlin' })

    render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    // Draft restored: link kind customer, note text, and the created
    // customer auto-selected in the picker.
    expect(screen.getByText('Kunde *')).toBeInTheDocument()
    const noteRestored = document.querySelector(
      'textarea'
    ) as HTMLTextAreaElement
    expect(noteRestored.value).toBe('Bremsen geprüft')
    expect(screen.getByText('Nora Neukund · Berlin')).toBeInTheDocument()
    expect(formDirty.dirty).toBe(true)
  })

  it('hides the create option while a customer is already being created in the chain', async () => {
    const user = userEvent.setup()
    creationFlow.start({
      entity: 'customer',
      returnUrl: '/somewhere/else',
      originField: 'customerId',
      draft: {},
      createdAt: Date.now()
    })
    render(HoursForm, {
      props: { onSave: vi.fn(), lockedEmployee: { id: 'emp-1', label: 'Test' } }
    })
    await user.click(screen.getByRole('radio', { name: /^Kunde$/i }))
    await user.click(screen.getByText('- Kunde suchen und auswählen -'))
    const affordances = screen
      .queryAllByRole('button', { name: /Neuen Kunden anlegen/ })
      .filter((b) => b.className.includes('btn'))
    expect(affordances).toHaveLength(0)
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

  it('rejects a click when the date is cleared', async () => {
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
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte ein Datum eingeben.').length
    ).toBeGreaterThan(0)
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
