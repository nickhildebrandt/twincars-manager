import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import Pagination from './Pagination.svelte'

/**
 * Component tests for Pagination — page-button rendering and callback firing.
 *
 * @group component
 * @module Pagination
 */
describe('Pagination', () => {
  it('shows total + current page text', () => {
    render(Pagination, {
      props: { page: 2, pageCount: 5, total: 120, size: 25, onPage: vi.fn() }
    })
    expect(screen.getByText(/120/)).toBeInTheDocument()
    expect(screen.getByText(/Seite 2 von 5/)).toBeInTheDocument()
  })

  it('disables prev buttons on first page', () => {
    render(Pagination, {
      props: { page: 1, pageCount: 5, total: 100, size: 25, onPage: vi.fn() }
    })
    expect(screen.getByLabelText(/erste seite/i)).toBeDisabled()
    expect(screen.getByLabelText(/vorherige seite/i)).toBeDisabled()
  })

  it('disables next buttons on last page', () => {
    render(Pagination, {
      props: { page: 5, pageCount: 5, total: 100, size: 25, onPage: vi.fn() }
    })
    expect(screen.getByLabelText(/nächste seite/i)).toBeDisabled()
    expect(screen.getByLabelText(/letzte seite/i)).toBeDisabled()
  })

  it('fires onPage when a number button is clicked', async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    render(Pagination, {
      props: { page: 1, pageCount: 5, total: 100, size: 25, onPage }
    })
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(onPage).toHaveBeenCalledWith(3)
  })

  it('renders the size selector when onSize is provided', async () => {
    const user = userEvent.setup()
    const onSize = vi.fn()
    render(Pagination, {
      props: {
        page: 1,
        pageCount: 5,
        total: 100,
        size: 25,
        onPage: vi.fn(),
        onSize
      }
    })
    const select = screen.getByLabelText(/seitengröße/i) as HTMLSelectElement
    await user.selectOptions(select, '50')
    expect(onSize).toHaveBeenCalledWith(50)
  })
})
