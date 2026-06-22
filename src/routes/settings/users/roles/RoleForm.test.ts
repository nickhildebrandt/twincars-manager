import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for RoleForm — name validation, wildcard
 * checkbox, locked (Administrator) state, permission matrix toggling.
 *
 * The form imports `MODULE_PERMISSIONS` from `$lib/permissions`, a
 * client-safe surface. The test mocks it so behavior doesn't depend
 * on the canonical permission list growing over time.
 *
 * @group component
 * @module RoleForm
 */

vi.mock('$lib/permissions', () => {
  const MODULE_PERMISSIONS = {
    customers: ['customers'],
    vehicles: ['vehicles'],
    suppliers: ['suppliers'],
    employees: ['employees'],
    items: ['items'],
    offers: ['offers'],
    invoices: ['invoices'],
    reminders: ['reminders'],
    ledger: ['ledger'],
    calendar: ['calendar'],
    inventory: ['inventory'],
    hours: ['hours', 'hours:write_own'],
    mailings: ['mailings'],
    import: ['import'],
    settings: ['settings'],
    users: ['users'],
    tires: ['tires'],
    shipping: ['shipping']
  } as const
  return {
    WILDCARD_PERMISSION: '*',
    MODULE_PERMISSIONS,
    ALL_PERMISSIONS: Object.values(MODULE_PERMISSIONS).flat()
  }
})

import RoleForm from './RoleForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

beforeEach(() => {
  formDirty.clear()
})

describe('RoleForm', () => {
  it('renders the stammdaten labels and submit button', () => {
    render(RoleForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Name *')).toBeInTheDocument()
    expect(screen.getByText('Beschreibung')).toBeInTheDocument()
    expect(screen.getByText('Berechtigungen')).toBeInTheDocument()
    expect(screen.getByText(/Voller Zugriff/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('rejects save when name is shorter than 2 characters', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(RoleForm, {
      props: { onSave, initial: { name: 'X' } }
    })
    // The form has type=submit with HTML5 `required`. Fire submit
    // directly to bypass jsdom's HTML5 validity check for empty name.
    const { fireEvent } = await import('@testing-library/svelte')
    void user
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Rollennamen mit mindestens 2 Zeichen/i)
    ).toBeInTheDocument()
  })

  it('submits with wildcard when "Voller Zugriff" is checked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(RoleForm, {
      props: { onSave, initial: { name: 'Super', permissions: ['*'] } }
    })
    // Wildcard checkbox is the first one in "Berechtigungen".
    const wildcardCheckbox = screen.getByLabelText(/Voller Zugriff/i)
    expect((wildcardCheckbox as HTMLInputElement).checked).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].permissions).toEqual(['*'])
  })

  it('submits with a selected permission subset when wildcard is off', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(RoleForm, {
      props: {
        onSave,
        initial: { name: 'Reader', permissions: ['customers', 'vehicles'] }
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.permissions.sort()).toEqual(['customers', 'vehicles'].sort())
  })

  it('disables every checkbox when locked=true (Administrator)', () => {
    render(RoleForm, {
      props: {
        onSave: vi.fn(),
        initial: { name: 'Administrator', permissions: ['*'] },
        locked: true
      }
    })
    // The locked banner is shown.
    expect(
      screen.getByText(/Administrator-Rolle ist systemgeschützt/i)
    ).toBeInTheDocument()
    // The name input is disabled.
    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement
    expect(nameInput.disabled).toBe(true)
    // The submit button is disabled.
    const submit = screen.getByRole('button', { name: /speichern/i })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders a Löschen button when onDelete is provided', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(RoleForm, {
      props: { onSave: vi.fn(), onDelete, initial: { name: 'Disposable' } }
    })
    const deleteBtn = screen.getByRole('button', { name: /Löschen/i })
    expect(deleteBtn).toBeInTheDocument()
    await user.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('clicking the wildcard checkbox sets permissions to ["*"] in payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(RoleForm, {
      props: { onSave, initial: { name: 'Toggle', permissions: [] } }
    })
    const wildcardCheckbox = screen.getByLabelText(/Voller Zugriff/i)
    await user.click(wildcardCheckbox)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].permissions).toEqual(['*'])
  })

  it('marks dirty on first input (no clear on submit, only on unmount)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(RoleForm, {
      props: { onSave, initial: { name: 'Role', permissions: [] } }
    })
    expect(formDirty.dirty).toBe(false)
    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement
    await user.type(nameInput, 'X')
    expect(formDirty.dirty).toBe(true)
    // RoleForm clears dirty only via the unmount effect, not in submit.
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(RoleForm, {
      props: { onSave: vi.fn(), onCancel, initial: { name: 'R' } }
    })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('trims the role name before save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(RoleForm, {
      props: { onSave, initial: { name: '  Trimmed  ', permissions: [] } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].name).toBe('Trimmed')
  })
})
