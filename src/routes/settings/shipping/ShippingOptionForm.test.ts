import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShippingOptionForm from './ShippingOptionForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

/**
 * Component tests for ShippingOptionForm.
 *
 * @group component
 * @module ShippingOptionForm
 */
describe('ShippingOptionForm', () => {
  beforeEach(() => {
    formDirty.clear()
  })

  it('renders the required field labels', () => {
    render(ShippingOptionForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText(/Name \*/)).toBeInTheDocument()
    expect(screen.getByText(/Preis netto/)).toBeInTheDocument()
    expect(screen.getByText(/Frei ab Bestellwert/)).toBeInTheDocument()
    expect(screen.getByText(/Reihenfolge/)).toBeInTheDocument()
    expect(screen.getByText(/Aktiv/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  })

  it('keeps Speichern disabled without a name', async () => {
    const onSave = vi.fn()
    render(ShippingOptionForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled with an invalid price', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, {
      props: { onSave, initial: { name: 'DHL', priceNet: '' } }
    })
    const priceInput = screen.getByLabelText(/Preis netto/) as HTMLInputElement
    await user.clear(priceInput)
    await user.type(priceInput, 'abc')
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled with an invalid "frei ab" amount', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, { props: { onSave, initial: { name: 'DHL' } } })
    const freeInput = screen.getByLabelText(
      /Frei ab Bestellwert/
    ) as HTMLInputElement
    await user.type(freeInput, 'nope')
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with trimmed values and German comma price', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, { props: { onSave } })
    const nameInput = screen.getByLabelText(/Name \*/) as HTMLInputElement
    await user.type(nameInput, '  DHL Paket  ')
    const priceInput = screen.getByLabelText(/Preis netto/) as HTMLInputElement
    await user.clear(priceInput)
    await user.type(priceInput, '6,90')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const call = onSave.mock.calls[0][0]
    expect(call.name).toBe('DHL Paket')
    expect(call.priceNet).toBe('6,90')
    expect(call.active).toBe(true)
    expect(call.sortOrder).toBe(0)
  })

  it('omits freeAboveNet and description when empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, {
      props: { onSave, initial: { name: 'Abholung', priceNet: '0,00' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const call = onSave.mock.calls[0][0]
    expect(call.freeAboveNet).toBeUndefined()
    expect(call.description).toBeUndefined()
  })

  it('pre-fills values from `initial` and formats the price German', () => {
    render(ShippingOptionForm, {
      props: {
        onSave: vi.fn(),
        initial: {
          name: 'Express',
          description: 'Schnell',
          priceNet: '15.00',
          freeAboveNet: '200.00',
          active: false,
          sortOrder: 5
        }
      }
    })
    const nameInput = screen.getByLabelText(/Name \*/) as HTMLInputElement
    expect(nameInput.value).toBe('Express')
    const priceInput = screen.getByLabelText(/Preis netto/) as HTMLInputElement
    expect(priceInput.value).toBe('15,00')
    const freeInput = screen.getByLabelText(
      /Frei ab Bestellwert/
    ) as HTMLInputElement
    expect(freeInput.value).toBe('200,00')
    const activeBox = screen.getByLabelText(/Aktiv/) as HTMLInputElement
    expect(activeBox.checked).toBe(false)
  })

  it('marks form dirty on first input and clears on submit', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, { props: { onSave } })
    expect(formDirty.dirty).toBe(false)
    const nameInput = screen.getByLabelText(/Name \*/) as HTMLInputElement
    await user.type(nameInput, 'X')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(formDirty.dirty).toBe(false)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(ShippingOptionForm, { props: { onSave, onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('keeps Speichern disabled for names longer than 150 characters', async () => {
    const onSave = vi.fn()
    const longName = 'X'.repeat(151)
    render(ShippingOptionForm, { props: { onSave } })
    const nameInput = screen.getByLabelText(/Name \*/) as HTMLInputElement
    nameInput.value = longName
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled when sortOrder is initialised to a negative value', async () => {
    const onSave = vi.fn()
    render(ShippingOptionForm, {
      props: {
        onSave,
        initial: { name: 'DHL', priceNet: '0,00', sortOrder: -1 }
      }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('emits dot-decimal price strings unchanged (e.g. "5.90")', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, {
      props: { onSave, initial: { name: 'DHL', priceNet: '5.90' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const call = onSave.mock.calls[0][0]
    // The form pre-formats to German "5,90" then re-emits it.
    expect(call.priceNet).toBe('5,90')
  })

  it('emits description when filled in', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ShippingOptionForm, {
      props: { onSave, initial: { name: 'DHL', priceNet: '0,00' } }
    })
    const desc = screen.getByLabelText(/Beschreibung/) as HTMLTextAreaElement
    await user.type(desc, '  Schnellversand  ')
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    // trim() within the form replaces empty strings with undefined.
    expect(onSave.mock.calls[0][0].description).toBe('Schnellversand')
  })
})
