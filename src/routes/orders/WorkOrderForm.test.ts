import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for WorkOrderForm — pristine render without errors,
 * the required-title rule (button gate + submit-attempt message) and
 * the assignee checkbox toggle feeding `assigneeIds`.
 *
 * @group component
 * @module WorkOrderForm
 */

// The embedded CustomerVehiclePicker calls the picker remotes — mock
// them (and the quick-create commands they can reach) with empty pages.
const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({ run: () => emptyPage() }),
  pickCustomerVehiclesRemote: () => ({ run: () => emptyPage() })
}))
vi.mock('../customers/customers.remote', () => ({
  createCustomerRemote: vi.fn()
}))
vi.mock('../vehicles/vehicles.remote', () => ({ createVehicleRemote: vi.fn() }))

import WorkOrderForm from './WorkOrderForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

const employees = [
  { id: 'emp-1', label: 'Max Schrauber · P-001' },
  { id: 'emp-2', label: 'Erika Werk · P-002' }
]

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

describe('WorkOrderForm', () => {
  it('renders pristine without any error highlight or message', () => {
    const { container } = render(WorkOrderForm, {
      props: { employees, onSave: vi.fn() }
    })
    expect(screen.getByText('Titel *')).toBeInTheDocument()
    expect(screen.getByText('Beschreibung')).toBeInTheDocument()
    expect(screen.getByText('Zugewiesene Mitarbeiter')).toBeInTheDocument()
    // No red field, no alert on first render.
    expect(container.querySelector('.input-error')).toBeNull()
    expect(container.querySelector('.alert-error')).toBeNull()
  })

  it('starts with Speichern disabled while the title is empty', () => {
    render(WorkOrderForm, { props: { employees, onSave: vi.fn() } })
    expect(screen.getByRole('button', { name: /speichern/i })).toBeDisabled()
  })

  it('surfaces the required-title message on a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(WorkOrderForm, {
      props: { employees, onSave }
    })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Der Titel darf nicht leer sein.').length
    ).toBeGreaterThan(0)
  })

  it('enables Speichern once a title is entered and saves trimmed values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(WorkOrderForm, {
      props: { employees, onSave }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()

    const titleInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(titleInput, '  Bremsen erneuern  ')
    expect(btn).not.toBeDisabled()

    await user.click(btn)
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.title).toBe('Bremsen erneuern')
    expect(payload.assigneeIds).toEqual([])
  })

  it('toggles assignees through the checkbox list', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(WorkOrderForm, {
      props: { employees, initial: { title: 'Inspektion' }, onSave }
    })

    await user.click(screen.getByRole('checkbox', { name: /Max Schrauber/i }))
    await user.click(screen.getByRole('checkbox', { name: /Erika Werk/i }))
    // Toggle Max off again — only Erika stays selected.
    await user.click(screen.getByRole('checkbox', { name: /Max Schrauber/i }))

    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].assigneeIds).toEqual(['emp-2'])
  })

  it('pre-checks assignees from initial values', () => {
    render(WorkOrderForm, {
      props: {
        employees,
        initial: { title: 'Inspektion', assigneeIds: ['emp-2'] },
        onSave: vi.fn()
      }
    })
    expect(screen.getByRole('checkbox', { name: /Erika Werk/i })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: /Max Schrauber/i })
    ).not.toBeChecked()
  })

  it('shows the empty-roster hint when no employees exist', () => {
    render(WorkOrderForm, { props: { employees: [], onSave: vi.fn() } })
    expect(screen.getByText(/Keine Mitarbeiter angelegt/)).toBeInTheDocument()
  })
})
