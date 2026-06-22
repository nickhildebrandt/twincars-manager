import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { createRawSnippet } from 'svelte'
import ComingSoon from './ComingSoon.svelte'

/**
 * Component tests for ComingSoon.
 *
 * @group unit
 * @module ComingSoon
 */
describe('ComingSoon', () => {
  it('renders the default German heading', () => {
    render(ComingSoon)
    expect(
      screen.getByRole('heading', { name: 'In Vorbereitung' })
    ).toBeInTheDocument()
  })

  it('renders the default intro copy', () => {
    render(ComingSoon)
    expect(screen.getByText(/Dieses Modul ist im Aufbau/)).toBeInTheDocument()
  })

  it('renders no list when features are omitted', () => {
    const { container } = render(ComingSoon)
    expect(container.querySelector('ul')).toBeNull()
  })

  it('renders one list item per feature', () => {
    render(ComingSoon, {
      props: { features: ['Stammdaten', 'Belege', 'Reports'] }
    })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Stammdaten')
    expect(items[1]).toHaveTextContent('Belege')
    expect(items[2]).toHaveTextContent('Reports')
  })

  it('renders the children snippet when provided', () => {
    const children = createRawSnippet(() => ({
      render: () => `<button data-testid="cs-child">Mehr erfahren</button>`
    }))
    render(ComingSoon, { props: { children } })
    expect(screen.getByTestId('cs-child')).toBeInTheDocument()
    expect(screen.getByText('Mehr erfahren')).toBeInTheDocument()
  })
})
