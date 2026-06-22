import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EmployeeForm from './EmployeeForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

/**
 * Component tests for EmployeeForm — required name fields, optional
 * fields, salary auto-calculation between hourly wage / monthly salary
 * given weekly hours.
 *
 * @group component
 * @module EmployeeForm
 */
describe('EmployeeForm', () => {
  beforeEach(() => {
    formDirty.clear()
  })

  it('renders the required field labels', () => {
    render(EmployeeForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Vorname *')).toBeInTheDocument()
    expect(screen.getByText('Nachname *')).toBeInTheDocument()
    expect(screen.getByText('Personalnr. (auto)')).toBeInTheDocument()
    expect(screen.getByText('Wochenstunden')).toBeInTheDocument()
    expect(screen.getByText('Monatsgehalt (€)')).toBeInTheDocument()
    expect(screen.getByText('Stundenlohn (€)')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('keeps Speichern disabled when first and last name are empty', async () => {
    const onSave = vi.fn()
    render(EmployeeForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled when only first name is provided', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, { props: { onSave } })
    const firstName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[0] as HTMLInputElement
    await user.type(firstName, 'Max')
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with trimmed first/last name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, { props: { onSave } })
    const firstName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[0] as HTMLInputElement
    const lastName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[1] as HTMLInputElement
    await user.type(firstName, '  Max  ')
    await user.type(lastName, '  Mustermann  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.firstName).toBe('Max')
    expect(payload.lastName).toBe('Mustermann')
  })

  it('auto-computes monthlySalary from weeklyHours + hourlyWage', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, {
      props: { onSave, initial: { firstName: 'Max', lastName: 'Muster' } }
    })
    const weekly = container.querySelector(
      'input[max="60"][step="0.5"]'
    ) as HTMLInputElement
    const hourly = screen.getByLabelText(/Stundenlohn/i) as HTMLInputElement
    const monthly = screen.getByLabelText(/Monatsgehalt/i) as HTMLInputElement
    await user.clear(weekly)
    await user.type(weekly, '40')
    await user.clear(hourly)
    await user.type(hourly, '20')
    // 40 * 4.33 * 20 = 3464.00
    expect(Number(monthly.value)).toBeCloseTo(3464, 1)
  })

  it('auto-computes hourlyWage from weeklyHours + monthlySalary', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, {
      props: { onSave, initial: { firstName: 'X', lastName: 'Y' } }
    })
    const weekly = container.querySelector(
      'input[max="60"][step="0.5"]'
    ) as HTMLInputElement
    const monthly = screen.getByLabelText(/Monatsgehalt/i) as HTMLInputElement
    const hourly = screen.getByLabelText(/Stundenlohn/i) as HTMLInputElement
    await user.clear(weekly)
    await user.type(weekly, '40')
    await user.clear(monthly)
    await user.type(monthly, '3464')
    // 3464 / (40 * 4.33) ≈ 20.00
    expect(Number(hourly.value)).toBeCloseTo(20.0, 1)
  })

  it('emits numeric weeklyHours and monthlySalary to the payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, {
      props: { onSave, initial: { firstName: 'Max', lastName: 'Mustermann' } }
    })
    const weekly = container.querySelector(
      'input[max="60"][step="0.5"]'
    ) as HTMLInputElement
    const monthly = screen.getByLabelText(/Monatsgehalt/i) as HTMLInputElement
    await user.type(weekly, '40')
    await user.type(monthly, '3500')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    const payload = onSave.mock.calls[0][0]
    expect(payload.weeklyHours).toBe(40)
    expect(payload.monthlySalary).toBe(3500)
  })

  it('omits empty optional fields from the payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(EmployeeForm, { props: { onSave } })
    const firstName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[0] as HTMLInputElement
    const lastName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[1] as HTMLInputElement
    await user.type(firstName, 'A')
    await user.type(lastName, 'B')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    const payload = onSave.mock.calls[0][0]
    expect(payload.position).toBeUndefined()
    expect(payload.taxId).toBeUndefined()
    expect(payload.bankIban).toBeUndefined()
  })

  it('marks dirty on first input and clears on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(EmployeeForm, { props: { onSave: vi.fn() } })
    expect(formDirty.dirty).toBe(false)
    const firstName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[0] as HTMLInputElement
    const lastName = container.querySelectorAll(
      'input[maxlength="100"]'
    )[1] as HTMLInputElement
    await user.type(firstName, 'A')
    await user.type(lastName, 'B')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(false)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(EmployeeForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
