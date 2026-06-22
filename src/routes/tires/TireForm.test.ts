import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for TireForm — covers the required-field guards,
 * the season picklist, the size-triple validation and the EU-label
 * single-letter check.
 *
 * The shipping-option picker is mocked so the jsdom environment can
 * mount the form without pulling server-only code through
 * `pickers.remote.ts`.
 *
 * @group component
 * @module TireForm
 */

vi.mock('../pickers.remote', () => ({
  pickShippingOptionsRemote: () => ({
    run: async () => ({ items: [], total: 0, page: 1, size: 25, pageCount: 1 })
  })
}))

import TireForm from './TireForm.svelte'

const validBase = {
  brand: 'Continental',
  model: 'PremiumContact 6',
  width: 205,
  aspectRatio: 55,
  diameterInch: 16,
  season: 'Sommer' as const
}

beforeEach(() => {
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

describe('TireForm', () => {
  it('renders the required field legends', () => {
    render(TireForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Marke *')).toBeInTheDocument()
    expect(screen.getByText('Modell *')).toBeInTheDocument()
    expect(screen.getByText('Saison *')).toBeInTheDocument()
    expect(screen.getByText('Breite (mm) *')).toBeInTheDocument()
    expect(screen.getByText('Querschnitt (%) *')).toBeInTheDocument()
    expect(screen.getByText('Zoll *')).toBeInTheDocument()
  })

  it('keeps Speichern disabled without a brand', async () => {
    const onSave = vi.fn()
    render(TireForm, { props: { onSave } })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps Speichern disabled without a width', async () => {
    const onSave = vi.fn()
    render(TireForm, {
      props: {
        onSave,
        initial: { brand: 'A', model: 'B', aspectRatio: 55, diameterInch: 16 }
      }
    })
    const btn = screen.getByRole('button', {
      name: /speichern/i
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('exposes the three German season options', () => {
    render(TireForm, { props: { onSave: vi.fn() } })
    const select = screen.getByLabelText('Saison *', {
      selector: 'select'
    }) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      'Sommer',
      'Winter',
      'Ganzjahres'
    ])
  })

  it('uppercases EU-label letters and submits a full payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, {
      props: {
        onSave,
        initial: {
          ...validBase,
          fuelEfficiency: 'b',
          wetGrip: 'a',
          noiseClass: 'B'
        }
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const args = onSave.mock.calls[0][0]
    expect(args.brand).toBe('Continental')
    expect(args.width).toBe(205)
    expect(args.aspectRatio).toBe(55)
    expect(args.diameterInch).toBe(16)
    expect(args.season).toBe('Sommer')
    expect(args.fuelEfficiency).toBe('B')
    expect(args.wetGrip).toBe('A')
    expect(args.noiseClass).toBe('B')
  })

  it('rejects an EU-label letter of more than one character', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, {
      props: { onSave, initial: { ...validBase, fuelEfficiency: 'XY' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('hides the shipping picker until "Online verkaufbar" is toggled on', async () => {
    const user = userEvent.setup()
    render(TireForm, { props: { onSave: vi.fn(), initial: validBase } })
    expect(screen.queryByText('Versandoption')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Online verkaufbar'))
    expect(screen.getByText('Versandoption')).toBeInTheDocument()
  })

  it('round-trips the construction value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, {
      props: { onSave, initial: { ...validBase, construction: 'D' } }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave.mock.calls[0][0].construction).toBe('D')
  })
})
