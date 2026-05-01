import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import CustomerForm from './CustomerForm.svelte'

/**
 * Component tests for CustomerForm. Uses @testing-library/svelte exclusively.
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

  it('rejects save without any name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/Firma oder Nachname/i)).toBeInTheDocument()
  })

  it('rejects save with invalid email', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(CustomerForm, {
      props: { onSave, initial: { lastName: 'Müller' } }
    })
    const emailInput = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    expect(emailInput).toBeTruthy()
    await user.type(emailInput, 'not-an-email')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/E-Mail/i)).toBeInTheDocument()
  })

  it('calls onSave with trimmed values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(CustomerForm, { props: { onSave } })
    const inputs = screen.getAllByRole('textbox')
    // Firma is the first textbox
    await user.type(inputs[0], '  Mustermann GmbH  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].company).toBe('Mustermann GmbH')
  })
})
