import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for TireStorageForm — customer/season required,
 * quantity bounds, photo state, dirty-flag transitions, and the
 * full-page customer/vehicle creation flow via CustomerVehiclePicker
 * (draft snapshot, restore, auto-select).
 *
 * @group component
 * @module TireStorageForm
 */

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  }),
  pickCustomerVehiclesRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import { goto } from '$app/navigation'
import TireStorageForm from './TireStorageForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'
import { creationFlow } from '$lib/stores/creation-flow.svelte'

beforeEach(() => {
  formDirty.clear()
  window.sessionStorage.clear()
  // Detach the creationFlow.start spies of previous tests.
  vi.restoreAllMocks()
  creationFlow.reset()
  vi.mocked(goto).mockReset()
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

  it('keeps Speichern enabled even while the form is empty (rule 1.1)', () => {
    render(TireStorageForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the customer error on a click without a customer', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireStorageForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte einen Kunden auswählen.').length
    ).toBeGreaterThan(0)
  })

  it('shows the season error on a click without a season', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireStorageForm, {
      props: { onSave, initial: { customerId: 'cust-1' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte eine Saison wählen.').length
    ).toBeGreaterThan(0)
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
    // The message shows in the alert and under the field.
    expect(
      screen.getAllByText(/Stückzahl muss zwischen 1 und 20/i).length
    ).toBeGreaterThan(0)
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

  it('keeps a pristine form free of error messages', () => {
    render(TireStorageForm, { props: { onSave: vi.fn() } })
    expect(
      screen.queryByText(/Bitte einen Kunden auswählen/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Bitte eine Saison wählen/i)
    ).not.toBeInTheDocument()
  })

  it('shows the season error only after blur', async () => {
    const { container } = render(TireStorageForm, {
      props: { onSave: vi.fn(), initial: { customerId: 'cust-1' } }
    })
    const seasonSelect = container.querySelector('select') as HTMLSelectElement
    expect(
      screen.queryByText('Bitte eine Saison wählen.')
    ).not.toBeInTheDocument()
    await fireEvent.blur(seasonSelect)
    expect(screen.getByText('Bitte eine Saison wählen.')).toBeInTheDocument()
    expect(seasonSelect.className).toContain('select-error')
  })

  it('surfaces customer + season errors after a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(TireStorageForm, { props: { onSave } })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Bitte einen Kunden auswählen/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Bitte eine Saison wählen/i).length
    ).toBeGreaterThan(0)
  })

  describe('full-page creation flow', () => {
    /** Dialog affordance buttons (class btn), not label-leaked triggers. */
    const affordances = (pattern: RegExp) =>
      screen
        .queryAllByRole('button', { name: pattern })
        .filter((b) => b.className.includes('btn'))

    it('starts the customer flow with a draft that round-trips and auto-selects the result', async () => {
      const user = userEvent.setup()
      const startSpy = vi.spyOn(creationFlow, 'start')
      const first = render(TireStorageForm, { props: { onSave: vi.fn() } })

      // Fill some state so the draft has real content to restore.
      const brand = first.container.querySelector(
        'input[maxlength="80"]'
      ) as HTMLInputElement
      await user.type(brand, 'Michelin')

      // Open the Kunde picker dialog and hit the header "Neu anlegen".
      await user.click(screen.getByText('Kunde suchen'))
      const createBtn = affordances(/Neuen Kunden anlegen/)[0]
      expect(createBtn).toBeTruthy()
      await user.click(createBtn)

      expect(startSpy).toHaveBeenCalledTimes(1)
      const frame = startSpy.mock.calls[0][0]
      expect(frame.entity).toBe('customer')
      expect(frame.originField).toBe('customerId')
      const draft = frame.draft as Record<string, unknown>
      expect(draft.brand).toBe('Michelin')
      expect(JSON.parse(JSON.stringify(draft))).toEqual(draft)
      expect(goto).toHaveBeenCalledWith('/customers/new')
      expect(formDirty.dirty).toBe(false)

      // Simulate the leaf: create succeeds, back to this page.
      first.unmount()
      creationFlow.finish({ id: 'c9', label: 'Neu GmbH · Berlin' })

      render(TireStorageForm, { props: { onSave: vi.fn() } })
      const brandRestored = document.querySelector(
        'input[maxlength="80"]'
      ) as HTMLInputElement
      expect(brandRestored.value).toBe('Michelin')
      expect(screen.getByText('Neu GmbH · Berlin')).toBeInTheDocument()
      expect(formDirty.dirty).toBe(true)
    })

    it('starts the vehicle flow only with a customer and applies the result to the vehicle picker', async () => {
      const user = userEvent.setup()
      const startSpy = vi.spyOn(creationFlow, 'start')
      const first = render(TireStorageForm, {
        props: {
          onSave: vi.fn(),
          initial: { customerId: 'cust-1', customerLabel: 'Alpha GmbH' }
        }
      })

      // Open the vehicle dialog — with a customer chosen the header
      // offers "Neues Fahrzeug anlegen".
      await user.click(screen.getByText('Fahrzeug dieses Kunden suchen'))
      const createBtn = affordances(/Neues Fahrzeug anlegen/)[0]
      expect(createBtn).toBeTruthy()
      await user.click(createBtn)

      expect(startSpy).toHaveBeenCalledTimes(1)
      const frame = startSpy.mock.calls[0][0]
      expect(frame.entity).toBe('vehicle')
      expect(frame.originField).toBe('vehicleId')
      const draft = frame.draft as Record<string, unknown>
      expect(draft.customerId).toBe('cust-1')
      expect(goto).toHaveBeenCalledWith('/vehicles/new')

      // Simulate the leaf: vehicle created, back to this page.
      first.unmount()
      creationFlow.finish({ id: 'v9', label: 'B-XY 9 · Opel Corsa' })

      render(TireStorageForm, { props: { onSave: vi.fn() } })
      // Customer kept from the draft, vehicle auto-selected.
      expect(screen.getByText('Alpha GmbH')).toBeInTheDocument()
      expect(screen.getByText('B-XY 9 · Opel Corsa')).toBeInTheDocument()
    })

    it('offers no vehicle creation without a customer', async () => {
      const user = userEvent.setup()
      render(TireStorageForm, { props: { onSave: vi.fn() } })
      await user.click(screen.getByText('Fahrzeug oder Halter suchen'))
      expect(affordances(/Neues Fahrzeug anlegen/)).toHaveLength(0)
    })

    it('hides create options for entity types already active in the chain', async () => {
      const user = userEvent.setup()
      creationFlow.start({
        entity: 'customer',
        returnUrl: '/somewhere/else',
        originField: 'customerId',
        draft: {},
        createdAt: Date.now()
      })
      creationFlow.start({
        entity: 'vehicle',
        returnUrl: '/somewhere/else',
        originField: 'vehicleId',
        draft: {},
        createdAt: Date.now()
      })
      render(TireStorageForm, {
        props: {
          onSave: vi.fn(),
          initial: { customerId: 'cust-1', customerLabel: 'Alpha GmbH' }
        }
      })
      await user.click(screen.getByText('Alpha GmbH'))
      expect(affordances(/Neuen Kunden anlegen/)).toHaveLength(0)
      await user.click(screen.getByText('Fahrzeug dieses Kunden suchen'))
      expect(affordances(/Neues Fahrzeug anlegen/)).toHaveLength(0)
    })
  })
})
