import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import Pagination from './Pagination.svelte'

/**
 * Component tests for Pagination — page-button rendering and callback firing.
 * Page size is fixed app-wide at 25; the component does not render a selector.
 *
 * The component renders TWO join variants (compact for phones, full for
 * sm and up) — CSS hides one of them per breakpoint, but jsdom renders
 * both, so prev/next queries expect two matches.
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
    const prev = screen.getAllByLabelText(/vorherige seite/i)
    expect(prev).toHaveLength(2)
    for (const btn of prev) expect(btn).toBeDisabled()
  })

  it('disables next buttons on last page', () => {
    render(Pagination, {
      props: { page: 5, pageCount: 5, total: 100, size: 25, onPage: vi.fn() }
    })
    expect(screen.getByLabelText(/letzte seite/i)).toBeDisabled()
    const next = screen.getAllByLabelText(/nächste seite/i)
    expect(next).toHaveLength(2)
    for (const btn of next) expect(btn).toBeDisabled()
  })

  it('fires onPage when a number button is clicked', async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    render(Pagination, {
      props: { page: 1, pageCount: 5, total: 100, size: 25, onPage }
    })
    // "3" appears in both the compact and the full join.
    const [first] = screen.getAllByRole('button', { name: '3' })
    await user.click(first)
    expect(onPage).toHaveBeenCalledWith(3)
  })

  it('renders a phone join and a full join with breakpoint classes', () => {
    render(Pagination, {
      props: { page: 1, pageCount: 5, total: 100, size: 25, onPage: vi.fn() }
    })
    const compact = screen.getByTestId('pagination-compact')
    const full = screen.getByTestId('pagination-full')
    expect(compact).toHaveClass('sm:hidden', 'max-w-full')
    expect(full).toHaveClass('hidden', 'sm:flex', 'max-w-full')
  })

  it('keeps first/last chevrons out of the compact join', () => {
    render(Pagination, {
      props: {
        page: 3,
        pageCount: 424,
        total: 10600,
        size: 25,
        onPage: vi.fn()
      }
    })
    const compact = screen.getByTestId('pagination-compact')
    const full = screen.getByTestId('pagination-full')
    // First/last chevrons exist exactly once and only in the full join.
    const first = screen.getByLabelText(/erste seite/i)
    const last = screen.getByLabelText(/letzte seite/i)
    expect(full).toContainElement(first)
    expect(full).toContainElement(last)
    // Compact join uses the smaller 3-number window.
    const compactNumbers = Array.from(
      compact.querySelectorAll('button')
    ).filter((b) => /^\d+$/.test(b.textContent ?? ''))
    const fullNumbers = Array.from(full.querySelectorAll('button')).filter(
      (b) => /^\d+$/.test(b.textContent ?? '')
    )
    expect(compactNumbers.length).toBeLessThan(fullNumbers.length)
  })

  it('does not render a size selector', () => {
    render(Pagination, {
      props: { page: 1, pageCount: 5, total: 100, size: 25, onPage: vi.fn() }
    })
    expect(screen.queryByLabelText(/seitengröße/i)).not.toBeInTheDocument()
  })
})
