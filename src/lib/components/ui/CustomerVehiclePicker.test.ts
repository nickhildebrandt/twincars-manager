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
const createCustomerMock = vi.fn()
const createVehicleMock = vi.fn()

vi.mock('../../../routes/pickers.remote', () => ({
  pickCustomersRemote: (args: PickParams) => ({
    run: () => pickCustomersMock(args)
  }),
  pickCustomerVehiclesRemote: (args: PickParams & { customerId?: string }) => ({
    run: () => pickVehiclesMock(args)
  })
}))

// The inline quick-create forms call the real create commands — mock the
// two remote modules the same way pickers.remote is mocked above.
vi.mock('../../../routes/customers/customers.remote', () => ({
  createCustomerRemote: (args: unknown) => createCustomerMock(args)
}))
vi.mock('../../../routes/vehicles/vehicles.remote', () => ({
  createVehicleRemote: (args: unknown) => createVehicleMock(args)
}))

import CustomerVehiclePicker from './CustomerVehiclePicker.svelte'

beforeEach(() => {
  pickCustomersMock.mockReset()
  pickVehiclesMock.mockReset()
  createCustomerMock.mockReset()
  createVehicleMock.mockReset()
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

  it('creates a customer inline and selects it', async () => {
    const user = userEvent.setup()
    createCustomerMock.mockResolvedValue({
      id: 'c9',
      company: null,
      firstName: 'Nora',
      lastName: 'Neukund',
      customerNumber: 'K-9',
      city: null
    })
    render(CustomerVehiclePicker, { props: {} })

    await user.click(triggers()[0])
    await user.click(
      screen.getByRole('button', { name: /Neuen Kunden anlegen/ })
    )
    // Quick-create form replaces the result list.
    await user.type(screen.getByLabelText('Nachname'), 'Neukund')
    await user.type(screen.getByLabelText('Vorname'), 'Nora')
    await user.click(screen.getByRole('button', { name: 'Kunde anlegen' }))

    await waitFor(() => expect(customerValue()).toBe('Nora Neukund'))
    expect(createCustomerMock).toHaveBeenCalledWith({
      lastName: 'Neukund',
      firstName: 'Nora',
      company: undefined,
      phone: undefined
    })
  })

  it('offers no vehicle creation without a customer and shows the hint', async () => {
    const user = userEvent.setup()
    pickVehiclesMock.mockResolvedValue({ items: [], total: 0, pageCount: 1 })
    render(CustomerVehiclePicker, { props: {} })

    await user.click(triggers()[1])
    await waitFor(() => expect(pickVehiclesMock).toHaveBeenCalled())

    expect(
      screen.queryByRole('button', { name: /Neues Fahrzeug anlegen/ })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(
        'Keine Treffer. Zuerst Kunden wählen, um ein neues Fahrzeug anzulegen.'
      )
    ).toBeInTheDocument()
  })

  it('creates a vehicle inline for the chosen customer and selects it', async () => {
    const user = userEvent.setup()
    createVehicleMock.mockResolvedValue({
      id: 'v9',
      licensePlate: 'HH-XY 9',
      make: 'Opel',
      model: 'Corsa'
    })
    render(CustomerVehiclePicker, { props: {} })

    // Choose the customer first — only then is inline create offered.
    await user.click(triggers()[0])
    await user.click(await findRow(/Beta AG · Hamburg/))
    expect(customerValue()).toBe('Beta AG · Hamburg')

    await user.click(triggers()[1])
    await user.click(
      screen.getByRole('button', { name: /Neues Fahrzeug anlegen/ })
    )
    // The holder is shown read-only inside the quick-create form.
    expect(screen.getByText(/Halter: Beta AG · Hamburg/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Kennzeichen'), 'HH-XY 9')
    await user.click(screen.getByRole('button', { name: 'Fahrzeug anlegen' }))

    await waitFor(() => expect(vehicleValue()).toBe('HH-XY 9 · Opel Corsa'))
    expect(customerValue()).toBe('Beta AG · Hamburg')
    expect(createVehicleMock).toHaveBeenCalledWith({
      customerId: 'c2',
      licensePlate: 'HH-XY 9',
      make: undefined,
      model: undefined
    })
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
