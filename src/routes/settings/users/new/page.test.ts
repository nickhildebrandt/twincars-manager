import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the user-create page — rule 1.1: Speichern is
 * always clickable; a click with missing input surfaces the German
 * messages step by step instead of a disabled button.
 *
 * @group component
 * @module users-new-page
 */

const createUserMock = vi.hoisted(() =>
  vi.fn<(input: unknown) => { updates: (q: unknown) => Promise<unknown> }>()
)

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

vi.mock('../users.remote', () => ({
  listRolesRemote: async () => [],
  listUsersRemote: () => ({}),
  createUserRemote: (input: unknown) => createUserMock(input)
}))

import NewUserHost from './NewUserHost.svelte'

const renderPage = async () => {
  const result = render(NewUserHost)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).toBeInTheDocument()
  )
  return result
}

describe('users new page', () => {
  beforeEach(() => {
    createUserMock.mockReset()
    createUserMock.mockReturnValue({ updates: async () => undefined })
  })

  it('keeps Speichern enabled while the form is empty (rule 1.1)', async () => {
    await renderPage()
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('walks through the German errors on repeated clicks', async () => {
    const user = userEvent.setup()
    const { container } = await renderPage()
    const submit = screen.getByRole('button', { name: /speichern/i })

    await user.click(submit)
    expect(createUserMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('Benutzername zu kurz (mind. 3 Zeichen).')
    ).toBeInTheDocument()

    const [username, name] = Array.from(
      container.querySelectorAll('input[autocomplete="off"]')
    ) as HTMLInputElement[]
    await user.type(username, 'werkstatt1')
    await user.click(submit)
    expect(
      screen.getByText('Bitte einen Anzeigenamen angeben.')
    ).toBeInTheDocument()

    await user.type(name, 'Werkstatt Eins')
    await user.click(submit)
    expect(
      screen.getByText('Passwort zu kurz (mind. 8 Zeichen).')
    ).toBeInTheDocument()
    expect(createUserMock).not.toHaveBeenCalled()
  })
})
