import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.svelte'

/**
 * Component tests for ConfirmDialog — open/closed, labels, callbacks, variant.
 *
 * @group unit
 * @module ConfirmDialog
 */
describe('ConfirmDialog', () => {
  it('renders nothing when open=false', () => {
    render(ConfirmDialog, {
      props: {
        open: false,
        title: 'Wirklich löschen?',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    expect(screen.queryByText('Wirklich löschen?')).not.toBeInTheDocument()
  })

  it('renders title and message when open', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Wirklich löschen?',
        message: 'Diese Aktion kann nicht rückgängig gemacht werden.',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    expect(screen.getByText('Wirklich löschen?')).toBeInTheDocument()
    expect(
      screen.getByText('Diese Aktion kann nicht rückgängig gemacht werden.')
    ).toBeInTheDocument()
  })

  it('shows default German labels for confirm/cancel', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Frage',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    expect(
      screen.getByRole('button', { name: 'Bestätigen', hidden: true })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Abbrechen', hidden: true })
    ).toBeInTheDocument()
  })

  it('uses custom confirm and cancel labels when provided', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Frage',
        confirmLabel: 'Jetzt löschen',
        cancelLabel: 'Nein, doch nicht',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    expect(
      screen.getByRole('button', { name: 'Jetzt löschen', hidden: true })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Nein, doch nicht', hidden: true })
    ).toBeInTheDocument()
  })

  it('invokes onConfirm and onClose when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(ConfirmDialog, {
      props: { open: true, title: 'Frage', onConfirm, onClose }
    })
    await user.click(
      screen.getByRole('button', { name: 'Bestätigen', hidden: true })
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('invokes onClose (but not onConfirm) when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(ConfirmDialog, {
      props: { open: true, title: 'Frage', onConfirm, onClose }
    })
    await user.click(
      screen.getByRole('button', { name: 'Abbrechen', hidden: true })
    )
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('danger variant applies btn-error class to confirm button', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Frage',
        variant: 'danger',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    const confirm = screen.getByRole('button', {
      name: 'Bestätigen',
      hidden: true
    })
    expect(confirm).toHaveClass('btn-error')
    expect(confirm).not.toHaveClass('btn-primary')
  })

  it('primary variant (default) applies btn-primary class to confirm button', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Frage',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    })
    const confirm = screen.getByRole('button', {
      name: 'Bestätigen',
      hidden: true
    })
    expect(confirm).toHaveClass('btn-primary')
    expect(confirm).not.toHaveClass('btn-error')
  })

  it('clicking the backdrop closes the dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(ConfirmDialog, {
      props: { open: true, title: 'Frage', onConfirm: vi.fn(), onClose }
    })
    await user.click(
      screen.getByRole('button', { name: 'Schließen', hidden: true })
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
