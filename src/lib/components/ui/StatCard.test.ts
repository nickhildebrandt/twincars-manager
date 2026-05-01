import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import StatCard from './StatCard.svelte'

/**
 * Component tests for StatCard.
 *
 * @group component
 * @module StatCard
 */
describe('StatCard', () => {
  it('renders title and value', () => {
    render(StatCard, { props: { title: 'Kunden', value: 42 } })
    expect(screen.getByText('Kunden')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders desc when provided', () => {
    render(StatCard, {
      props: { title: 'Umsatz', value: '1.000 €', desc: 'Letzter Monat' }
    })
    expect(screen.getByText('Letzter Monat')).toBeInTheDocument()
  })
})
