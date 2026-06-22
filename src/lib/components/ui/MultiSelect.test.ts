import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import MultiSelect from './MultiSelect.svelte'

/**
 * Component tests for MultiSelect — placeholder, chip rendering,
 * filter, toggle behaviour, disabled state.
 *
 * @group unit
 * @module MultiSelect
 */

const sampleOptions = [
  { id: 'a', label: 'Administrator', sublabel: 'Voller Zugriff' },
  { id: 'b', label: 'Buchhaltung', sublabel: 'Belege, Kasse' },
  { id: 'c', label: 'Werkstatt' }
]

describe('MultiSelect', () => {
  it('renders the placeholder when nothing is selected', () => {
    render(MultiSelect, {
      props: {
        options: sampleOptions,
        selected: [],
        placeholder: 'Rollen wählen…'
      }
    })
    expect(screen.getByText('Rollen wählen…')).toBeInTheDocument()
  })

  it('renders chips for every selected option', () => {
    render(MultiSelect, {
      props: { options: sampleOptions, selected: ['a', 'c'] }
    })
    const chips = screen.getAllByTestId('multiselect-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveTextContent('Administrator')
    expect(chips[1]).toHaveTextContent('Werkstatt')
  })

  it('filters options by the search input', async () => {
    const user = userEvent.setup()
    render(MultiSelect, { props: { options: sampleOptions, selected: [] } })
    await user.click(screen.getByTestId('multiselect-trigger'))
    expect(screen.getAllByTestId('multiselect-option')).toHaveLength(3)

    const filter = screen.getByTestId('multiselect-filter')
    await user.type(filter, 'buch')
    expect(screen.getAllByTestId('multiselect-option')).toHaveLength(1)
    expect(screen.getByTestId('multiselect-option')).toHaveTextContent(
      'Buchhaltung'
    )
  })

  it('clicking an option toggles selection (check + uncheck)', async () => {
    const user = userEvent.setup()
    const { component } = render(MultiSelect, {
      props: { options: sampleOptions, selected: [] }
    })
    await user.click(screen.getByTestId('multiselect-trigger'))
    const opts = screen.getAllByTestId('multiselect-option')
    // Find the Administrator option
    const admin = opts.find((o) => o.getAttribute('data-option-id') === 'a')!
    await user.click(admin)
    // A chip for Administrator should appear in the trigger.
    await waitFor(() => {
      expect(screen.getByTestId('multiselect-chip')).toHaveTextContent(
        'Administrator'
      )
    })
    // Click the same option again to deselect.
    const adminAgain = screen
      .getAllByTestId('multiselect-option')
      .find((o) => o.getAttribute('data-option-id') === 'a')!
    await user.click(adminAgain)
    await waitFor(() => {
      expect(screen.queryByTestId('multiselect-chip')).toBeNull()
    })
    void component
  })

  it('chip remove button deselects without toggling the option', async () => {
    const user = userEvent.setup()
    render(MultiSelect, { props: { options: sampleOptions, selected: ['a'] } })
    expect(screen.getByTestId('multiselect-chip')).toHaveTextContent(
      'Administrator'
    )
    // The removal button is identified by its aria-label.
    const removeChip = screen.getByLabelText('„Administrator" entfernen')
    await user.click(removeChip)
    await waitFor(() => {
      expect(screen.queryByTestId('multiselect-chip')).toBeNull()
    })
  })

  it('disabled state hides chip remove buttons and prevents opening', async () => {
    const user = userEvent.setup()
    render(MultiSelect, {
      props: { options: sampleOptions, selected: ['a'], disabled: true }
    })
    // Chip is shown but the inline X is hidden.
    expect(screen.getByTestId('multiselect-chip')).toHaveTextContent(
      'Administrator'
    )
    expect(
      screen.queryByLabelText('„Administrator" entfernen')
    ).not.toBeInTheDocument()
    // Clicking the trigger does not open the dropdown.
    await user.click(screen.getByTestId('multiselect-trigger'))
    expect(screen.queryByTestId('multiselect-dropdown')).toBeNull()
  })

  it('renders the empty hint when the options list is empty', async () => {
    const user = userEvent.setup()
    render(MultiSelect, {
      props: { options: [], selected: [], emptyHint: 'Keine Rollen vorhanden.' }
    })
    await user.click(screen.getByTestId('multiselect-trigger'))
    expect(screen.getByText('Keine Rollen vorhanden.')).toBeInTheDocument()
  })

  it('exposes the onChange callback when a chip is removed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn<(selected: string[]) => void>()
    render(MultiSelect, {
      props: { options: sampleOptions, selected: ['a', 'b'], onChange }
    })
    const removeChip = screen.getByLabelText('„Administrator" entfernen')
    await user.click(removeChip)
    expect(onChange).toHaveBeenCalledTimes(1)
    // After removing 'a', only 'b' remains in the new selection.
    expect(onChange.mock.calls[0][0]).toEqual(['b'])
  })

  it('clears all chips when every selected option is removed one-by-one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn<(selected: string[]) => void>()
    render(MultiSelect, {
      props: { options: sampleOptions, selected: ['a', 'c'], onChange }
    })
    expect(screen.getAllByTestId('multiselect-chip')).toHaveLength(2)
    await user.click(screen.getByLabelText('„Administrator" entfernen'))
    await waitFor(() =>
      expect(screen.getAllByTestId('multiselect-chip')).toHaveLength(1)
    )
    await user.click(screen.getByLabelText('„Werkstatt" entfernen'))
    await waitFor(() =>
      expect(screen.queryByTestId('multiselect-chip')).toBeNull()
    )
    // Final state: placeholder is back.
    // onChange was called once per removal.
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[1][0]).toEqual([])
  })

  it('closes the dropdown when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(MultiSelect, { props: { options: sampleOptions, selected: [] } })
    await user.click(screen.getByTestId('multiselect-trigger'))
    expect(screen.getByTestId('multiselect-dropdown')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('multiselect-dropdown')).toBeNull()
    })
  })
})
