import { fireEvent, render, screen } from '@testing-library/svelte'
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
const progressRunMock = vi.hoisted(() =>
  vi.fn<() => Promise<unknown>>(async () => null)
)

vi.mock('./import.remote', () => ({
  runMdbImportRemote: (input: unknown) => runImportMock(input),
  // The poller must use `.run()` — the only imperative execution path
  // for remote queries outside a tracking context (`refresh()` on a
  // fresh proxy is a silent no-op, awaiting the proxy throws).
  getImportProgressRemote: () => ({
    current: null,
    refresh: async () => undefined,
    run: progressRunMock
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

  it('renders live progress from the polled job row during a real import', async () => {
    // Regression: the poller previously called `refresh()` on a fresh
    // query proxy (silent no-op) and then awaited the proxy (throws
    // outside a tracking context) — the bar stayed frozen at 0 %.
    const user = userEvent.setup()
    progressRunMock.mockReset()
    progressRunMock.mockResolvedValue({
      id: 'job-1',
      status: 'running',
      progress: 42,
      progressLabel: 'Rechnungen werden importiert …',
      startedAt: new Date().toISOString(),
      finishedAt: null
    })
    // Keep the import command pending while we observe the poller.
    let resolveImport: (v: unknown) => void = () => undefined
    runImportMock.mockImplementation(
      () => new Promise((resolve) => (resolveImport = resolve))
    )

    render(ImportPage)
    const file = new File(['0'.repeat(2048)], 'kfz-kaufmann.mdb', {
      type: 'application/x-msaccess'
    })
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: /import starten/i }))
    // The ConfirmDialog's <dialog> carries no `open` attribute (DaisyUI
    // shows it via .modal-open CSS), so jsdom treats it as hidden.
    const confirmBtn = await screen.findByRole('button', {
      name: /jetzt importieren/i,
      hidden: true
    })
    await fireEvent.click(confirmBtn)

    // Poll interval is 1 s — wait for the first tick to land in the UI.
    await screen.findByText(
      'Rechnungen werden importiert …',
      {},
      { timeout: 4000 }
    )
    expect(screen.getByText('42 %')).toBeInTheDocument()
    expect(progressRunMock).toHaveBeenCalled()

    // Unblock the pending command so the test leaves no dangling work.
    resolveImport(null)
  }, 15000)
})
