import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import Toolbar from './Toolbar.svelte'

/**
 * Component tests for Toolbar — search-input and onQuery debounce.
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
})
