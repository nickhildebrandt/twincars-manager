import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRawSnippet } from 'svelte'
import SearchablePicker from './SearchablePicker.svelte'

/**
 * Component tests for SearchablePicker — placeholder, dialog open, search
 * debounce, item selection, clearing, and the optional inline
 * quick-create mode (createLabel + createForm).
 *
 * @group unit
 * @module SearchablePicker
 */
type Item = { id: string; label: string }

type CreateFormArgs = {
  initialQuery: string
  onCreated: (item: Item) => void
  onCancel: () => void
}

/**
 * Minimal quick-create form snippet: shows the initial query and two
 * buttons that forward to onCreated / onCancel — enough to exercise
 * the picker's mode switching without a real form component.
 */
const makeCreateForm = () =>
  createRawSnippet<[CreateFormArgs]>((getArgs) => ({
    render: () =>
      '<div data-testid="quick-create"><span data-testid="qc-query"></span><button type="button" data-testid="qc-save">Anlegen</button><button type="button" data-testid="qc-cancel">Zur Suche</button></div>',
    setup(node) {
      const el = node as HTMLElement
      const query = el.querySelector('[data-testid="qc-query"]')
      if (query) query.textContent = getArgs().initialQuery
      el.querySelector('[data-testid="qc-save"]')?.addEventListener(
        'click',
        () => getArgs().onCreated({ id: 'new-1', label: 'Neu GmbH' })
      )
      el.querySelector('[data-testid="qc-cancel"]')?.addEventListener(
        'click',
        () => getArgs().onCancel()
      )
    }
  }))

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

  describe('inline create mode', () => {
    it('hides the create affordance when createLabel/createForm are not set', async () => {
      const user = userEvent.setup()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      render(SearchablePicker, {
        props: { value: '', valueLabel: '', search, onSelect: vi.fn() }
      })
      await user.click(screen.getByRole('button', { name: /wählen/i }))
      await waitFor(() => expect(search).toHaveBeenCalled())
      expect(
        screen.queryByRole('button', { name: /Neu anlegen/ })
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('quick-create')).not.toBeInTheDocument()
    })

    it('shows the footer button with results and a second affordance in the empty state', async () => {
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
          createForm: makeCreateForm()
        }
      })
      await user.click(screen.getByRole('button', { name: /wählen/i }))
      await screen.findByText('Alpha GmbH')
      // With results: exactly the always-visible footer button.
      expect(
        screen.getAllByRole('button', { name: /Neu anlegen/ })
      ).toHaveLength(1)
      // The create form itself is not rendered in search mode.
      expect(screen.queryByTestId('quick-create')).not.toBeInTheDocument()

      // Empty result set: footer button + empty-state affordance.
      search.mockResolvedValue({ items: [], total: 0, pageCount: 1 })
      const input = screen.getByPlaceholderText('Suchen…')
      await user.type(input, 'zzz')
      await waitFor(
        () =>
          expect(
            screen.getAllByRole('button', { name: /Neu anlegen/ })
          ).toHaveLength(2),
        { timeout: 1000 }
      )
    })

    it('entering create mode hides the search row and passes the query through', async () => {
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
          createForm: makeCreateForm()
        }
      })
      await user.click(screen.getByRole('button', { name: /wählen/i }))
      const input = await screen.findByPlaceholderText('Suchen…')
      await user.type(input, 'Neu')
      await user.click(screen.getByRole('button', { name: /Neu anlegen/ }))

      expect(screen.getByTestId('quick-create')).toBeInTheDocument()
      expect(screen.getByTestId('qc-query')).toHaveTextContent('Neu')
      expect(screen.queryByPlaceholderText('Suchen…')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Neu anlegen/ })
      ).not.toBeInTheDocument()
    })

    it('onCreated selects the created item and closes the dialog', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const search = vi
        .fn()
        .mockResolvedValue({ items, total: items.length, pageCount: 1 })
      const { container } = render(SearchablePicker, {
        props: {
          value: '',
          valueLabel: '',
          search,
          onSelect,
          createLabel: 'Neu anlegen',
          createForm: makeCreateForm()
        }
      })
      await user.click(screen.getByRole('button', { name: /wählen/i }))
      await screen.findByText('Alpha GmbH')
      await user.click(screen.getByRole('button', { name: /Neu anlegen/ }))
      await user.click(screen.getByTestId('qc-save'))

      expect(onSelect).toHaveBeenCalledWith({ id: 'new-1', label: 'Neu GmbH' })
      // The trigger now shows the created item's label.
      expect(screen.getByText('Neu GmbH')).toBeInTheDocument()
      // Dialog is closed again.
      const dialog = container.querySelector('dialog') as HTMLDialogElement
      expect(dialog.hasAttribute('open')).toBe(false)
    })

    it('onCancel returns to search mode and re-runs the search', async () => {
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
          createForm: makeCreateForm()
        }
      })
      await user.click(screen.getByRole('button', { name: /wählen/i }))
      await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
      await user.click(screen.getByRole('button', { name: /Neu anlegen/ }))
      expect(screen.getByTestId('quick-create')).toBeInTheDocument()

      await user.click(screen.getByTestId('qc-cancel'))
      expect(screen.queryByTestId('quick-create')).not.toBeInTheDocument()
      expect(await screen.findByPlaceholderText('Suchen…')).toBeInTheDocument()
      await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
    })
  })
})
