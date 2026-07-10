import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SmtpTestSend from './SmtpTestSend.svelte'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Component tests for the SMTP Testversand fieldset:
 *
 * - button always clickable (only `busy.active` disables — rule 1.1);
 * - click-time German validation for the recipient address;
 * - prefill from the company e-mail;
 * - curated server failure rendered inline (`role="alert"`);
 * - success toast; unsaved-changes hint driven by the `dirty` prop.
 *
 * @group component
 * @module SmtpTestSend
 */

type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string }

const okSend = (): Promise<SendResult> =>
  Promise.resolve({ ok: true, messageId: '<x>' })

describe('SmtpTestSend', () => {
  beforeEach(() => {
    toast.dismiss()
  })

  it('renders the fieldset with recipient input and an enabled button', () => {
    render(SmtpTestSend, { props: { send: vi.fn(okSend) } })
    expect(screen.getByText('Testversand')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /testnachricht senden/i })
    expect(btn).not.toBeDisabled()
  })

  it('prefills the recipient with the company e-mail', () => {
    const { container } = render(SmtpTestSend, {
      props: { send: vi.fn(okSend), defaultRecipient: 'firma@example.com' }
    })
    const input = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    expect(input.value).toBe('firma@example.com')
  })

  it('shows the German validation error on click with an invalid address and does not send', async () => {
    const user = userEvent.setup()
    const send = vi.fn(okSend)
    const { container } = render(SmtpTestSend, { props: { send } })
    const input = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement
    await user.type(input, 'keine-mail')
    await user.click(
      screen.getByRole('button', { name: /testnachricht senden/i })
    )
    expect(send).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte eine gültige Empfängeradresse eingeben.')
    ).toBeInTheDocument()
    expect(input).toHaveClass('input-error')
  })

  it('sends to the trimmed recipient and toasts on success', async () => {
    const user = userEvent.setup()
    const send = vi.fn(okSend)
    render(SmtpTestSend, {
      props: { send, defaultRecipient: 'firma@example.com' }
    })
    await user.click(
      screen.getByRole('button', { name: /testnachricht senden/i })
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('firma@example.com')
    expect(toast.current?.variant).toBe('success')
    expect(toast.current?.message).toBe(
      'Testnachricht an firma@example.com versendet.'
    )
    // No inline alert on success.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a curated server failure inline as role=alert', async () => {
    const user = userEvent.setup()
    const send = vi.fn(
      (): Promise<SendResult> =>
        Promise.resolve({
          ok: false,
          error:
            'Anmeldung fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.'
        })
    )
    render(SmtpTestSend, {
      props: { send, defaultRecipient: 'firma@example.com' }
    })
    await user.click(
      screen.getByRole('button', { name: /testnachricht senden/i })
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Anmeldung fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.'
    )
    // A follow-up successful send clears the inline error again.
    send.mockImplementationOnce(okSend)
    await user.click(
      screen.getByRole('button', { name: /testnachricht senden/i })
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the save-first hint only while the SMTP form is dirty', async () => {
    const hint = 'Speichern Sie geänderte SMTP-Einstellungen vor dem Test.'
    const { rerender } = render(SmtpTestSend, {
      props: { send: vi.fn(okSend), dirty: false }
    })
    expect(screen.queryByText(hint)).not.toBeInTheDocument()
    await rerender({ dirty: true })
    expect(screen.getByText(hint)).toBeInTheDocument()
  })
})
