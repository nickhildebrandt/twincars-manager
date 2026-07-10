import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SupplierForm from './SupplierForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

/**
 * Component tests for SupplierForm — required name field, invalid
 * email handling, dirty-flag transitions, optional-field passthrough.
 *
 * @group component
 * @module SupplierForm
 */
describe('SupplierForm', () => {
  beforeEach(() => {
    formDirty.clear()
  })

  it('renders the required field labels and submit button', () => {
    render(SupplierForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Firmenname *')).toBeInTheDocument()
    expect(screen.getByText('Kontaktperson')).toBeInTheDocument()
    expect(screen.getByText('IBAN')).toBeInTheDocument()
    expect(screen.getByText('BIC')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('keeps Speichern enabled even while the form is invalid (rule 1.1)', () => {
    render(SupplierForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the required-name message on a click with an empty company name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(SupplierForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte einen Firmennamen eingeben.').length
    ).toBeGreaterThan(0)
  })

  it('surfaces the email error on submit click and after blur', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(SupplierForm, { props: { onSave } })
    const nameInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(nameInput, 'Acme GmbH')
    const emailInput = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    await user.type(emailInput, 'not-an-email')
    // The field only lights up after blur (touched).
    expect(emailInput.className).not.toContain('input-error')
    await fireEvent.blur(emailInput)
    expect(emailInput.className).toContain('input-error')
    // Clicking submit does not save and shows the German message.
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/gültige E-Mail-Adresse/i).length
    ).toBeGreaterThan(0)
  })

  it('keeps a pristine form free of error messages', () => {
    render(SupplierForm, { props: { onSave: vi.fn() } })
    expect(
      screen.queryByText(/Bitte einen Firmennamen eingeben/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/gültige E-Mail-Adresse/i)
    ).not.toBeInTheDocument()
  })

  it('shows the name error after blurring the empty Firmenname field', async () => {
    const { container } = render(SupplierForm, { props: { onSave: vi.fn() } })
    const nameInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await fireEvent.blur(nameInput)
    expect(
      screen.getByText('Bitte einen Firmennamen eingeben.')
    ).toBeInTheDocument()
    expect(nameInput.className).toContain('input-error')
  })

  it('calls onSave with trimmed name and omits empty optional fields', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(SupplierForm, { props: { onSave } })
    const nameInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(nameInput, '  Acme GmbH  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.name).toBe('Acme GmbH')
    expect(payload.email).toBeUndefined()
    expect(payload.iban).toBeUndefined()
    expect(payload.bic).toBeUndefined()
    expect(payload.contactPerson).toBeUndefined()
    // Default country is "Deutschland".
    expect(payload.country).toBe('Deutschland')
  })

  it('marks dirty on first input and stays dirty when onSave does not clear', async () => {
    // New contract (QA fix): the form itself never clears the flag on
    // submit — the HOST's onSave clears it after a successful save,
    // right before its goto. A failed save therefore stays dirty and
    // the unsaved-changes guard keeps protecting the input.
    const user = userEvent.setup()
    const { container } = render(SupplierForm, { props: { onSave: vi.fn() } })
    expect(formDirty.dirty).toBe(false)
    const nameInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    await user.type(nameInput, 'X')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(true)
  })

  it('passes IBAN and BIC through to the payload as trimmed strings', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(SupplierForm, {
      props: { onSave, initial: { name: 'Bank AG' } }
    })
    const ibanInput = container.querySelector(
      'input[maxlength="34"]'
    ) as HTMLInputElement
    const bicInput = container.querySelector(
      'input[maxlength="11"]'
    ) as HTMLInputElement
    // BIC has maxlength=11 — leading/trailing spaces would overflow, so
    // type the 11-char value as-is and rely on the form's trim semantics
    // (no leading/trailing whitespace).
    await user.type(ibanInput, '  DE89370400440532013000  ')
    await user.type(bicInput, 'COBADEFFXXX')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.iban).toBe('DE89370400440532013000')
    expect(payload.bic).toBe('COBADEFFXXX')
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(SupplierForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-fills values from the initial prop', () => {
    const { container } = render(SupplierForm, {
      props: {
        onSave: vi.fn(),
        initial: {
          name: 'Pre-filled GmbH',
          contactPerson: 'Erika Musterfrau',
          email: 'erika@example.com',
          iban: 'DE12345',
          bic: 'XXXBIC',
          country: 'Österreich'
        }
      }
    })
    const nameInput = container.querySelector(
      'input[maxlength="200"]'
    ) as HTMLInputElement
    expect(nameInput.value).toBe('Pre-filled GmbH')
    const emailInput = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    expect(emailInput.value).toBe('erika@example.com')
  })
})
