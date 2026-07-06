import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MultiSearchablePicker from './MultiSearchablePicker.svelte'

/**
 * Component tests for MultiSearchablePicker — trigger text variants,
 * checkbox rows, cross-page selection, transactional Übernehmen /
 * Abbrechen semantics, clear-all and the header create affordance.
 *
 * @group unit
 * @module MultiSearchablePicker
 */
type Item = { id: string; label: string }

const pageOne: Item[] = [
  { id: 'a', label: 'Anna Admin · P-1' },
  { id: 'b', label: 'Bernd Bauer · P-2' }
]
const pageTwo: Item[] = [
  { id: 'c', label: 'Clara Chef · P-3' },
  { id: 'd', label: 'Dirk Dreher · P-4' }
]

/** Two-page search stub: page 1 -> pageOne, page 2 -> pageTwo. */
const twoPageSearch = () =>
  vi
    .fn()
    .mockImplementation(async ({ page }: { page: number }) => ({
      items: page === 1 ? pageOne : pageTwo,
      total: 4,
      pageCount: 2
    }))

beforeEach(() => {
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

describe('MultiSearchablePicker', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(MultiSearchablePicker, {
      props: {
        values: [],
        placeholder: '— Mitarbeiter wählen —',
        search: vi.fn()
      }
    })
    expect(screen.getByText('— Mitarbeiter wählen —')).toBeInTheDocument()
  })

  it('joins up to two labels on the trigger', () => {
    render(MultiSearchablePicker, {
      props: {
        values: ['a', 'b'],
        valueLabels: new Map([
          ['a', 'Anna Admin · P-1'],
          ['b', 'Bernd Bauer · P-2']
        ]),
        search: vi.fn()
      }
    })
    expect(
      screen.getByText('Anna Admin · P-1, Bernd Bauer · P-2')
    ).toBeInTheDocument()
  })

  it('shows "N ausgewählt" for more than two selections', () => {
    render(MultiSearchablePicker, {
      props: {
        values: ['a', 'b', 'c'],
        valueLabels: [
          ['a', 'Anna'],
          ['b', 'Bernd'],
          ['c', 'Clara']
        ] as Array<[string, string]>,
        search: vi.fn()
      }
    })
    expect(screen.getByText('3 ausgewählt')).toBeInTheDocument()
  })

  it('accepts valueLabels as an entry array', () => {
    render(MultiSearchablePicker, {
      props: {
        values: ['a'],
        valueLabels: [['a', 'Anna Admin · P-1']] as Array<[string, string]>,
        search: vi.fn()
      }
    })
    expect(screen.getByText('Anna Admin · P-1')).toBeInTheDocument()
  })

  it('opens the dialog, searches and renders checkbox rows', async () => {
    const user = userEvent.setup()
    const search = twoPageSearch()
    render(MultiSearchablePicker, { props: { values: [], search } })
    await user.click(trigger())
    await waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0][0]).toMatchObject({ q: '', page: 1, size: 25 })
    const box = await screen.findByRole('checkbox', { name: /Anna Admin/ })
    expect(box).not.toBeChecked()
  })

  it('applies the selection via Übernehmen (N) and updates the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(MultiSearchablePicker, {
      props: { values: [], search: twoPageSearch(), onChange }
    })
    await user.click(trigger())
    await user.click(await screen.findByRole('checkbox', { name: /Anna/ }))
    await user.click(screen.getByRole('checkbox', { name: /Bernd/ }))
    const applyBtn = screen.getByRole('button', { name: 'Übernehmen (2)' })
    await user.click(applyBtn)

    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(
      screen.getByText('Anna Admin · P-1, Bernd Bauer · P-2')
    ).toBeInTheDocument()
  })

  it('keeps the selection across pages', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(MultiSearchablePicker, {
      props: { values: [], search: twoPageSearch(), onChange }
    })
    await user.click(trigger())
    await user.click(await screen.findByRole('checkbox', { name: /Anna/ }))

    // Page 2: pick Clara — Anna's tick must survive the page flip.
    // (Pagination renders a compact and a full variant; click the first.)
    await user.click(
      screen.getAllByRole('button', { name: /nächste seite/i })[0]
    )
    await user.click(await screen.findByRole('checkbox', { name: /Clara/ }))
    expect(
      screen.getByRole('button', { name: 'Übernehmen (2)' })
    ).toBeInTheDocument()

    // Back on page 1 Anna is still checked.
    await user.click(
      screen.getAllByRole('button', { name: /vorherige seite/i })[0]
    )
    expect(await screen.findByRole('checkbox', { name: /Anna/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Übernehmen (2)' }))
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
    expect(screen.getByText(/Anna Admin · P-1, Clara Chef · P-3/)).toBeVisible()
  })

  it('Abbrechen discards the working selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(MultiSearchablePicker, {
      props: { values: [], search: twoPageSearch(), onChange }
    })
    await user.click(trigger())
    await user.click(await screen.findByRole('checkbox', { name: /Anna/ }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Bitte wählen')).toBeInTheDocument()

    // Reopening seeds from the (unchanged) bound values: nothing ticked.
    await user.click(trigger())
    expect(
      await screen.findByRole('checkbox', { name: /Anna/ })
    ).not.toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Übernehmen (0)' })
    ).toBeInTheDocument()
  })

  it('unticking a preselected entry removes it on apply', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(MultiSearchablePicker, {
      props: {
        values: ['a', 'b'],
        valueLabels: new Map([
          ['a', 'Anna Admin · P-1'],
          ['b', 'Bernd Bauer · P-2']
        ]),
        search: twoPageSearch(),
        onChange
      }
    })
    await user.click(trigger())
    const anna = await screen.findByRole('checkbox', { name: /Anna/ })
    expect(anna).toBeChecked()
    await user.click(anna)
    await user.click(screen.getByRole('button', { name: 'Übernehmen (1)' }))
    expect(onChange).toHaveBeenCalledWith(['b'])
    // jsdom keeps closed-dialog rows in the DOM — read the trigger text.
    expect(trigger().textContent).toContain('Bernd Bauer · P-2')
    expect(trigger().textContent).not.toContain('Anna')
  })

  it('clear button on the trigger wipes the selection without opening', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const search = vi.fn()
    render(MultiSearchablePicker, {
      props: {
        values: ['a'],
        valueLabels: new Map([['a', 'Anna Admin · P-1']]),
        search,
        onChange
      }
    })
    await user.click(screen.getByRole('button', { name: 'Auswahl entfernen' }))
    expect(onChange).toHaveBeenCalledWith([])
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByText('Bitte wählen')).toBeInTheDocument()
  })

  it('disabled trigger neither opens nor offers the clear button', async () => {
    const user = userEvent.setup()
    const search = vi.fn()
    render(MultiSearchablePicker, {
      props: {
        values: ['a'],
        valueLabels: new Map([['a', 'Anna']]),
        search,
        disabled: true
      }
    })
    expect(
      screen.queryByRole('button', { name: 'Auswahl entfernen' })
    ).not.toBeInTheDocument()
    await user.click(trigger())
    expect(search).not.toHaveBeenCalled()
  })

  it('renders the header create button once and forwards clicks', async () => {
    const user = userEvent.setup()
    const onCreateNew = vi.fn()
    const { container } = render(MultiSearchablePicker, {
      props: {
        values: [],
        search: twoPageSearch(),
        createLabel: 'Neuen Mitarbeiter anlegen',
        onCreateNew
      }
    })
    await user.click(trigger())
    await screen.findByRole('checkbox', { name: /Anna/ })
    const createButtons = screen.getAllByRole('button', {
      name: /Neuen Mitarbeiter anlegen/
    })
    expect(createButtons).toHaveLength(1)
    const closeBtn = screen.getByRole('button', { name: 'Schließen' })
    expect(createButtons[0].parentElement).toBe(closeBtn.parentElement)

    await user.click(createButtons[0])
    expect(onCreateNew).toHaveBeenCalledTimes(1)
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  it('hides the create button without an onCreateNew handler', async () => {
    const user = userEvent.setup()
    render(MultiSearchablePicker, {
      props: {
        values: [],
        search: twoPageSearch(),
        createLabel: 'Neuen Mitarbeiter anlegen'
      }
    })
    await user.click(trigger())
    await screen.findByRole('checkbox', { name: /Anna/ })
    expect(
      screen.queryByRole('button', { name: /Neuen Mitarbeiter anlegen/ })
    ).not.toBeInTheDocument()
  })
})
