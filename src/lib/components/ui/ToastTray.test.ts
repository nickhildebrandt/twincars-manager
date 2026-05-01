import { render, screen, cleanup } from '@testing-library/svelte'
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

  it('dismiss button removes the toast', async () => {
    const user = userEvent.setup()
    render(ToastTray)
    toast.error('boom')
    await Promise.resolve()
    await user.click(await screen.findByRole('button', { name: /schließen/i }))
    expect(toast.current).toBeNull()
  })
})
