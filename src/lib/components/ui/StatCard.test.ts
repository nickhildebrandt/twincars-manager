import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { Inbox } from '@lucide/svelte'
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

  it('exposes the full value as a title attribute for truncated numbers', () => {
    render(StatCard, { props: { title: 'Umsatz', value: '1.234.567,89 €' } })
    expect(screen.getByTitle('1.234.567,89 €')).toBeInTheDocument()
  })

  it('renders the icon with the requested color pairing', () => {
    const { container } = render(StatCard, {
      props: { title: 'Offen', value: 3, icon: Inbox, color: 'warning' }
    })
    const iconWrap = container.querySelector('svg')?.parentElement
    expect(iconWrap).toHaveClass('bg-warning', 'text-warning-content')
  })

  it('falls back to the neutral icon background without a color', () => {
    const { container } = render(StatCard, {
      props: { title: 'Offen', value: 3, icon: Inbox }
    })
    const iconWrap = container.querySelector('svg')?.parentElement
    expect(iconWrap).toHaveClass('bg-base-200')
  })
})
