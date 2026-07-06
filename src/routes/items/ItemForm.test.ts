import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

/**
 * Component tests for ItemForm — after the Migration-0022 cleanup the
 * form is the Werkstattleistungen / Material / Artikel master only:
 * no attribute editor, no online-shop toggle, no tire kind. Tires
 * live in their own form (`/tires/TireForm.svelte`).
 *
 * @group component
 * @module ItemForm
 */

import ItemForm from './ItemForm.svelte'

describe('ItemForm', () => {
  it('renders the core stammdaten labels', () => {
    render(ItemForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Beschreibung *')).toBeInTheDocument()
    expect(screen.getByText('Typ')).toBeInTheDocument()
  })

  it('keeps Speichern enabled even without a description (rule 1.1)', () => {
    render(ItemForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('shows the required-description message on a click without one', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(ItemForm, { props: { onSave } })
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte eine Beschreibung eingeben.').length
    ).toBeGreaterThan(0)
  })

  it('does not offer the "Reifen" kind anymore', () => {
    render(ItemForm, { props: { onSave: vi.fn() } })
    const select = screen.getByLabelText('Typ', {
      selector: 'select'
    }) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).not.toContain('tire')
    expect(options).toEqual(['service', 'material', 'article', 'pass_through'])
  })

  it('does not render an attribute editor or an online-shop toggle', () => {
    render(ItemForm, { props: { onSave: vi.fn() } })
    expect(screen.queryByText('Attribute')).not.toBeInTheDocument()
    expect(screen.queryByText('Online-Shop')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Online verkaufbar')).not.toBeInTheDocument()
  })

  describe('kind', () => {
    it('round-trips an existing kind from the initial prop', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(ItemForm, {
        props: { onSave, initial: { description: 'X', kind: 'service' } }
      })
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave.mock.calls[0][0].kind).toBe('service')
    })

    it('rejects a whitespace-only description at click time', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(ItemForm, { props: { onSave, initial: { description: '   ' } } })
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave).not.toHaveBeenCalled()
      expect(
        screen.getAllByText('Bitte eine Beschreibung eingeben.').length
      ).toBeGreaterThan(0)
    })

    it('invokes onCancel when the cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(ItemForm, {
        props: { onSave: vi.fn(), onCancel, initial: { description: 'X' } }
      })
      await user.click(screen.getByRole('button', { name: /abbrechen/i }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('trims description before save', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(ItemForm, {
        props: { onSave, initial: { description: '  Padded  ' } }
      })
      await user.click(screen.getByRole('button', { name: /speichern/i }))
      expect(onSave.mock.calls[0][0].description).toBe('Padded')
    })
  })
})
