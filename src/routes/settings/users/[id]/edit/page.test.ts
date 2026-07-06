import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the user-edit page — rule 1.1 for both the main
 * form (Anzeigename) and the password-reset sub-form: buttons stay
 * clickable, a click with invalid input shows the German message.
 *
 * @group component
 * @module users-edit-page
 */

const updateUserMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<unknown>>()
)

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost/settings/users/u1/edit'),
    params: { id: 'u1' }
  }
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../../users.remote', () => ({
  getUserRemote: async () => ({
    id: 'u1',
    username: 'werkstatt1',
    name: 'Werkstatt Eins',
    roleIds: []
  }),
  listRolesRemote: async () => [],
  listUsersRemote: () => ({}),
  updateUserRemote: (input: unknown) => updateUserMock(input),
  deleteUserRemote: () => ({ updates: async () => undefined })
}))

import EditUserHost from './EditUserHost.svelte'

const renderPage = async () => {
  const result = render(EditUserHost)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /^speichern$/i })
    ).toBeInTheDocument()
  )
  return result
}

describe('users edit page', () => {
  beforeEach(() => {
    updateUserMock.mockReset()
    updateUserMock.mockResolvedValue(undefined)
  })

  it('keeps Speichern enabled with a cleared name (rule 1.1)', async () => {
    const user = userEvent.setup()
    await renderPage()
    const nameInput = screen.getByDisplayValue('Werkstatt Eins')
    await user.clear(nameInput)
    expect(
      screen.getByRole('button', { name: /^speichern$/i })
    ).not.toBeDisabled()
  })

  it('shows the German error on a click with a cleared name', async () => {
    const user = userEvent.setup()
    await renderPage()
    const nameInput = screen.getByDisplayValue('Werkstatt Eins')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /^speichern$/i }))
    expect(updateUserMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Bitte einen Anzeigenamen angeben.')
    ).toBeInTheDocument()
  })

  it('rejects a too-short reset password at click time', async () => {
    const user = userEvent.setup()
    const { container } = await renderPage()
    const [pw] = Array.from(
      container.querySelectorAll('input[type="password"]')
    ) as HTMLInputElement[]
    await user.type(pw, 'kurz')
    await user.click(
      screen.getByRole('button', { name: /passwort zurücksetzen/i })
    )
    expect(updateUserMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Passwort zu kurz (mind. 8 Zeichen).')
    ).toBeInTheDocument()
  })
})
