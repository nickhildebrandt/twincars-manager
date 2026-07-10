import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { createRawSnippet } from 'svelte'
import Toolbar from './Toolbar.svelte'

/**
 * Component tests for Toolbar — search-input and onQuery debounce, plus
 * the filters / actions snippet slots used by list pages.
 *
 * @group component
 * @module Toolbar
 */
describe('Toolbar', () => {
  it('renders search box with placeholder', () => {
    render(Toolbar, { props: { placeholder: 'Suchen…' } })
    expect(screen.getByPlaceholderText('Suchen…')).toBeInTheDocument()
  })

  it('eventually fires onQuery after user types (debounced)', async () => {
    const onQuery = vi.fn()
    const user = userEvent.setup()
    render(Toolbar, { props: { onQuery } })
    const input = screen.getByPlaceholderText(/suchen/i)
    await user.type(input, 'hi')
    await new Promise((r) => setTimeout(r, 350))
    expect(onQuery).toHaveBeenCalledWith('hi')
  })

  it('shows a preset query value in the search input', () => {
    render(Toolbar, { props: { query: 'golf' } })
    expect(screen.getByDisplayValue('golf')).toBeInTheDocument()
  })

  it('renders the filters and actions snippets', () => {
    const filters = createRawSnippet(() => ({
      render: () => `<select aria-label="Status"><option>Alle</option></select>`
    }))
    const actions = createRawSnippet(() => ({
      render: () => `<button type="button">Exportieren</button>`
    }))
    render(Toolbar, { props: { filters, actions } })
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportieren' })
    ).toBeInTheDocument()
  })
})
