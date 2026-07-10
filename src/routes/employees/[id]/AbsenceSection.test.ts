import { render, screen, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import AbsenceSection from './AbsenceSection.svelte'

/**
 * Component tests for the employee-detail absence card — balance
 * breakdown, year gating, click-time German validation (button never
 * disabled for invalid input) and the submit/delete/status callbacks.
 *
 * @group component
 * @module AbsenceSection
 */

const CURRENT_YEAR = new Date().getFullYear()

const baseBalance = { year: CURRENT_YEAR, entitled: 30, used: 5, remaining: 25 }

const vacationRow = {
  id: 'row-1',
  type: 'vacation',
  dateFrom: `${CURRENT_YEAR}-06-01`,
  dateTo: `${CURRENT_YEAR}-06-05`,
  halfDay: false,
  notes: null,
  status: 'approved',
  workdays: 5,
  workdaysInYear: 5
}

const sickRow = {
  id: 'row-2',
  type: 'sick',
  dateFrom: `${CURRENT_YEAR}-02-02`,
  dateTo: `${CURRENT_YEAR}-02-03`,
  halfDay: false,
  notes: 'AU liegt vor',
  status: 'approved',
  workdays: 2,
  workdaysInYear: 2
}

function renderSection(
  overrides: Partial<{
    year: number
    absences: (typeof vacationRow)[]
    balance: typeof baseBalance
    onSubmit: (values: unknown) => Promise<boolean>
    onSetStatus: (id: string, status: string) => void
    onDelete: (id: string) => void
  }> = {}
) {
  const props = {
    year: CURRENT_YEAR,
    absences: [vacationRow, sickRow],
    balance: baseBalance,
    onSubmit: vi.fn(async () => true),
    onSetStatus: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  }
  const utils = render(AbsenceSection, { props })
  return { ...utils, props }
}

const setDate = async (input: HTMLInputElement, value: string) => {
  await fireEvent.input(input, { target: { value } })
  await fireEvent.change(input, { target: { value } })
}

const dateInputs = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(container.querySelectorAll('input[type="date"]'))

describe('AbsenceSection', () => {
  it('renders the balance breakdown for the selected year', () => {
    renderSection()
    expect(screen.getByText(`Anspruch ${CURRENT_YEAR}`)).toBeInTheDocument()
    expect(screen.getByText('Genommen')).toBeInTheDocument()
    expect(screen.getByText('Resturlaub')).toBeInTheDocument()
    expect(screen.getByText('Krankheitstage')).toBeInTheDocument()
    expect(screen.getByText('25 Tage')).toBeInTheDocument()
  })

  it('lists rows with type labels, workday counts and status badges', () => {
    // 'Urlaub'/'Krankheit' also appear as select options — count > 1.
    renderSection()
    expect(screen.getAllByText('Urlaub').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Krankheit').length).toBeGreaterThan(1)
    // Two row badges plus the status select option.
    expect(screen.getAllByText('Genehmigt').length).toBe(3)
    expect(screen.getByText('AU liegt vor')).toBeInTheDocument()
  })

  it('shows the halbtags badge and 0,5 days for half-day rows', () => {
    renderSection({
      absences: [
        {
          ...vacationRow,
          halfDay: true,
          workdays: 0.5,
          workdaysInYear: 0.5,
          dateTo: vacationRow.dateFrom
        }
      ]
    })
    expect(screen.getByText('halbtags')).toBeInTheDocument()
    expect(screen.getAllByText('0,5').length).toBeGreaterThan(0)
  })

  it('keeps Eintragen enabled even for an invalid range (rule 1.1)', async () => {
    const { container } = renderSection()
    const [from, to] = dateInputs(container)
    await setDate(from, `${CURRENT_YEAR}-06-10`)
    await setDate(to, `${CURRENT_YEAR}-06-01`)
    expect(
      screen.getByRole('button', { name: /eintragen/i })
    ).not.toBeDisabled()
  })

  it('rejects dateTo before dateFrom with a German error, no submit', async () => {
    const user = userEvent.setup()
    const { container, props } = renderSection()
    const [from, to] = dateInputs(container)
    await setDate(from, `${CURRENT_YEAR}-06-10`)
    await setDate(to, `${CURRENT_YEAR}-06-01`)
    await user.click(screen.getByRole('button', { name: /eintragen/i }))
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bis-Datum darf nicht vor dem Von-Datum liegen.')
    ).toBeInTheDocument()
  })

  // Note: the >1-year span rule is client-side unreachable by design —
  // the year picker snaps both dates into one calendar year, capping
  // any enterable span at 365/366 days. The rule stays as server
  // belt-and-braces and is covered in employees.remote.test.ts.

  it('rejects a multi-day half-day entry', async () => {
    const user = userEvent.setup()
    const { container, props } = renderSection()
    const [from, to] = dateInputs(container)
    await setDate(from, `${CURRENT_YEAR}-06-01`)
    await setDate(to, `${CURRENT_YEAR}-06-02`)
    await user.click(container.querySelector('.checkbox') as HTMLInputElement)
    await user.click(screen.getByRole('button', { name: /eintragen/i }))
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Ein halber Tag ist nur bei eintägigen Abwesenheiten möglich.'
      )
    ).toBeInTheDocument()
  })

  it('submits a valid entry and resets the form on success', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => true)
    const { container } = renderSection({ onSubmit })
    const [from, to] = dateInputs(container)
    await setDate(from, `${CURRENT_YEAR}-08-03`)
    await setDate(to, `${CURRENT_YEAR}-08-07`)
    const notes = screen.getByPlaceholderText(/Fortbildung/) as HTMLInputElement
    await user.type(notes, 'B2 Testnotiz')
    await user.click(screen.getByRole('button', { name: /eintragen/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'vacation',
      dateFrom: `${CURRENT_YEAR}-08-03`,
      dateTo: `${CURRENT_YEAR}-08-07`,
      halfDay: false,
      notes: 'B2 Testnotiz',
      status: 'approved'
    })
    // Reset: the notes field is cleared again.
    expect(notes.value).toBe('')
  })

  it('keeps the form values when onSubmit reports failure', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => false)
    const { container } = renderSection({ onSubmit })
    const notes = screen.getByPlaceholderText(/Fortbildung/) as HTMLInputElement
    await user.type(notes, 'bleibt stehen')
    await user.click(screen.getByRole('button', { name: /eintragen/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(notes.value).toBe('bleibt stehen')
    void container
  })

  it('hides the form and mutations for past years', () => {
    renderSection({ year: CURRENT_YEAR - 1 })
    expect(
      screen.getByText('Vergangene Jahre sind schreibgeschützt.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /eintragen/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Löschen' })
    ).not.toBeInTheDocument()
  })

  it('hides the Krankheit option for future years', async () => {
    const user = userEvent.setup()
    renderSection()
    expect(screen.getByRole('option', { name: 'Krankheit' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Nächstes Jahr' }))
    expect(
      screen.queryByRole('option', { name: 'Krankheit' })
    ).not.toBeInTheDocument()
  })

  it('navigates years with the picker buttons', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: 'Vorheriges Jahr' }))
    const yearButton = screen.getByRole('button', {
      name: String(CURRENT_YEAR - 1)
    })
    expect(yearButton).toBeInTheDocument()
    // Clicking the year button itself jumps back to the current year.
    await user.click(yearButton)
    expect(
      screen.getByRole('button', { name: String(CURRENT_YEAR) })
    ).toBeInTheDocument()
  })

  it('fires onDelete and onSetStatus from the row actions', async () => {
    const user = userEvent.setup()
    const { props } = renderSection()
    const deleteButtons = screen.getAllByRole('button', { name: 'Löschen' })
    await user.click(deleteButtons[0])
    expect(props.onDelete).toHaveBeenCalledWith('row-1')
    const cancelButtons = screen.getAllByRole('button', { name: 'Stornieren' })
    await user.click(cancelButtons[1])
    expect(props.onSetStatus).toHaveBeenCalledWith('row-2', 'cancelled')
  })

  it('shows the empty state without rows', () => {
    renderSection({ absences: [] })
    expect(
      screen.getByText('Noch keine Abwesenheiten erfasst.')
    ).toBeInTheDocument()
  })
})
