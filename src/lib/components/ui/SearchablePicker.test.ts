import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SearchablePicker from './SearchablePicker.svelte'

/**
 * Component tests for SearchablePicker — placeholder, dialog open, search
 * debounce, item selection, clearing.
 *
 * @group unit
 * @module SearchablePicker
 */
type Item = { id: string; label: string }

const items: Item[] = [
  { id: 'a', label: 'Alpha GmbH' },
  { id: 'b', label: 'Beta AG' },
  { id: 'c', label: 'Gamma KG' }
]

beforeEach(() => {
  // jsdom does not implement <dialog>; provide minimal stubs so showModal /
  // close don't blow up. The DOM still renders the dialog children inline.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  }
})

describe('SearchablePicker', () => {
  it('renders the placeholder when no value is set', () => {
    render(SearchablePicker, {
      props: {
        value: '',
        valueLabel: '',
        placeholder: '— Kunde wählen —',
        search: vi.fn(),
        onSelect: vi.fn()
      }
    })
    expect(screen.getByText('— Kunde wählen —')).toBeInTheDocument()
  })

  it('renders the current valueLabel when a value is set', () => {
    render(SearchablePicker, {
      props: {
        value: 'a',
        valueLabel: 'Alpha GmbH',
        search: vi.fn(),
        onSelect: vi.fn()
      }
    })
    expect(screen.getByText('Alpha GmbH')).toBeInTheDocument()
  })

  it('opens the dialog and runs an initial search', async () => {
    const user = userEvent.setup()
    const search = vi
      .fn()
      .mockResolvedValue({ items, total: items.length, pageCount: 1 })
    render(SearchablePicker, {
      props: { value: '', valueLabel: '', search, onSelect: vi.fn() }
    })
    await user.click(screen.getByRole('button', { name: /wählen/i }))
    await waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0][0]).toMatchObject({ q: '', page: 1, size: 25 })
    expect(await screen.findByText('Alpha GmbH')).toBeInTheDocument()
  })

  it('typing in the search box triggers a debounced filtered search', async () => {
    // Use real timers — userEvent + jsdom + the component's 250 ms debounce
    // play poorly with fake timers (userEvent.type schedules its own setTimeout
    // delays which can deadlock when fake timers aren't advanced async-ly
    // across awaits). 500 ms of real time is fast and reliable.
    const user = userEvent.setup()
    const search = vi
      .fn()
      .mockResolvedValue({ items, total: items.length, pageCount: 1 })
    render(SearchablePicker, {
      props: { value: '', valueLabel: '', search, onSelect: vi.fn() }
    })
    await user.click(screen.getByRole('button', { name: /wählen/i }))
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))

    const input = screen.getByPlaceholderText('Suchen…')
    await user.type(input, 'beta')

    await waitFor(() => expect(search).toHaveBeenCalledTimes(2), {
      timeout: 1000
    })
    expect(search.mock.calls[1][0]).toMatchObject({
      q: 'beta',
      page: 1,
      size: 25
    })
  })

  it('clicking an item calls onSelect with that item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const search = vi
      .fn()
      .mockResolvedValue({ items, total: items.length, pageCount: 1 })
    render(SearchablePicker, {
      props: { value: '', valueLabel: '', search, onSelect }
    })
    await user.click(screen.getByRole('button', { name: /wählen/i }))
    const row = await screen.findByRole('button', { name: /Beta AG/ })
    await user.click(row)
    expect(onSelect).toHaveBeenCalledWith({ id: 'b', label: 'Beta AG' })
  })

  it('clear button calls onSelect(null) and is only shown when a value exists', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(SearchablePicker, {
      props: { value: '', valueLabel: '', search: vi.fn(), onSelect }
    })
    expect(
      screen.queryByRole('button', { name: 'Auswahl entfernen' })
    ).not.toBeInTheDocument()

    await rerender({
      value: 'a',
      valueLabel: 'Alpha GmbH',
      search: vi.fn(),
      onSelect
    })
    const clearBtn = screen.getByRole('button', { name: 'Auswahl entfernen' })
    await user.click(clearBtn)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('disabled trigger does not open the dialog', async () => {
    const user = userEvent.setup()
    const search = vi.fn()
    render(SearchablePicker, {
      props: {
        value: '',
        valueLabel: '',
        search,
        onSelect: vi.fn(),
        disabled: true
      }
    })
    await user.click(screen.getByRole('button', { name: /wählen/i }))
    expect(search).not.toHaveBeenCalled()
  })
})
