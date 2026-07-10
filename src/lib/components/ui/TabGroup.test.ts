import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the app-wide standard TabGroup (DaisyUI v5
 * `tabs-lift` radio pattern) — accessibility semantics, keyboard
 * operability via the shared radio group, `?tab=` URL sync in state
 * mode and `goto` navigation in nav mode.
 *
 * @group component
 * @module TabGroup
 */

const { pageMock, gotoMock, replaceStateMock } = vi.hoisted(() => ({
  pageMock: {
    url: new URL('http://localhost/base'),
    state: {} as Record<string, never>
  },
  gotoMock: vi.fn<(href: string) => Promise<void>>(),
  replaceStateMock: vi.fn()
}))

vi.mock('$app/state', () => ({ page: pageMock }))
vi.mock('$app/navigation', () => ({
  goto: (href: string) => gotoMock(href),
  replaceState: (...args: unknown[]) => replaceStateMock(...args)
}))

import Harness from './TabGroup.test.harness.svelte'

const stateTabs = [
  { id: 'one', label: 'Erster Tab' },
  { id: 'two', label: 'Zweiter Tab' },
  { id: 'three', label: 'Dritter Tab', badge: 7 }
]

beforeEach(() => {
  pageMock.url = new URL('http://localhost/base')
  gotoMock.mockReset()
  gotoMock.mockResolvedValue(undefined)
  replaceStateMock.mockReset()
})

describe('TabGroup — state mode', () => {
  it('renders a tablist with one labelled radio per tab, first checked', () => {
    render(Harness, { name: 'g1', tabs: stateTabs })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    // Unique shared radio name = native arrow-key group semantics.
    for (const r of radios) {
      expect(r).toHaveAttribute('type', 'radio')
      expect(r).toHaveAttribute('name', 'g1')
    }
    expect(screen.getByRole('radio', { name: 'Erster Tab' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Zweiter Tab' })).not.toBeChecked()
    // Badge rendered after the label.
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('keeps every panel mounted (CSS hides inactive ones)', () => {
    render(Harness, { name: 'g2', tabs: stateTabs })
    expect(screen.getByTestId('panel-one')).toBeInTheDocument()
    expect(screen.getByTestId('panel-two')).toBeInTheDocument()
    expect(screen.getByTestId('panel-three')).toBeInTheDocument()
  })

  it('switches the active tab on click and mirrors it into ?tab=', async () => {
    const user = userEvent.setup()
    render(Harness, { name: 'g3', tabs: stateTabs })
    await user.click(screen.getByRole('radio', { name: 'Zweiter Tab' }))
    expect(screen.getByRole('radio', { name: 'Zweiter Tab' })).toBeChecked()
    expect(replaceStateMock).toHaveBeenCalled()
    const url = replaceStateMock.mock.calls.at(-1)![0] as URL
    expect(url.searchParams.get('tab')).toBe('two')
  })

  it('clears ?tab= again when returning to the first (default) tab', async () => {
    const user = userEvent.setup()
    render(Harness, { name: 'g4', tabs: stateTabs })
    await user.click(screen.getByRole('radio', { name: 'Zweiter Tab' }))
    // Simulate the mirrored URL so the effect sees the param as set.
    pageMock.url = new URL('http://localhost/base?tab=two')
    await user.click(screen.getByRole('radio', { name: 'Erster Tab' }))
    const url = replaceStateMock.mock.calls.at(-1)![0] as URL
    expect(url.searchParams.get('tab')).toBeNull()
  })

  it('seeds the active tab from a ?tab= deep link', () => {
    pageMock.url = new URL('http://localhost/base?tab=two')
    render(Harness, { name: 'g5', tabs: stateTabs })
    expect(screen.getByRole('radio', { name: 'Zweiter Tab' })).toBeChecked()
  })

  it('falls back to the first tab for an unknown ?tab= value', () => {
    pageMock.url = new URL('http://localhost/base?tab=nope')
    render(Harness, { name: 'g6', tabs: stateTabs })
    expect(screen.getByRole('radio', { name: 'Erster Tab' })).toBeChecked()
  })

  it('does not touch the URL when urlParam is null', async () => {
    const user = userEvent.setup()
    render(Harness, { name: 'g7', tabs: stateTabs, urlParam: null })
    await user.click(screen.getByRole('radio', { name: 'Zweiter Tab' }))
    expect(replaceStateMock).not.toHaveBeenCalled()
  })

  it('is keyboard operable: arrow keys move through the radio group', async () => {
    const user = userEvent.setup()
    render(Harness, { name: 'g8', tabs: stateTabs })
    screen.getByRole('radio', { name: 'Erster Tab' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Zweiter Tab' })).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Dritter Tab' })).toBeChecked()
  })

  it('resets to the first tab when the active tab disappears', async () => {
    const user = userEvent.setup()
    const { rerender } = render(Harness, { name: 'g9', tabs: stateTabs })
    await user.click(screen.getByRole('radio', { name: 'Dritter Tab' }))
    expect(screen.getByRole('radio', { name: 'Dritter Tab' })).toBeChecked()
    await rerender({ name: 'g9', tabs: stateTabs.slice(0, 2) })
    expect(screen.getByRole('radio', { name: 'Erster Tab' })).toBeChecked()
  })
})

describe('TabGroup — navigation mode', () => {
  const navTabs = [
    { id: 'general', label: 'Allgemein', href: '/settings', exact: true },
    { id: 'mail', label: 'Mailvorlagen', href: '/settings/mail' },
    { id: 'smtp', label: 'SMTP', href: '/settings/smtp' }
  ]

  it('derives the active tab from the pathname (prefix matching)', () => {
    pageMock.url = new URL('http://localhost/settings/mail/whatever')
    render(Harness, { name: 'n1', tabs: navTabs })
    expect(screen.getByRole('radio', { name: 'Mailvorlagen' })).toBeChecked()
  })

  it('matches exact-only tabs strictly', () => {
    pageMock.url = new URL('http://localhost/settings')
    render(Harness, { name: 'n2', tabs: navTabs })
    expect(screen.getByRole('radio', { name: 'Allgemein' })).toBeChecked()
  })

  it('navigates via goto when another tab is selected', async () => {
    const user = userEvent.setup()
    pageMock.url = new URL('http://localhost/settings')
    render(Harness, { name: 'n3', tabs: navTabs })
    await user.click(screen.getByRole('radio', { name: 'SMTP' }))
    expect(gotoMock).toHaveBeenCalledWith('/settings/smtp')
  })

  it('renders only the active panel (it is the routed page)', () => {
    pageMock.url = new URL('http://localhost/settings/smtp')
    render(Harness, { name: 'n4', tabs: navTabs })
    expect(screen.getByTestId('panel-smtp')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-general')).not.toBeInTheDocument()
    expect(screen.queryByTestId('panel-mail')).not.toBeInTheDocument()
  })
})
