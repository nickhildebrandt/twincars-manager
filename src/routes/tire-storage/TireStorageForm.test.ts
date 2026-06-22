import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for TireStorageForm — customer/season required,
 * quantity bounds, photo state, dirty-flag transitions.
 *
 * @group component
 * @module TireStorageForm
 */

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  }),
  pickVehiclesRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import TireStorageForm from './TireStorageForm.svelte'
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

describe('TireStorageForm', () => {
  it('renders the expected fields and submit button', () => {
    render(TireStorageForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Kunde *')).toBeInTheDocument()
    expect(screen.getByText('Fahrzeug (optional)')).toBeInTheDocument()
    expect(screen.getByText('Saison *')).toBeInTheDocument()
    expect(screen.getByText('Reifengröße')).toBeInTheDocument()
    expect(screen.getByText('Marke')).toBeInTheDocument()
    expect(screen.getByText('Stückzahl')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('keeps Speichern disabled when no customer is selected', async () => {
    const onSave = vi.fn()
    render(TireStorageForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled when no season is selected', async () => {
    const onSave = vi.fn()
    render(TireStorageForm, {
      props: { onSave, initial: { customerId: 'cust-1' } }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects when initial quantity exceeds 20', async () => {
    const onSave = vi.fn()
    const { container } = render(TireStorageForm, {
      props: {
        onSave,
        initial: { customerId: 'cust-1', season: 'summer', quantity: 50 }
      }
    })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Stückzahl muss zwischen 1 und 20/i)
    ).toBeInTheDocument()
  })

  it('emits trimmed brand/model/size and numeric quantity', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(TireStorageForm, {
      props: { onSave, initial: { customerId: 'cust-1', season: 'summer' } }
    })
    const brand = container.querySelector(
      'input[maxlength="80"]'
    ) as HTMLInputElement
    const model = container.querySelector(
      'input[maxlength="120"]'
    ) as HTMLInputElement
    const sizeInput = container.querySelector(
      'input[maxlength="40"]'
    ) as HTMLInputElement
    await user.type(brand, '  Michelin  ')
    await user.type(model, ' Pilot Sport  ')
    await user.type(sizeInput, ' 205/55 R16 ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.brand).toBe('Michelin')
    expect(payload.model).toBe('Pilot Sport')
    expect(payload.size).toBe('205/55 R16')
    expect(payload.quantity).toBe(4) // default
    expect(payload.season).toBe('summer')
    expect(payload.customerId).toBe('cust-1')
  })

  it('marks dirty on first input and clears on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(TireStorageForm, {
      props: {
        onSave: vi.fn(),
        initial: { customerId: 'cust-1', season: 'summer' }
      }
    })
    expect(formDirty.dirty).toBe(false)
    const brand = container.querySelector(
      'input[maxlength="80"]'
    ) as HTMLInputElement
    await user.type(brand, 'M')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(false)
  })

  it('omits empty profile / dotYear from the payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireStorageForm, {
      props: { onSave, initial: { customerId: 'cust-1', season: 'winter' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.profileMm).toBeUndefined()
    expect(payload.dotYear).toBeUndefined()
    expect(payload.season).toBe('winter')
  })

  it('parses a numeric profile mm initial value back into the payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    // Seed profileMm via `initial` so the form's String(...) coercion
    // is exercised consistently for the initial state path.
    render(TireStorageForm, {
      props: {
        onSave,
        initial: { customerId: 'cust-1', season: 'summer', profileMm: 7.5 }
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    // numOrUndef on the initial string '7.5' returns 7.5.
    expect(payload.profileMm).toBe(7.5)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(TireStorageForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
