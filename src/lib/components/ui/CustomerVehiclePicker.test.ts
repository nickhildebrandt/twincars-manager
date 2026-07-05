import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for CustomerVehiclePicker — the relation-aware
 * combined Kunde/Fahrzeug picker. Covers: vehicle pick auto-filling
 * the holder, customer pick narrowing the vehicle search, customer
 * switch clearing a foreign vehicle, and the locked-vehicle mode used
 * by the stock-sale flow.
 *
 * jsdom keeps closed <dialog> children in the DOM, so value
 * assertions read the two trigger buttons directly instead of
 * querying by text (stale dialog rows would collide).
 *
 * @group unit
 * @module CustomerVehiclePicker
 */

type PickParams = { q: string; page: number; size: number }

const customerHits = [
  { id: 'c1', label: 'Alpha GmbH · Berlin' },
  { id: 'c2', label: 'Beta AG · Hamburg' }
]

const vehicleHits = [
  {
    id: 'v1',
    label: 'B-AA 100 · VW Golf · Alpha GmbH',
    customerId: 'c1',
    customerLabel: 'Alpha GmbH · Berlin'
  },
  {
    id: 'v2',
    label: 'HH-BB 200 · Audi A4 · Beta AG',
    customerId: 'c2',
    customerLabel: 'Beta AG · Hamburg'
  }
]

const pickCustomersMock = vi.fn()
const pickVehiclesMock = vi.fn()

vi.mock('../../../routes/pickers.remote', () => ({
  pickCustomersRemote: (args: PickParams) => ({
    run: () => pickCustomersMock(args)
  }),
  pickCustomerVehiclesRemote: (args: PickParams & { customerId?: string }) => ({
    run: () => pickVehiclesMock(args)
  })
}))

import CustomerVehiclePicker from './CustomerVehiclePicker.svelte'

beforeEach(() => {
  pickCustomersMock.mockReset()
  pickVehiclesMock.mockReset()
  pickCustomersMock.mockResolvedValue({
    items: customerHits,
    total: customerHits.length,
    pageCount: 1
  })
  pickVehiclesMock.mockImplementation(async (args: { customerId?: string }) => {
    const items = args.customerId
      ? vehicleHits.filter((v) => v.customerId === args.customerId)
      : vehicleHits
    return { items, total: items.length, pageCount: 1 }
  })
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

/** The two field trigger buttons: [0] Kunde, [1] Fahrzeug. */
const triggers = () =>
  screen.getAllByRole('button').filter((b) => b.className.includes('input'))
const customerValue = () => triggers()[0].textContent?.trim() ?? ''
const vehicleValue = () => triggers()[1].textContent?.trim() ?? ''

/** Rows inside the open dialogs (item buttons have hover:bg-base-200). */
const findRow = async (pattern: RegExp) => {
  const rows = await screen.findAllByRole('button')
  const hit = rows.find(
    (b) =>
      b.className.includes('hover:bg-base-200') &&
      pattern.test(b.textContent ?? '')
  )
  if (!hit) throw new Error(`no dialog row matching ${pattern}`)
  return hit
}

describe('CustomerVehiclePicker', () => {
  it('renders both fields with their German labels', () => {
    render(CustomerVehiclePicker, { props: {} })
    expect(screen.getByText('Kunde')).toBeInTheDocument()
    expect(screen.getByText('Fahrzeug')).toBeInTheDocument()
    expect(customerValue()).toBe('Kunde suchen')
    expect(vehicleValue()).toBe('Fahrzeug oder Halter suchen')
  })

  it('picking a vehicle auto-fills its holder as the customer', async () => {
    const user = userEvent.setup()
    render(CustomerVehiclePicker, { props: {} })

    await user.click(triggers()[1])
    await user.click(await findRow(/VW Golf/))

    expect(vehicleValue()).toBe('B-AA 100 · VW Golf · Alpha GmbH')
    expect(customerValue()).toBe('Alpha GmbH · Berlin')
  })

  it('picking a customer narrows the vehicle search to that customer', async () => {
    const user = userEvent.setup()
    render(CustomerVehiclePicker, { props: {} })

    await user.click(triggers()[0])
    await user.click(await findRow(/Beta AG/))
    expect(customerValue()).toBe('Beta AG · Hamburg')

    await user.click(triggers()[1])
    await waitFor(() => expect(pickVehiclesMock).toHaveBeenCalled())
    const lastCall = pickVehiclesMock.mock.calls.at(-1)?.[0]
    expect(lastCall.customerId).toBe('c2')
    // Only Beta AG's vehicle is offered in the vehicle dialog.
    await findRow(/Audi A4/)
    await expect(findRow(/VW Golf/)).rejects.toThrow()
  })

  it('switching to a different customer clears a foreign vehicle', async () => {
    const user = userEvent.setup()
    render(CustomerVehiclePicker, { props: {} })

    // Pick Alpha's vehicle first (sets customer to Alpha too).
    await user.click(triggers()[1])
    await user.click(await findRow(/VW Golf/))
    expect(vehicleValue()).toBe('B-AA 100 · VW Golf · Alpha GmbH')
    expect(customerValue()).toBe('Alpha GmbH · Berlin')

    // Now switch the customer to Beta — the Alpha vehicle must clear.
    await user.click(triggers()[0])
    await user.click(await findRow(/Beta AG · Hamburg/))

    expect(customerValue()).toBe('Beta AG · Hamburg')
    expect(vehicleValue()).toBe('Fahrzeug dieses Kunden suchen')
  })

  it('clearing the customer also clears the vehicle', async () => {
    const user = userEvent.setup()
    render(CustomerVehiclePicker, { props: {} })

    await user.click(triggers()[1])
    await user.click(await findRow(/VW Golf/))
    expect(vehicleValue()).toBe('B-AA 100 · VW Golf · Alpha GmbH')

    // Two clear buttons now exist (customer + vehicle); the first
    // belongs to the customer field.
    const clearButtons = screen.getAllByRole('button', {
      name: 'Auswahl entfernen'
    })
    await user.click(clearButtons[0])

    expect(customerValue()).toBe('Kunde suchen')
    expect(vehicleValue()).toBe('Fahrzeug oder Halter suchen')
  })

  it('vehicleLocked keeps the vehicle through customer changes and disables its trigger', async () => {
    const user = userEvent.setup()
    render(CustomerVehiclePicker, {
      props: {
        vehicleId: 'v9',
        vehicleLabel: 'Lagerfahrzeug BMW 320d',
        vehicleLocked: true
      }
    })

    // The vehicle trigger is disabled — clicking must not search.
    await user.click(triggers()[1])
    expect(pickVehiclesMock).not.toHaveBeenCalled()

    // Picking a customer must NOT clear the locked vehicle.
    await user.click(triggers()[0])
    await user.click(await findRow(/Alpha GmbH/))
    expect(customerValue()).toBe('Alpha GmbH · Berlin')
    expect(vehicleValue()).toBe('Lagerfahrzeug BMW 320d')
  })

  it('renders required markers and the vehicle hint when configured', () => {
    render(CustomerVehiclePicker, {
      props: {
        customerRequired: true,
        vehicleRequired: true,
        vehicleHint: 'Lagerfahrzeug aus dem Verkaufsbestand.'
      }
    })
    expect(screen.getByText('Kunde *')).toBeInTheDocument()
    expect(screen.getByText('Fahrzeug *')).toBeInTheDocument()
    expect(
      screen.getByText('Lagerfahrzeug aus dem Verkaufsbestand.')
    ).toBeInTheDocument()
  })
})
