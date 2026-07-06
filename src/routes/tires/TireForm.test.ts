import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

/**
 * Component tests for TireForm — covers the required-field guards,
 * the season picklist, the size-triple validation and the EU-label
 * single-letter check.
 *
 * @group component
 * @module TireForm
 */

import TireForm from './TireForm.svelte'

const validBase = {
  brand: 'Continental',
  model: 'PremiumContact 6',
  width: 205,
  aspectRatio: 55,
  diameterInch: 16,
  season: 'Sommer' as const
}

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

  it('keeps Speichern enabled even while the form is empty (rule 1.1)', () => {
    render(TireForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the brand error on a click without a brand', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte die Marke angeben.').length
    ).toBeGreaterThan(0)
  })

  it('shows the width error on a click without a width', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, {
      props: {
        onSave,
        initial: { brand: 'A', model: 'B', aspectRatio: 55, diameterInch: 16 }
      }
    })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte die Breite in mm angeben.').length
    ).toBeGreaterThan(0)
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

  it('submits onlineSellable without any shipping data (module removed)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(TireForm, { props: { onSave, initial: validBase } })
    expect(screen.queryByText('Versandoption')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Online verkaufbar'))
    expect(screen.queryByText('Versandoption')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const args = onSave.mock.calls[0][0]
    expect(args.onlineSellable).toBe(true)
    expect('shippingOptionId' in args).toBe(false)
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

  it('keeps a pristine form free of error messages', () => {
    render(TireForm, { props: { onSave: vi.fn() } })
    expect(
      screen.queryByText('Bitte die Marke angeben.')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Bitte die Breite in mm angeben.')
    ).not.toBeInTheDocument()
  })

  it('shows the brand error only after blur', async () => {
    const { container } = render(TireForm, { props: { onSave: vi.fn() } })
    const brand = container.querySelector(
      'input[maxlength="80"]'
    ) as HTMLInputElement
    expect(
      screen.queryByText('Bitte die Marke angeben.')
    ).not.toBeInTheDocument()
    await fireEvent.blur(brand)
    expect(screen.getByText('Bitte die Marke angeben.')).toBeInTheDocument()
    expect(brand.className).toContain('input-error')
  })

  it('surfaces the per-field errors after a submit attempt', async () => {
    const onSave = vi.fn()
    const { container } = render(TireForm, { props: { onSave } })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte die Marke angeben.').length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Bitte die Breite in mm angeben.').length
    ).toBeGreaterThan(0)
  })

  it('shows the EU-label error after a submit attempt with a two-letter value', async () => {
    const { container } = render(TireForm, {
      props: {
        onSave: vi.fn(),
        initial: { ...validBase, fuelEfficiency: 'XY' }
      }
    })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(
      screen.getAllByText('Bitte einen einzelnen Buchstaben (A-E) angeben.')
        .length
    ).toBeGreaterThan(0)
  })
})
