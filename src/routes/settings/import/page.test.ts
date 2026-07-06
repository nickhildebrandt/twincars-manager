import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the KFZ-Kaufmann import page — rule 1.1: the
 * action buttons stay clickable without a picked file; a click shows
 * the German message instead of running the import.
 *
 * @group component
 * @module settings-import-page
 */

const runImportMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('./import.remote', () => ({
  runMdbImportRemote: (input: unknown) => runImportMock(input),
  getImportProgressRemote: () => ({
    current: null,
    refresh: async () => undefined
  })
}))

import ImportPage from './+page.svelte'

describe('settings import page', () => {
  beforeEach(() => {
    runImportMock.mockReset()
    runImportMock.mockResolvedValue(undefined)
  })

  it('keeps both action buttons enabled without a picked file (rule 1.1)', () => {
    render(ImportPage)
    expect(
      screen.getByRole('button', { name: /vorschau \(ohne speichern\)/i })
    ).not.toBeDisabled()
    expect(
      screen.getByRole('button', { name: /import starten/i })
    ).not.toBeDisabled()
  })

  it('shows the German message on "Import starten" without a file', async () => {
    const user = userEvent.setup()
    render(ImportPage)
    await user.click(screen.getByRole('button', { name: /import starten/i }))
    expect(runImportMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte zuerst eine .mdb-Datei auswählen.')
    ).toBeInTheDocument()
    // The confirmation dialog is NOT opened.
    expect(screen.queryByText('Import jetzt starten?')).not.toBeInTheDocument()
  })

  it('shows the German message on "Vorschau" without a file', async () => {
    const user = userEvent.setup()
    render(ImportPage)
    await user.click(
      screen.getByRole('button', { name: /vorschau \(ohne speichern\)/i })
    )
    expect(runImportMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte zuerst eine .mdb-Datei auswählen.')
    ).toBeInTheDocument()
  })
})
