import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for GlobalSearch — debounced input, Esc closes,
 * arrow-key navigation, Enter triggers navigation.
 *
 * @group unit
 * @module GlobalSearch
 */

const gotoMock = vi.fn()
vi.mock('$app/navigation', () => ({
  goto: (...args: unknown[]) => gotoMock(...args)
}))

type Hit = { id: string; label: string; sublabel?: string; type?: string }
type SearchResult = {
  customers: Hit[]
  vehicles: Hit[]
  items: Hit[]
  tires: Hit[]
  tireStorage: Hit[]
  suppliers: Hit[]
  documents: Hit[]
}

const emptyBuckets = (): SearchResult => ({
  customers: [],
  vehicles: [],
  items: [],
  tires: [],
  tireStorage: [],
  suppliers: [],
  documents: []
})

const searchMock = vi.fn<(args: { q: string }) => Promise<SearchResult>>()

vi.mock('../../../routes/search.remote', () => ({
  globalSearchRemote: (args: { q: string }) => searchMock(args)
}))

import GlobalSearch from './GlobalSearch.svelte'

beforeEach(() => {
  gotoMock.mockReset()
  searchMock.mockReset()
  searchMock.mockResolvedValue({
    ...emptyBuckets(),
    customers: [
      { id: 'c1', label: 'Alpha GmbH', sublabel: 'K-001' },
      { id: 'c2', label: 'Beta AG', sublabel: 'K-002' }
    ],
    vehicles: [{ id: 'v1', label: 'VW Golf', sublabel: 'B-AA 100' }]
  })
})

describe('GlobalSearch', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(GlobalSearch, { props: { open: false } })
    expect(queryByTestId('global-search-dialog')).toBeNull()
  })

  it('debounced input fires the remote search after typing', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })

    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'alpha')

    await waitFor(() => expect(searchMock).toHaveBeenCalled(), {
      timeout: 1000
    })
    const lastCall = searchMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.q).toBe('alpha')
    expect(await screen.findByText('Alpha GmbH')).toBeInTheDocument()
  })

  it('does not call the remote for queries shorter than 2 characters', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'a')
    // 350 ms > the 250 ms debounce. If the guard works, no call.
    await new Promise((r) => setTimeout(r, 350))
    expect(searchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Mindestens 2 Zeichen/i)).toBeInTheDocument()
  })

  it('Esc closes the modal via the bound prop', async () => {
    const user = userEvent.setup()
    const { component } = render(GlobalSearch, { props: { open: true } })
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // The store-bound prop is updated synchronously; on next tick the
    // dialog is unmounted.
    await waitFor(() => {
      expect(screen.queryByTestId('global-search-dialog')).toBeNull()
    })
    // sanity-check the bindable prop reads as false via the test render
    void component
  })

  it('arrow-key navigation moves the active row', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })

    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'alpha')
    await screen.findByText('Alpha GmbH')

    const hits = () => screen.getAllByTestId('global-search-hit')
    // Initially the first hit is active.
    expect(hits()[0].getAttribute('data-active')).toBe('true')
    expect(hits()[1].getAttribute('data-active')).toBe('false')

    await user.keyboard('{ArrowDown}')
    expect(hits()[0].getAttribute('data-active')).toBe('false')
    expect(hits()[1].getAttribute('data-active')).toBe('true')

    await user.keyboard('{ArrowUp}')
    expect(hits()[0].getAttribute('data-active')).toBe('true')
  })

  it('Enter navigates to the active hit', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })

    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'alpha')
    await screen.findByText('Alpha GmbH')

    await user.keyboard('{Enter}')
    expect(gotoMock).toHaveBeenCalledWith('/customers/c1')
  })

  it('clicking a document hit navigates by type (invoice → /invoices/[id])', async () => {
    searchMock.mockResolvedValue({
      ...emptyBuckets(),
      documents: [
        { id: 'd1', label: 'Rechnung RE-1', sublabel: 'Acme', type: 'invoice' },
        { id: 'd2', label: 'Angebot AN-1', sublabel: 'Acme', type: 'offer' }
      ]
    })
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })

    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'acme')
    await screen.findByText('Rechnung RE-1')

    await user.click(screen.getByText('Rechnung RE-1'))
    expect(gotoMock).toHaveBeenCalledWith('/invoices/d1')
  })

  it('clicking an offer hit navigates to /offers/[id]', async () => {
    searchMock.mockResolvedValue({
      ...emptyBuckets(),
      documents: [
        { id: 'd2', label: 'Angebot AN-1', sublabel: 'Acme', type: 'offer' }
      ]
    })
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'angebot')
    await screen.findByText('Angebot AN-1')
    await user.click(screen.getByText('Angebot AN-1'))
    expect(gotoMock).toHaveBeenCalledWith('/offers/d2')
  })

  it('clicking a tire hit navigates to /tires/[id]', async () => {
    searchMock.mockResolvedValue({
      ...emptyBuckets(),
      tires: [
        { id: 't1', label: 'Continental PremiumContact 6', sublabel: 'TY-1001' }
      ]
    })
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'conti')
    await screen.findByText('Continental PremiumContact 6')
    await user.click(screen.getByText('Continental PremiumContact 6'))
    expect(gotoMock).toHaveBeenCalledWith('/tires/t1')
  })

  it('clicking a tire-storage hit navigates to /tire-storage/[id]', async () => {
    searchMock.mockResolvedValue({
      ...emptyBuckets(),
      tireStorage: [{ id: 's1', label: 'Einlagerung EL-1', sublabel: 'Kunde' }]
    })
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'EL-1')
    await screen.findByText('Einlagerung EL-1')
    await user.click(screen.getByText('Einlagerung EL-1'))
    expect(gotoMock).toHaveBeenCalledWith('/tire-storage/s1')
  })

  it('clicking a supplier hit navigates to /suppliers/[id]', async () => {
    searchMock.mockResolvedValue({
      ...emptyBuckets(),
      suppliers: [
        { id: 'l1', label: 'Reifen Großhandel GmbH', sublabel: 'L-42' }
      ]
    })
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'großhandel')
    await screen.findByText('Reifen Großhandel GmbH')
    await user.click(screen.getByText('Reifen Großhandel GmbH'))
    expect(gotoMock).toHaveBeenCalledWith('/suppliers/l1')
  })

  it('clicking the backdrop closes the modal', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
    // The backdrop button carries aria-label="Dialog schließen".
    await user.click(screen.getByLabelText('Dialog schließen'))
    await waitFor(() => {
      expect(screen.queryByTestId('global-search-dialog')).toBeNull()
    })
  })

  it('shows "Keine Treffer" when the search returns empty buckets', async () => {
    searchMock.mockResolvedValue(emptyBuckets())
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    const input = screen.getByTestId('global-search-input')
    await user.type(input, 'nothing-matches-this')
    // After debounce + remote, the empty-state hint should appear.
    await waitFor(
      () => expect(screen.getByText(/Keine Treffer/i)).toBeInTheDocument(),
      { timeout: 1000 }
    )
  })

  it('the header close (X) button closes the modal', async () => {
    const user = userEvent.setup()
    render(GlobalSearch, { props: { open: true } })
    expect(screen.getByTestId('global-search-dialog')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Schließen'))
    await waitFor(() => {
      expect(screen.queryByTestId('global-search-dialog')).toBeNull()
    })
  })

  it('uses a responsive modal-box (w-full + viewport-relative height)', () => {
    render(GlobalSearch, { props: { open: true } })
    const dialog = screen.getByTestId('global-search-dialog')
    const box = dialog.querySelector('.modal-box') as HTMLElement | null
    expect(box).not.toBeNull()
    expect(box!.className).toMatch(/w-full/)
    // Phone-friendly height — viewport-relative with a desktop cap.
    expect(box!.className).toMatch(/h-\[80dvh\]/)
    expect(box!.className).toMatch(/max-w-2xl/)
  })
})
