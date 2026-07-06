import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SearchablePicker from './SearchablePicker.svelte'

/**
 * Component tests for SearchablePicker — placeholder, dialog open, search
 * debounce, item selection, clearing (span[role=button] inside the
 * button trigger, incl. keyboard) and the single header "Neu anlegen"
 * affordance (createLabel + onCreateNew).
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

/** The trigger is the <button> carrying the `input` class. */
const trigger = () =>
  screen
    .getAllByRole('button')
    .find((b) => b.tagName === 'BUTTON' && b.className.includes('input'))!

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

  it('groups clear + chevron in a flex row instead of absolute positioning', () => {
    render(SearchablePicker, {
      props: {
        value: 'a',
        valueLabel: 'Alpha GmbH',
        search: vi.fn(),
        onSelect: vi.fn()
      }
    })
    const t = trigger()
    // No reserved right padding, justify-between pushes the icon group
    // flush right.
    expect(t.className).not.toContain('pr-16')
    expect(t.className).toContain('justify-between')
    const clear = screen.getByRole('button', { name: 'Auswahl entfernen' })
    // The clear affordance lives INSIDE the trigger, as an accessible
    // span[role=button] (a nested <button> would be invalid HTML)…
    expect(t.contains(clear)).toBe(true)
    expect(clear.tagName).toBe('SPAN')
    expect(clear).toHaveAttribute('tabindex', '0')
    // …sharing a shrink-0 flex group with the chevron.
    const group = clear.parentElement!
    expect(group.className).toContain('shrink-0')
    expect(group.className).toContain('items-center')
    expect(group.querySelector('svg.lucide-chevron-down')).toBeTruthy()
    expect(group.className).not.toContain('absolute')
  })

  it('keeps the icon group layout for triggerSize sm', () => {
    render(SearchablePicker, {
      props: {
        value: 'a',
        valueLabel: 'Alpha GmbH',
        search: vi.fn(),
        onSelect: vi.fn(),
        triggerSize: 'sm'
      }
    })
    const t = trigger()
    expect(t.className).toContain('input-sm')
    const clear = screen.getByRole('button', { name: 'Auswahl entfernen' })
    expect(t.contains(clear)).toBe(true)
  })

  it('opens the dialog and runs an initial search', async () => {
    const user = userEvent.setup()
    const search = vi
      .fn()
      .mockResolvedValue({ items, total: items.length, pageCount: 1 })
    render(SearchablePicker, {
      props: { value: '', valueLabel: '', search, onSelect: vi.fn() }
    })
    await user.click(trigger())
    await waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0][0]).toMatchObject({ q: '', page: 1, size: 25 })
    expect(await screen.findByText('Alpha GmbH')).toBeInTheDocument()
  })

  it('clears via keyboard on the focused clear affordance', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const search = vi.fn()
    render(SearchablePicker, {
      props: { value: 'a', valueLabel: 'Alpha GmbH', search, onSelect }
    })
    const clear = screen.getByRole('button', { name: 'Auswahl entfernen' })
    clear.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(null)
    // The keypress must not open the surrounding trigger's dialog.
    expect(search).not.toHaveBeenCalled()
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
    await user.click(trigger())
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
    await user.click(trigger())
    const row = await screen.findByRole('button', { name: /Beta AG/ })
    await user.click(row)
    expect(onSelect).toHaveBeenCalledWith({ id: 'b', label: 'Beta AG' })
  })

  it('clear button calls onSelect(null) without opening the dialog', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const search = vi.fn()
    const { rerender, container } = render(SearchablePicker, {
      props: { value: '', valueLabel: '', search, onSelect }
    })
    expect(
      screen.queryByRole('button', { name: 'Auswahl entfernen' })
    ).not.toBeInTheDocument()

    await rerender({ value: 'a', valueLabel: 'Alpha GmbH', search, onSelect })
    const clearBtn = screen.getByRole('button', { name: 'Auswahl entfernen' })
    // Accessible span[role=button] — a nested <button> would be
    // invalid HTML inside the button trigger.
    expect(clearBtn.tagName).toBe('SPAN')
    await user.click(clearBtn)
    expect(onSelect).toHaveBeenCalledWith(null)
    // stopPropagation: clearing must not open the dialog / run a search.
    expect(search).not.toHaveBeenCalled()
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(false)
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
    const t = trigger()
    expect(t).toBeDisabled()
    await user.click(t)
    expect(search).not.toHaveBeenCalled()
  })

  it('applies the sm trigger size variant', () => {
    render(SearchablePicker, {
      props: {
        value: '',
        valueLabel: '',
        search: vi.fn(),
        onSelect: vi.fn(),
        triggerSize: 'sm'
      }
    })
    expect(trigger().className).toContain('input-sm')
  })

  describe('create affordance (header only)', () => {
    it('hides the create button when createLabel/onCreateNew are not set', async () => {
      const user = userEvent.setup()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      render(SearchablePicker, {
        props: { value: '', valueLabel: '', search, onSelect: vi.fn() }
      })
      await user.click(trigger())
      await waitFor(() => expect(search).toHaveBeenCalled())
      expect(
        screen.queryByRole('button', { name: /Neu anlegen/ })
      ).not.toBeInTheDocument()
    })

    it('hides the create button when only createLabel is set', async () => {
      const user = userEvent.setup()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      render(SearchablePicker, {
        props: {
          value: '',
          valueLabel: '',
          search,
          onSelect: vi.fn(),
          createLabel: 'Neu anlegen'
        }
      })
      await user.click(trigger())
      await waitFor(() => expect(search).toHaveBeenCalled())
      expect(
        screen.queryByRole('button', { name: /Neu anlegen/ })
      ).not.toBeInTheDocument()
    })

    it('renders the create button exactly once, in the dialog header', async () => {
      const user = userEvent.setup()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      render(SearchablePicker, {
        props: {
          value: '',
          valueLabel: '',
          search,
          onSelect: vi.fn(),
          createLabel: 'Neu anlegen',
          onCreateNew: vi.fn()
        }
      })
      await user.click(trigger())
      await screen.findByText('Alpha GmbH')
      const createButtons = screen.getAllByRole('button', {
        name: /Neu anlegen/
      })
      expect(createButtons).toHaveLength(1)
      // Header placement: shares a parent with the close (X) button.
      const closeBtn = screen.getByRole('button', { name: 'Schließen' })
      expect(createButtons[0].parentElement).toBe(closeBtn.parentElement)
    })

    it('shows only the empty text in the empty state, no second affordance', async () => {
      const user = userEvent.setup()
      const search = vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, pageCount: 1 })
      render(SearchablePicker, {
        props: {
          value: '',
          valueLabel: '',
          search,
          onSelect: vi.fn(),
          createLabel: 'Neu anlegen',
          onCreateNew: vi.fn()
        }
      })
      await user.click(trigger())
      expect(
        await screen.findByText('Keine passenden Einträge gefunden.')
      ).toBeInTheDocument()
      // Still exactly one create button — the header one.
      expect(
        screen.getAllByRole('button', { name: /Neu anlegen/ })
      ).toHaveLength(1)
    })

    it('clicking the create button closes the dialog and calls onCreateNew', async () => {
      const user = userEvent.setup()
      const onCreateNew = vi.fn()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      const { container } = render(SearchablePicker, {
        props: {
          value: '',
          valueLabel: '',
          search,
          onSelect: vi.fn(),
          createLabel: 'Neu anlegen',
          onCreateNew
        }
      })
      await user.click(trigger())
      await screen.findByText('Alpha GmbH')
      await user.click(screen.getByRole('button', { name: /Neu anlegen/ }))
      expect(onCreateNew).toHaveBeenCalledTimes(1)
      const dialog = container.querySelector('dialog') as HTMLDialogElement
      expect(dialog.hasAttribute('open')).toBe(false)
    })
  })
})
