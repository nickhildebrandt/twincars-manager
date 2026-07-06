import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the account (password change) page — rule 1.1:
 * the submit button is always clickable; a click with empty fields
 * surfaces the German messages without hitting the remote.
 *
 * @group component
 * @module account-page
 */

const changePasswordMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('./account.remote', () => ({
  changeOwnPasswordRemote: (input: unknown) => changePasswordMock(input)
}))

import AccountPage from './+page.svelte'

describe('account page', () => {
  beforeEach(() => {
    changePasswordMock.mockReset()
    changePasswordMock.mockResolvedValue(undefined)
  })

  it('keeps "Passwort ändern" enabled while the form is empty (rule 1.1)', () => {
    render(AccountPage)
    expect(
      screen.getByRole('button', { name: /passwort ändern/i })
    ).not.toBeDisabled()
  })

  it('shows the German error on a click with empty fields', async () => {
    const user = userEvent.setup()
    render(AccountPage)
    await user.click(screen.getByRole('button', { name: /passwort ändern/i }))
    expect(changePasswordMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Bitte aktuelles Passwort eingeben.').length
    ).toBeGreaterThan(0)
  })

  it('rejects mismatching new passwords at click time', async () => {
    const user = userEvent.setup()
    const { container } = render(AccountPage)
    const [current, next, confirm] = Array.from(
      container.querySelectorAll('input[type="password"]')
    ) as HTMLInputElement[]
    await user.type(current, 'altes-passwort')
    await user.type(next, 'neues-passwort-1')
    await user.type(confirm, 'neues-passwort-2')
    await user.click(screen.getByRole('button', { name: /passwort ändern/i }))
    expect(changePasswordMock).not.toHaveBeenCalled()
    expect(
      screen.getAllByText('Die neuen Passwörter stimmen nicht überein.').length
    ).toBeGreaterThan(0)
  })
})
