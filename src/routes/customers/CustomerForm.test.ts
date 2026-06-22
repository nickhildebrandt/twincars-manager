import { render, screen, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import CustomerForm from './CustomerForm.svelte'

/**
 * Component tests for CustomerForm. The form follows the standardised
 * validation UX:
 *
 * - Speichern starts disabled when no required field is filled.
 * - Entering valid input enables the button.
 * - Entering invalid input keeps the button disabled and flips the field
 *   border to `input-error` (after blur).
 *
 * @group component
 * @module CustomerForm
 */
describe('CustomerForm', () => {
  it('renders the required field labels', () => {
    render(CustomerForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Firma')).toBeInTheDocument()
    expect(screen.getByText('Vorname')).toBeInTheDocument()
    expect(screen.getByText('Nachname')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('starts with Speichern disabled when no name is given', () => {
    render(CustomerForm, { props: { onSave: vi.fn() } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
  })

  it('keeps Speichern disabled until at least Firma or Nachname is filled', async () => {
    const user = userEvent.setup()
    render(CustomerForm, { props: { onSave: vi.fn() } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    // Typing into Firma enables the button.
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Mustermann GmbH')
    expect(btn).not.toBeDisabled()
  })

  it('disables Speichern when the email is malformed', async () => {
    const user = userEvent.setup()
    const { container } = render(CustomerForm, {
      props: { onSave: vi.fn(), initial: { lastName: 'Müller' } }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).not.toBeDisabled()
    const emailInput = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    await user.type(emailInput, 'not-an-email')
    expect(btn).toBeDisabled()
  })

  it('shows an error and adds input-error after blur on invalid email', async () => {
    const user = userEvent.setup()
    const { container } = render(CustomerForm, {
      props: { onSave: vi.fn(), initial: { lastName: 'Müller' } }
    })
    const emailInput = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    await user.type(emailInput, 'not-an-email')
    await fireEvent.blur(emailInput)
    expect(emailInput.className).toContain('input-error')
  })

  it('calls onSave with trimmed values and kind=regular', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave } })
    const inputs = screen.getAllByRole('textbox')
    // Firma is the first textbox in regular mode.
    await user.type(inputs[0], '  Mustermann GmbH  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].company).toBe('Mustermann GmbH')
    expect(onSave.mock.calls[0][0].kind).toBe('regular')
  })

  it('hides regular fields and shows ebay handle when switching to eBay', async () => {
    const user = userEvent.setup()
    render(CustomerForm, { props: { onSave: vi.fn() } })
    // Regular mode shows Firma + Anrede.
    expect(screen.getByText('Firma')).toBeInTheDocument()
    expect(screen.getByText('Anrede')).toBeInTheDocument()

    // Switch to eBay.
    await user.click(screen.getByRole('radio', { name: /ebay-kunde/i }))

    // Regular-only labels are gone, eBay-Name is shown (with required marker).
    expect(screen.queryByText('Firma')).not.toBeInTheDocument()
    expect(screen.queryByText('Anrede')).not.toBeInTheDocument()
    expect(screen.queryByText('Straße + Hausnummer')).not.toBeInTheDocument()
    expect(screen.queryByText('Telefon')).not.toBeInTheDocument()
    expect(screen.getByText(/eBay-Name/i)).toBeInTheDocument()
  })

  it('restores regular fields when switching back from eBay to standard', async () => {
    const user = userEvent.setup()
    render(CustomerForm, { props: { onSave: vi.fn() } })
    await user.click(screen.getByRole('radio', { name: /ebay-kunde/i }))
    expect(screen.queryByText('Firma')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /standardkunde/i }))
    expect(screen.getByText('Firma')).toBeInTheDocument()
    expect(screen.getByText('Anrede')).toBeInTheDocument()
    expect(screen.queryByText(/eBay-Name/i)).not.toBeInTheDocument()
  })

  it('submits with kind=ebay and the ebayHandle when in ebay mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave } })
    await user.click(screen.getByRole('radio', { name: /ebay-kunde/i }))

    const handleInput = screen.getByLabelText(/ebay-name/i)
    await user.type(handleInput, '  midnight-bidder  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.kind).toBe('ebay')
    expect(payload.ebayHandle).toBe('midnight-bidder')
    // Regular fields are not part of the eBay payload.
    expect(payload.company).toBeUndefined()
    expect(payload.lastName).toBeUndefined()
  })

  it('keeps Speichern disabled when the eBay handle is shorter than 3 characters', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave } })
    await user.click(screen.getByRole('radio', { name: /ebay-kunde/i }))
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    const handleInput = screen.getByLabelText(/ebay-name/i)
    await user.type(handleInput, 'ab')
    expect(btn).toBeDisabled()
    await user.type(handleInput, 'c')
    expect(btn).not.toBeDisabled()
  })

  it('passes through wantsBroadcast=true and wantsTireReminders=true on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, {
      props: {
        onSave,
        initial: {
          lastName: 'Müller',
          wantsBroadcast: true,
          wantsTireReminders: true
        }
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.wantsBroadcast).toBe(true)
    expect(payload.wantsTireReminders).toBe(true)
  })

  it('defaults wantsBroadcast/wantsTireReminders to false in a fresh form', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave, initial: { lastName: 'X' } } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.wantsBroadcast).toBe(false)
    expect(payload.wantsTireReminders).toBe(false)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(CustomerForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
