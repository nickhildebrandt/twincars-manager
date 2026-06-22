import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for VehicleForm — mode-based field visibility,
 * required-customer guard in customer mode, the "at least one of …"
 * identifier check, and trimmed-payload behaviour.
 *
 * @group component
 * @module VehicleForm
 */

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import VehicleForm from './VehicleForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

beforeEach(() => {
  formDirty.clear()
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

describe('VehicleForm', () => {
  it('renders the core labels in edit mode', () => {
    render(VehicleForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Marke')).toBeInTheDocument()
    expect(screen.getByText('Modell')).toBeInTheDocument()
    expect(screen.getByText('Kennzeichen')).toBeInTheDocument()
    expect(screen.getByText('FIN')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('hides the Halter (customer) fieldset in stock mode', () => {
    render(VehicleForm, { props: { onSave: vi.fn(), mode: 'stock' } })
    expect(screen.queryByText(/Halter/i)).not.toBeInTheDocument()
  })

  it('shows the Halter (customer) fieldset in customer mode', () => {
    render(VehicleForm, { props: { onSave: vi.fn(), mode: 'customer' } })
    expect(screen.getByText('Halter')).toBeInTheDocument()
  })

  it('keeps Speichern disabled when no identifying field is set', async () => {
    const onSave = vi.fn()
    render(VehicleForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled in customer mode without a customer selected', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(VehicleForm, {
      props: { onSave, mode: 'customer' }
    })
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    await user.type(make, 'VW')
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    // make is set, but customer is missing — the button must stay disabled.
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('emits trimmed make + model and forces customerId=undefined in stock mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(VehicleForm, {
      props: {
        onSave,
        mode: 'stock',
        initial: { customerId: 'should-be-ignored' }
      }
    })
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    const model = container.querySelector(
      'input[maxlength="150"]'
    ) as HTMLInputElement
    await user.type(make, '  Audi  ')
    await user.type(model, '  A4 Avant  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.make).toBe('Audi')
    expect(payload.model).toBe('A4 Avant')
    expect(payload.customerId).toBeUndefined()
  })

  it('passes through licensePlate when nothing else is set', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(VehicleForm, { props: { onSave } })
    const plate = container.querySelector(
      'input[maxlength="20"]'
    ) as HTMLInputElement
    await user.type(plate, '  B-AA 1234  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].licensePlate).toBe('B-AA 1234')
  })

  it('marks dirty on first input and clears on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(VehicleForm, { props: { onSave: vi.fn() } })
    expect(formDirty.dirty).toBe(false)
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    await user.type(make, 'V')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(false)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(VehicleForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-fills make/model from the initial prop', () => {
    const { container } = render(VehicleForm, {
      props: { onSave: vi.fn(), initial: { make: 'Mercedes', model: 'GLA' } }
    })
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    const model = container.querySelector(
      'input[maxlength="150"]'
    ) as HTMLInputElement
    expect(make.value).toBe('Mercedes')
    expect(model.value).toBe('GLA')
  })
})
