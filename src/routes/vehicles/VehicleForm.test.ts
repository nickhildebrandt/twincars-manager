import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for VehicleForm — mode-based field visibility,
 * required-customer guard in customer mode, the "at least one of …"
 * identifier check, trimmed-payload behaviour, and the full-page
 * customer-creation flow (draft snapshot, restore, auto-select).
 * Validation runs through the shared useFormValidation helper:
 * errors surface only after a field was touched or a submit was
 * attempted.
 *
 * @group component
 * @module VehicleForm
 */

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../pickers.remote', () => ({
  pickCustomersRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import { goto } from '$app/navigation'
import VehicleForm from './VehicleForm.svelte'
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

  it('keeps Speichern enabled and surfaces the identifier error on click', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(VehicleForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    // Rule 1.1: the button is never gated by validity — only by busy.
    expect(btn).toBeEnabled()
    await user.click(btn)
    expect(onSave).not.toHaveBeenCalled()
    // The summary alert plus the field-level message carry the rule.
    expect(
      screen.getAllByText(/Kennzeichen, FIN oder Marke\/Modell/i).length
    ).toBeGreaterThan(0)
  })

  it('surfaces the missing-customer error on click in customer mode', async () => {
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
    // make is set, but customer is missing — the click must not save
    // and must surface the German field error instead.
    expect(btn).toBeEnabled()
    await user.click(btn)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Bitte einen Kunden auswählen/i).length
    ).toBeGreaterThan(0)
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

  it('marks dirty on first input and stays dirty when onSave does not clear (failed save)', async () => {
    const user = userEvent.setup()
    // The host's onSave clears formDirty only AFTER a successful save
    // (before its goto). A rejected save is caught by the host and
    // resolves WITHOUT clearing — the form must stay dirty so the
    // unsaved-changes guard keeps protecting the input (QA finding:
    // clearing before the await silently discarded input after a 400).
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { container } = render(VehicleForm, { props: { onSave } })
    expect(formDirty.dirty).toBe(false)
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    await user.type(make, 'V')
    expect(formDirty.dirty).toBe(true)
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(formDirty.dirty).toBe(true)
  })

  it('clears the dirty flag when a successful onSave clears it (host contract)', async () => {
    const user = userEvent.setup()
    // Simulates the host success path: remote resolved → clear → goto.
    const onSave = vi.fn().mockImplementation(async () => {
      formDirty.clear()
    })
    const { container } = render(VehicleForm, { props: { onSave } })
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

  it('shows no validation errors on a pristine form', () => {
    render(VehicleForm, { props: { onSave: vi.fn(), mode: 'customer' } })
    expect(
      screen.queryByText(/Bitte einen Kunden auswählen/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Kennzeichen, FIN oder Marke\/Modell/i)
    ).not.toBeInTheDocument()
  })

  it('surfaces the identifier rule after a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(VehicleForm, { props: { onSave } })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Kennzeichen, FIN oder Marke\/Modell/i).length
    ).toBeGreaterThan(0)
  })

  it('shows the per-field customer error after a submit attempt in customer mode', async () => {
    const onSave = vi.fn()
    const { container } = render(VehicleForm, {
      props: { onSave, mode: 'customer', initial: { make: 'VW' } }
    })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Bitte einen Kunden auswählen/i).length
    ).toBeGreaterThan(0)
  })

  it('starts the customer flow with a draft that round-trips and auto-selects the result', async () => {
    const user = userEvent.setup()
    const startSpy = vi.spyOn(creationFlow, 'start')
    const first = render(VehicleForm, {
      props: { onSave: vi.fn(), mode: 'customer' }
    })

    // Type something so the draft has real content to restore.
    const make = first.container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    await user.type(make, 'VW')

    // Open the Halter picker and hit the header "Neu anlegen" button.
    // The FormField <label> leaks the dialog text into the trigger's
    // accessible name — filter for the real affordance (class btn).
    await user.click(screen.getByText('- Kunde wählen -'))
    const createBtn = screen
      .getAllByRole('button', { name: /Neuen Kunden anlegen/ })
      .find((b) => b.className.includes('btn'))
    expect(createBtn).toBeTruthy()
    await user.click(createBtn!)

    // The flow frame carries a serializable draft of the whole form.
    expect(startSpy).toHaveBeenCalledTimes(1)
    const frame = startSpy.mock.calls[0][0]
    expect(frame.entity).toBe('customer')
    expect(frame.originField).toBe('customerId')
    const draft = frame.draft as Record<string, unknown>
    expect(draft.make).toBe('VW')
    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft)
    expect(goto).toHaveBeenCalledWith('/customers/new')
    // Drafted input must not trip the unsaved-changes guard mid-flow.
    expect(formDirty.dirty).toBe(false)

    // Simulate the leaf: create succeeds, back to this page.
    first.unmount()
    creationFlow.finish({ id: 'c9', label: 'Neu GmbH · Berlin' })

    render(VehicleForm, { props: { onSave: vi.fn(), mode: 'customer' } })
    const makeRestored = document.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    expect(makeRestored.value).toBe('VW')
    expect(screen.getByText('Neu GmbH · Berlin')).toBeInTheDocument()
    // The restored draft counts as unsaved input again.
    expect(formDirty.dirty).toBe(true)
  })

  it('restores the draft without selection when the flow was cancelled', async () => {
    creationFlow.start({
      entity: 'customer',
      returnUrl: window.location.pathname + window.location.search,
      originField: 'customerId',
      draft: { make: 'Opel', model: '', licensePlate: '', vin: '' },
      createdAt: Date.now()
    })
    creationFlow.cancel()

    const { container } = render(VehicleForm, {
      props: { onSave: vi.fn(), mode: 'customer' }
    })
    const make = container.querySelector(
      'input[maxlength="100"]'
    ) as HTMLInputElement
    expect(make.value).toBe('Opel')
    // No customer got selected — the placeholder still shows.
    expect(screen.getByText('- Kunde wählen -')).toBeInTheDocument()
  })

  it('hides the create option while a customer is already being created in the chain', async () => {
    const user = userEvent.setup()
    creationFlow.start({
      entity: 'customer',
      returnUrl: '/somewhere/else',
      originField: 'customerId',
      draft: {},
      createdAt: Date.now()
    })
    render(VehicleForm, { props: { onSave: vi.fn(), mode: 'customer' } })
    await user.click(screen.getByText('- Kunde wählen -'))
    // Only the label-leaked trigger name may match — no real button.
    const affordances = screen
      .queryAllByRole('button', { name: /Neuen Kunden anlegen/ })
      .filter((b) => b.className.includes('btn'))
    expect(affordances).toHaveLength(0)
  })

  it('seeds the customer picker label from initial.customerLabel', () => {
    render(VehicleForm, {
      props: {
        onSave: vi.fn(),
        initial: { customerId: 'c1', customerLabel: 'Muster GmbH · Berlin' }
      }
    })
    // The picker trigger shows the owner's label instead of the
    // placeholder when both id and label are seeded.
    expect(screen.getByText('Muster GmbH · Berlin')).toBeInTheDocument()
    expect(screen.queryByText('- Kunde wählen -')).not.toBeInTheDocument()
  })

  it('emits customerId plus the UI-only customerLabel on submit (customer mode)', async () => {
    // Leaf pages hand the holder label back to their creation-flow
    // host through this field — it must mirror the picked customer.
    const onSave = vi.fn()
    const { container } = render(VehicleForm, {
      props: {
        onSave,
        mode: 'customer',
        initial: {
          customerId: 'c1',
          customerLabel: 'Muster GmbH · Berlin',
          make: 'VW'
        }
      }
    })
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.customerId).toBe('c1')
    expect(payload.customerLabel).toBe('Muster GmbH · Berlin')
  })

  it('omits customerLabel when no customer is set (stock mode)', async () => {
    const onSave = vi.fn()
    const { container } = render(VehicleForm, {
      props: { onSave, mode: 'stock', initial: { make: 'VW' } }
    })
    await fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].customerLabel).toBeUndefined()
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

  describe('Vorbesitzer (previous owner)', () => {
    it('shows the optional Vorbesitzer picker in stock mode', () => {
      render(VehicleForm, { props: { onSave: vi.fn(), mode: 'stock' } })
      expect(screen.getByText('Vorbesitzer')).toBeInTheDocument()
      expect(screen.getByText('- Vorbesitzer wählen -')).toBeInTheDocument()
    })

    it('shows the Vorbesitzer picker in edit mode', () => {
      render(VehicleForm, { props: { onSave: vi.fn(), mode: 'edit' } })
      expect(screen.getByText('- Vorbesitzer wählen -')).toBeInTheDocument()
    })

    it('hides the Vorbesitzer picker in customer mode', () => {
      render(VehicleForm, { props: { onSave: vi.fn(), mode: 'customer' } })
      expect(screen.queryByText('Vorbesitzer')).not.toBeInTheDocument()
      expect(
        screen.queryByText('- Vorbesitzer wählen -')
      ).not.toBeInTheDocument()
    })

    it('is optional: stock submit without a previous owner emits null', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const { container } = render(VehicleForm, {
        props: { onSave, mode: 'stock' }
      })
      const make = container.querySelector(
        'input[maxlength="100"]'
      ) as HTMLInputElement
      await user.type(make, 'Skoda')
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave.mock.calls[0][0].previousOwnerCustomerId).toBeNull()
    })

    it('omits previousOwnerCustomerId entirely in customer mode', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const { container } = render(VehicleForm, {
        props: {
          onSave,
          mode: 'customer',
          initial: { customerId: 'c1', customerLabel: 'Muster GmbH' }
        }
      })
      const make = container.querySelector(
        'input[maxlength="100"]'
      ) as HTMLInputElement
      await user.type(make, 'VW')
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave.mock.calls[0][0].previousOwnerCustomerId).toBeUndefined()
    })

    it('seeds the picker from initial.previousOwnerLabel in edit mode', () => {
      render(VehicleForm, {
        props: {
          onSave: vi.fn(),
          mode: 'edit',
          initial: {
            previousOwnerCustomerId: 'c7',
            previousOwnerLabel: 'Alt GmbH · Hamburg'
          }
        }
      })
      expect(screen.getByText('Alt GmbH · Hamburg')).toBeInTheDocument()
      expect(
        screen.queryByText('- Vorbesitzer wählen -')
      ).not.toBeInTheDocument()
    })

    it('starts the creation flow with originField previousOwnerCustomerId and auto-selects the result', async () => {
      const user = userEvent.setup()
      const startSpy = vi.spyOn(creationFlow, 'start')
      const first = render(VehicleForm, {
        props: { onSave: vi.fn(), mode: 'stock' }
      })

      const make = first.container.querySelector(
        'input[maxlength="100"]'
      ) as HTMLInputElement
      await user.type(make, 'Skoda')

      // Stock mode renders exactly one customer picker (Vorbesitzer).
      await user.click(screen.getByText('- Vorbesitzer wählen -'))
      const createBtn = screen
        .getAllByRole('button', { name: /Neuen Kunden anlegen/ })
        .find((b) => b.className.includes('btn'))
      expect(createBtn).toBeTruthy()
      await user.click(createBtn!)

      expect(startSpy).toHaveBeenCalledTimes(1)
      const frame = startSpy.mock.calls[0][0]
      expect(frame.entity).toBe('customer')
      expect(frame.originField).toBe('previousOwnerCustomerId')
      const draft = frame.draft as Record<string, unknown>
      expect(draft.make).toBe('Skoda')
      expect(goto).toHaveBeenCalledWith('/customers/new')

      // Simulate the leaf: create succeeds, back to this page.
      first.unmount()
      creationFlow.finish({ id: 'c9', label: 'Ankauf GmbH · Kiel' })

      const second = render(VehicleForm, {
        props: { onSave: vi.fn(), mode: 'stock' }
      })
      const makeRestored = second.container.querySelector(
        'input[maxlength="100"]'
      ) as HTMLInputElement
      expect(makeRestored.value).toBe('Skoda')
      expect(screen.getByText('Ankauf GmbH · Kiel')).toBeInTheDocument()
    })

    it('emits the picked previous owner id on submit', async () => {
      creationFlow.start({
        entity: 'customer',
        returnUrl: window.location.pathname + window.location.search,
        originField: 'previousOwnerCustomerId',
        draft: { make: 'Seat', model: '', licensePlate: '', vin: '' },
        createdAt: Date.now()
      })
      creationFlow.finish({ id: 'c42', label: 'Vorbesitzer AG · Bonn' })

      const user = userEvent.setup()
      const onSave = vi.fn()
      render(VehicleForm, { props: { onSave, mode: 'stock' } })
      expect(screen.getByText('Vorbesitzer AG · Bonn')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave.mock.calls[0][0].previousOwnerCustomerId).toBe('c42')
    })
  })
})
