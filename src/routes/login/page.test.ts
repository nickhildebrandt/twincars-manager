import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the login page — rule 1.1: the Anmelden button
 * is always clickable (only `busy.active` disables it); clicking with
 * missing or too-short credentials surfaces the German messages
 * instead of silently doing nothing.
 *
 * @group component
 * @module login-page
 */

const signInMock = vi.hoisted(() =>
  vi.fn<() => Promise<{ error: { message?: string } | null }>>()
)

vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/login'), params: {} }
}))

vi.mock('$lib/client/auth-client', () => ({
  authClient: { signIn: { username: signInMock } }
}))

import LoginPage from './+page.svelte'

describe('login page', () => {
  beforeEach(() => {
    signInMock.mockReset()
    signInMock.mockResolvedValue({ error: null })
  })

  it('keeps Anmelden enabled while both fields are empty (rule 1.1)', () => {
    render(LoginPage)
    expect(screen.getByRole('button', { name: /anmelden/i })).not.toBeDisabled()
  })

  it('shows the German username error on a click with empty fields', async () => {
    const user = userEvent.setup()
    render(LoginPage)
    await user.click(screen.getByRole('button', { name: /anmelden/i }))
    expect(signInMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Benutzername zu kurz (mind. 3 Zeichen).').length
    ).toBeGreaterThan(0)
  })

  it('shows the password error once the username is valid', async () => {
    const user = userEvent.setup()
    const { container } = render(LoginPage)
    const username = container.querySelector(
      'input[autocomplete="username"]'
    ) as HTMLInputElement
    await user.type(username, 'e2eadmin')
    await user.click(screen.getByRole('button', { name: /anmelden/i }))
    expect(signInMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Passwort zu kurz (mind. 8 Zeichen).').length
    ).toBeGreaterThan(0)
  })
})
