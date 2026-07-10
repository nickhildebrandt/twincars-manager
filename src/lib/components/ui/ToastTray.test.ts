import { render, screen, cleanup, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import ToastTray from './ToastTray.svelte'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Component tests for ToastTray. Renders the current global toast and lets
 * the user dismiss it manually.
 *
 * @group component
 * @module ToastTray
 */
describe('ToastTray', () => {
  beforeEach(() => {
    toast.dismiss()
  })

  afterEach(() => {
    toast.dismiss()
    cleanup()
  })

  it('renders nothing when no toast is active', () => {
    const { container } = render(ToastTray)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('renders the current toast message and variant', async () => {
    render(ToastTray)
    toast.error('Datei zu groß')
    // flush microtasks
    await Promise.resolve()
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/Datei zu groß/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveClass('alert-error')
  })

  it('uses the standard floating-overlay border + shadow', async () => {
    render(ToastTray)
    toast.info('Hinweis')
    await Promise.resolve()
    const alert = await screen.findByRole('status')
    // Floating overlays are the one exemption from the flat-card rule:
    // border-base-300 + shadow-md, matching the AppShell dropdown.
    expect(alert).toHaveClass('border', 'border-base-300', 'shadow-md')
    expect(alert).not.toHaveClass('shadow-lg')
  })

  it('announces politely via role=status + aria-live', async () => {
    render(ToastTray)
    toast.success('Gespeichert.')
    await Promise.resolve()
    const alert = await screen.findByRole('status')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('maps success and warning variants to their alert classes', async () => {
    render(ToastTray)
    toast.success('Kunde angelegt.')
    await Promise.resolve()
    expect(await screen.findByRole('status')).toHaveClass('alert-success')
    expect(screen.getByText('Kunde angelegt.')).toBeInTheDocument()

    toast.warning('Achtung, Bestand niedrig.')
    await Promise.resolve()
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveClass('alert-warning')
    )
    expect(screen.getByText('Achtung, Bestand niedrig.')).toBeInTheDocument()
  })

  it('dismiss button removes the toast', async () => {
    const user = userEvent.setup()
    render(ToastTray)
    toast.error('boom')
    await Promise.resolve()
    await user.click(await screen.findByRole('button', { name: /schließen/i }))
    expect(toast.current).toBeNull()
  })
})
