import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the shared PositionsEditor — module helpers
 * (blankPosition / cleanPosition / applyVehicleToPosition), rendering of
 * the desktop table and the stacked phone layout, add/remove rows,
 * live totals and the source switch to a picker.
 *
 * @group component
 * @module PositionsEditor
 */

// The embedded SearchablePickers call the picker remotes — mock them
// with empty result pages so no server code is imported.
const emptyPage = () =>
  Promise.resolve({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })

vi.mock('../pickers.remote', () => ({
  pickItemsRemote: () => ({ run: () => emptyPage() }),
  pickInventoryVehiclesRemote: () => ({ run: () => emptyPage() })
}))

import {
  applyVehicleToPosition,
  blankPosition,
  cleanPosition,
  type Position
} from './PositionsEditor.svelte'
// Harness binds a deep-reactive `$state` array to the editor — exactly
// how both create pages consume it.
import Harness from './PositionsEditor.test.harness.svelte'

beforeEach(() => {
  // jsdom does not implement <dialog>; provide minimal stubs so the
  // SearchablePicker can mount.
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

describe('module helpers', () => {
  it('blankPosition returns a free row with sensible defaults', () => {
    expect(blankPosition()).toEqual({
      description: '',
      quantity: 1,
      unit: 'Stk',
      unitPriceNet: 0,
      discountPercent: 0,
      taxRate: 19,
      source: 'free',
      sourceRef: '',
      sourceLabel: '',
      kind: 'article'
    })
  })

  it('cleanPosition trims and coerces numeric fields', () => {
    const p: Position = {
      ...blankPosition(),
      description: '  Bremsen  ',
      quantity: '2',
      unitPriceNet: '10.5',
      discountPercent: '',
      taxRate: '7',
      articleNumber: ''
    }
    expect(cleanPosition(p)).toEqual({
      description: 'Bremsen',
      quantity: 2,
      unit: 'Stk',
      unitPriceNet: 10.5,
      discountPercent: 0,
      taxRate: 7,
      kind: 'article',
      articleNumber: undefined
    })
  })

  it('applyVehicleToPosition converts gross to net at 19 % for regular tax', () => {
    const filled = applyVehicleToPosition(blankPosition(), {
      id: 'v1',
      label: 'VW Golf',
      plate: 'B-XY 1',
      vin: 'WVWZZZ',
      make: 'VW',
      model: 'Golf',
      firstRegistration: '2020-01-01',
      salesPriceGross: 11900,
      differentialTax: false
    })
    expect(filled.unitPriceNet).toBe(10000)
    expect(filled.taxRate).toBe(19)
    expect(filled.source).toBe('vehicle')
    expect(filled.kind).toBe('vehicle')
    expect(filled.sourceRef).toBe('v1')
    expect(filled.sourceLabel).toBe('VW Golf')
    expect(filled.description).toContain('Fahrzeug VW Golf')
    expect(filled.description).toContain('Kennz.: B-XY 1')
    expect(filled.description).toContain('FIN: WVWZZZ')
    expect(filled.description).toContain('EZ: 2020-01-01')
  })

  it('applyVehicleToPosition keeps the gross price at 0 % for differential tax', () => {
    const filled = applyVehicleToPosition(blankPosition(), {
      id: 'v2',
      label: 'Opel Corsa',
      plate: null,
      vin: null,
      make: 'Opel',
      model: 'Corsa',
      firstRegistration: null,
      salesPriceGross: 5000,
      differentialTax: true
    })
    expect(filled.unitPriceNet).toBe(5000)
    expect(filled.taxRate).toBe(0)
  })
})

describe('PositionsEditor', () => {
  it('renders one row in both the table and the stacked phone layout', () => {
    const { container } = render(Harness, {
      props: { initial: [blankPosition()] }
    })
    // Desktop table with the 9 columns.
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Beschreibung')).toHaveLength(2)
    // Table wrapper hidden below md; phone list hidden from md up.
    expect(container.querySelector('.hidden.md\\:block')).not.toBeNull()
    expect(container.querySelector('.md\\:hidden')).not.toBeNull()
    // The phone block header names the position.
    expect(screen.getByText('Position 1')).toBeInTheDocument()
    // Each field is rendered twice (table + stacked block).
    expect(screen.getAllByLabelText('Quelle')).toHaveLength(2)
    expect(screen.getAllByLabelText('Menge')).toHaveLength(2)
    expect(screen.getAllByLabelText('Einzelpreis')).toHaveLength(2)
    expect(screen.getAllByLabelText('MwSt %')).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: 'Position löschen' })
    ).toHaveLength(2)
  })

  it('adds a row via the "Position hinzufügen" button', async () => {
    const user = userEvent.setup()
    render(Harness, { props: { initial: [blankPosition()] } })
    await user.click(screen.getByTestId('add-position'))
    expect(screen.getByText('Position 2')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Quelle')).toHaveLength(4)
  })

  it('removes a row via the delete button', async () => {
    const user = userEvent.setup()
    render(Harness, {
      props: {
        initial: [
          { ...blankPosition(), description: 'Erste' },
          { ...blankPosition(), description: 'Zweite' }
        ]
      }
    })
    expect(screen.getByText('Position 2')).toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', { name: 'Position löschen' })[0]
    )
    expect(screen.queryByText('Position 2')).not.toBeInTheDocument()
    // The remaining row is the former second one.
    const descriptions = screen.getAllByPlaceholderText(
      'Beschreibung'
    ) as HTMLInputElement[]
    expect(descriptions[0].value).toBe('Zweite')
  })

  it('computes net, tax and gross totals from the rows', () => {
    render(Harness, {
      props: {
        initial: [
          {
            ...blankPosition(),
            description: 'Arbeit',
            quantity: 2,
            unitPriceNet: 100,
            taxRate: 19
          },
          {
            ...blankPosition(),
            description: 'Teil',
            quantity: 1,
            unitPriceNet: 50,
            discountPercent: 10,
            taxRate: 7
          }
        ]
      }
    })
    // net = 200 + 45 = 245; tax = 38 + 3.15 = 41.15; gross = 286.15
    expect(screen.getByText('245,00 €')).toBeInTheDocument()
    expect(screen.getByText('41,15 €')).toBeInTheDocument()
    expect(screen.getByText('286,15 €')).toBeInTheDocument()
  })

  it('updates the totals when a price is typed', async () => {
    const user = userEvent.setup()
    render(Harness, {
      props: { initial: [{ ...blankPosition(), description: 'Frei' }] }
    })
    const price = screen.getAllByLabelText('Einzelpreis')[0]
    await user.clear(price)
    await user.type(price, '100')
    // Netto 100, MwSt 19, Brutto 119.
    expect(screen.getByText('100,00 €')).toBeInTheDocument()
    expect(screen.getByText('19,00 €')).toBeInTheDocument()
    expect(screen.getByText('119,00 €')).toBeInTheDocument()
  })

  it('switching the source to Artikel swaps the description input for a picker', async () => {
    const user = userEvent.setup()
    render(Harness, { props: { initial: [blankPosition()] } })
    expect(screen.getAllByPlaceholderText('Beschreibung')).toHaveLength(2)
    const sourceSelects = screen.getAllByLabelText('Quelle')
    await user.selectOptions(sourceSelects[0], 'article')
    expect(
      screen.queryByPlaceholderText('Beschreibung')
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Artikel auswählen/ }).length
    ).toBeGreaterThanOrEqual(2)
  })

  it('uses the custom description placeholder when provided', () => {
    render(Harness, {
      props: {
        initial: [blankPosition()],
        descriptionPlaceholder: 'z. B. Sonderposition'
      }
    })
    expect(screen.getAllByPlaceholderText('z. B. Sonderposition')).toHaveLength(
      2
    )
  })
})
