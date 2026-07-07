import { fireEvent, render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the Ankauf confirm modal: field rendering with
 * the today-default date, the always-clickable submit button with
 * click-time German validation (missing date, negative price), and
 * the happy path calling `purchaseVehicleIntoStockRemote` with the
 * exact payload (price omitted when the field stays empty).
 *
 * @group component
 * @module PurchaseIntoStockModal
 */

const { updatesSpy } = vi.hoisted(() => ({
  updatesSpy: vi.fn(async () => ({ id: 'v1' }))
}))

vi.mock('./vehicles.remote', () => ({
  // Command invocations return a promise carrying `.updates(...)` for
  // the single-flight refresh — mirror that shape in the mock.
  purchaseVehicleIntoStockRemote: vi.fn(() =>
    Object.assign(Promise.resolve({ id: 'v1' }), { updates: updatesSpy })
  )
}))

import { purchaseVehicleIntoStockRemote } from './vehicles.remote'
import PurchaseIntoStockModal from './PurchaseIntoStockModal.svelte'

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const dateInput = (): HTMLInputElement =>
  screen.getByLabelText(/Ankaufsdatum/) as HTMLInputElement
const priceInput = (): HTMLInputElement =>
  screen.getByLabelText(/Ankaufspreis/) as HTMLInputElement
const submitButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /Ankauf übernehmen/ }) as HTMLButtonElement

beforeEach(() => {
  vi.mocked(purchaseVehicleIntoStockRemote).mockClear()
  updatesSpy.mockClear()
})

describe('PurchaseIntoStockModal', () => {
  it('renders both fields with today as the default date', () => {
    render(PurchaseIntoStockModal, { props: { open: true, vehicleId: 'v1' } })
    expect(priceInput()).toBeInTheDocument()
    expect(dateInput().value).toBe(todayIso())
    expect(
      screen.getByText('Ankauf: in Verkaufsbestand übernehmen')
    ).toBeInTheDocument()
  })

  it('renders nothing while closed', () => {
    render(PurchaseIntoStockModal, { props: { open: false, vehicleId: 'v1' } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the submit button enabled and surfaces the date error on click', async () => {
    render(PurchaseIntoStockModal, { props: { open: true, vehicleId: 'v1' } })
    await fireEvent.input(dateInput(), { target: { value: '' } })
    // Always-clickable rule: no validity gating on the button itself.
    expect(submitButton()).not.toBeDisabled()
    await fireEvent.click(submitButton())
    expect(
      screen.getByText('Bitte ein Ankaufsdatum eingeben.')
    ).toBeInTheDocument()
    expect(purchaseVehicleIntoStockRemote).not.toHaveBeenCalled()
  })

  it('rejects a negative price with a German click-time error', async () => {
    render(PurchaseIntoStockModal, { props: { open: true, vehicleId: 'v1' } })
    await fireEvent.input(priceInput(), { target: { value: '-5' } })
    await fireEvent.click(submitButton())
    expect(
      screen.getByText(
        'Bitte einen gültigen Ankaufspreis (mindestens 0) eingeben.'
      )
    ).toBeInTheDocument()
    expect(purchaseVehicleIntoStockRemote).not.toHaveBeenCalled()
  })

  it('submits date + price and closes the modal on success', async () => {
    const onDone = vi.fn()
    render(PurchaseIntoStockModal, {
      props: { open: true, vehicleId: 'v1', onDone }
    })
    await fireEvent.input(priceInput(), { target: { value: '1500' } })
    await fireEvent.click(submitButton())

    expect(purchaseVehicleIntoStockRemote).toHaveBeenCalledWith({
      id: 'v1',
      purchaseDate: todayIso(),
      purchasePrice: 1500
    })
    expect(onDone).toHaveBeenCalledOnce()
    expect(
      screen.queryByText('Ankauf: in Verkaufsbestand übernehmen')
    ).not.toBeInTheDocument()
  })

  it('omits the price key when the field stays empty', async () => {
    render(PurchaseIntoStockModal, { props: { open: true, vehicleId: 'v1' } })
    await fireEvent.click(submitButton())
    expect(purchaseVehicleIntoStockRemote).toHaveBeenCalledWith({
      id: 'v1',
      purchaseDate: todayIso()
    })
  })

  it('ships the host query instances via single-flight updates', async () => {
    const sentinelA = { kind: 'vehicle-query' }
    const sentinelB = { kind: 'related-query' }
    const buildUpdates = vi.fn(() => [sentinelA, sentinelB])
    render(PurchaseIntoStockModal, {
      props: {
        open: true,
        vehicleId: 'v1',
        buildUpdates: buildUpdates as never
      }
    })
    await fireEvent.click(submitButton())
    expect(buildUpdates).toHaveBeenCalledOnce()
    expect(updatesSpy).toHaveBeenCalledWith(sentinelA, sentinelB)
  })
})
