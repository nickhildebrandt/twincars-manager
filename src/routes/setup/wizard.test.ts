import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Component tests for the setup wizard. The flow has eight discrete
 * steps (the legacy Kfz-Kaufmann import is NOT a setup step — it runs
 * later from Settings); this file exercises the structural invariants
 * (step count, ordering, verification rendering, edit-jump) and the
 * admin-step round-trip — `createInitialAdmin` is called on step 7's
 * primary action so the verification step always renders with the
 * account already in place.
 *
 * @group component
 * @module setup-wizard
 */

const saveCompanyDataMock = vi.fn<(input: unknown) => Promise<void>>()
const saveSmtpMock = vi.fn<(input: unknown) => Promise<void>>()
const saveWorkshopHoursMock = vi.fn<(input: unknown) => Promise<void>>()
const createInitialAdminMock = vi.fn<(input: unknown) => Promise<void>>()
const completeSetupMock = vi.fn<() => Promise<void>>()

// The wizard imports these as `RemoteCommand<T>` / `RemoteQuery<T>`
// (callable + extra fields). Our mocks stand in as plain async
// functions so we can spy on the input shape — we cast the whole
// module to `Record<string, unknown>` to suppress the branding-field
// mismatch without scattering `as any` over each entry.
vi.mock('./setup.remote', (): Record<string, unknown> => {
  return {
    saveCompanyData: (input: unknown) => saveCompanyDataMock(input),
    saveSmtp: (input: unknown) => saveSmtpMock(input),
    saveWorkshopHoursForSetup: (input: unknown) => saveWorkshopHoursMock(input),
    createInitialAdmin: (input: unknown) => createInitialAdminMock(input),
    completeSetup: () => completeSetupMock(),
    listWorkshopHoursForSetup: async () => [
      { weekday: 0, opensAt: '00:00', closesAt: '00:00', closed: true },
      { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 5, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 6, opensAt: '00:00', closesAt: '00:00', closed: true }
    ]
  }
})

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(async () => undefined)
}))

import WizardHost from './WizardHost.svelte'

const renderWizard = async () => {
  const result = render(WizardHost)
  // Wait for the boundary's pending state to settle so the page
  // becomes interactive.
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Willkommen!' })
    ).toBeInTheDocument()
  )
  return result
}

const fillByLabel = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string
): Promise<void> => {
  // The wizard's fields are wrapped in `<label><span class="label-text">…`.
  // Find the matching `.label-text` element, then walk up to the
  // enclosing `<label>` and grab the first form control inside it.
  const spans = Array.from(
    document.querySelectorAll('span.label-text')
  ) as HTMLSpanElement[]
  const re = new RegExp(`^${label}`)
  const match = spans.find((s) => re.test((s.textContent ?? '').trim()))
  if (!match) {
    throw new Error(`No .label-text span matched "${label}"`)
  }
  const wrappingLabel = match.closest('label')
  const input = wrappingLabel?.querySelector('input, select, textarea') as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
  if (input.tagName === 'SELECT') {
    await user.selectOptions(input, value)
  } else {
    await user.clear(input)
    await user.type(input, value)
  }
}

const clickPrimary = async (
  user: ReturnType<typeof userEvent.setup>
): Promise<void> => {
  const btn =
    screen.queryByRole('button', { name: /^Weiter/i }) ??
    screen.queryByRole('button', { name: /Konto anlegen/i }) ??
    screen.getByRole('button', { name: /Setup abschließen/i })
  await user.click(btn)
}

const fillStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillByLabel(user, 'Firmenname', 'TwinCars GmbH')
  await fillByLabel(user, 'Straße \\+ Hausnummer', 'Hauptstraße 1')
  await fillByLabel(user, 'PLZ', '10115')
  await fillByLabel(user, 'Ort', 'Berlin')
  await fillByLabel(user, 'Telefon', '030 12345678')
  await fillByLabel(user, 'E-Mail', 'info@twincars.de')
}

const fillStep3 = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillByLabel(user, 'Steuernummer', '12/345/67890')
  await fillByLabel(user, 'Bankname', 'Berliner Bank')
  await fillByLabel(user, 'IBAN', 'DE89370400440532013000')
  await fillByLabel(user, 'BIC', 'COBADEFFXXX')
}

const fillStep4 = async (user: ReturnType<typeof userEvent.setup>) => {
  void user
  const fileInput = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  await fireEvent.change(fileInput, {
    target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] }
  })
  // The page reads the file via FileReader; let the async read settle.
  await waitFor(() =>
    expect(document.querySelector('img[alt="Logo Vorschau"]')).not.toBeNull()
  )
}

const fillStep5 = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillByLabel(user, 'Absenderadresse', 'mail@twincars.de')
  await fillByLabel(user, 'Absendername', 'TwinCars Mailer')
  await fillByLabel(user, 'SMTP-Server', 'smtp.example.com')
  await fillByLabel(user, 'Benutzername', 'mailer')
  await fillByLabel(user, 'Passwort', 'smtpsecret')
}

const advanceToAdmin = async (user: ReturnType<typeof userEvent.setup>) => {
  await clickPrimary(user) // 1 → 2
  await fillStep2(user)
  await clickPrimary(user) // 2 → 3
  await fillStep3(user)
  await clickPrimary(user) // 3 → 4
  await fillStep4(user)
  await clickPrimary(user) // 4 → 5
  await fillStep5(user)
  await clickPrimary(user) // 5 → 6
  await clickPrimary(user) // 6 → 7 (Administrator)
}

const createAdmin = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillByLabel(user, 'Benutzername', 'admin')
  await fillByLabel(user, 'Anzeigename', 'Administrator')
  await fillByLabel(user, 'Passwort \\*', 'longenoughpw')
  await fillByLabel(user, 'Passwort wiederholen', 'longenoughpw')
  await user.click(screen.getByRole('button', { name: /Konto anlegen/i }))
}

beforeEach(() => {
  saveCompanyDataMock.mockClear()
  saveSmtpMock.mockClear()
  saveWorkshopHoursMock.mockClear()
  createInitialAdminMock.mockClear()
  completeSetupMock.mockClear()
})

describe('setup wizard', () => {
  it('renders the welcome step with the eight-item step indicator in the correct order (no import step)', async () => {
    await renderWizard()
    expect(screen.getByText('Schritt 1 von 8')).toBeInTheDocument()
    const stepList = document.querySelector('ul.steps')
    expect(stepList).not.toBeNull()
    const order = Array.from(stepList!.querySelectorAll('li')).map((li) =>
      li.textContent?.trim()
    )
    // Short labels in flow order; "Import" is intentionally absent.
    expect(order).toEqual([
      'Start',
      'Firma',
      'Bank',
      'Logo',
      'SMTP',
      'Zeiten',
      'Admin',
      'Prüfen'
    ])
    expect(order).not.toContain('Import')
  })

  it('shows the concrete validation error inline while the primary button is disabled', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await clickPrimary(user) // 1 → 2 (Firmendaten, pristine)

    // The exact reason is shown — not just a greyed-out button.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Bitte Firmenname eingeben.')
    expect(screen.getByRole('button', { name: /^Weiter/i })).toBeDisabled()

    // It updates live as the user fixes fields (next missing field).
    await fillByLabel(user, 'Firmenname', 'TwinCars GmbH')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bitte Straße eingeben.'
    )
  })

  it('flags a space in the admin username with a concrete error (regression)', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await advanceToAdmin(user)
    await fillByLabel(user, 'Benutzername', 'mein admin')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/keine Leerzeichen/i)
    expect(
      screen.getByRole('button', { name: /Konto anlegen/i })
    ).toBeDisabled()
  })

  it('keeps the Administrator step primary action disabled until all four fields are valid, then calls createInitialAdmin', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await advanceToAdmin(user)

    expect(
      screen.getByRole('heading', { name: 'Administrator-Konto' })
    ).toBeInTheDocument()

    const submit = screen.getByRole('button', {
      name: /Konto anlegen/i
    }) as HTMLButtonElement
    expect(submit).toBeDisabled()

    await fillByLabel(user, 'Benutzername', 'admin')
    await fillByLabel(user, 'Anzeigename', 'Administrator')
    await fillByLabel(user, 'Passwort \\*', 'longenoughpw')
    await fillByLabel(user, 'Passwort wiederholen', 'longenoughpw')
    expect(submit).not.toBeDisabled()
    await user.click(submit)

    expect(createInitialAdminMock).toHaveBeenCalledWith({
      username: 'admin',
      name: 'Administrator',
      password: 'longenoughpw'
    })
  })

  it('shows the verification card with every collected datum and a working edit jump', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await advanceToAdmin(user)
    await createAdmin(user)

    expect(
      screen.getByRole('heading', { name: /Verifikation/i })
    ).toBeInTheDocument()
    expect(screen.getByText('TwinCars GmbH')).toBeInTheDocument()
    expect(screen.getByText('DE89370400440532013000')).toBeInTheDocument()
    expect(screen.getByText(/smtp.example.com/)).toBeInTheDocument()
    expect(screen.getByText('Konto angelegt')).toBeInTheDocument()

    // Edit jump: first "Bearbeiten" button = Firma card.
    const editButtons = screen.getAllByRole('button', { name: /Bearbeiten/i })
    await user.click(editButtons[0])
    expect(
      screen.getByRole('heading', { name: 'Firmendaten' })
    ).toBeInTheDocument()
  })

  it('only calls completeSetup when the user clicks the verification step CTA', async () => {
    const user = userEvent.setup()
    await renderWizard()
    await advanceToAdmin(user)
    await createAdmin(user)

    expect(completeSetupMock).not.toHaveBeenCalled()
    const finish = screen.getByRole('button', { name: /Setup abschließen/i })
    await user.click(finish)
    expect(completeSetupMock).toHaveBeenCalledTimes(1)
  })
})
