<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    Building2,
    Banknote,
    Image as ImageIcon,
    Mail,
    Clock,
    UserCog,
    ListChecks,
    Pencil
  } from '@lucide/svelte'
  import {
    saveCompanyData,
    saveSmtp,
    completeSetup,
    createInitialAdmin,
    listWorkshopHoursForSetup,
    saveWorkshopHoursForSetup
  } from './setup.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let step = $state(1)
  const totalSteps = 8

  /**
   * Step list. Order matches the wizard flow exactly; the indicator and
   * the verification card both iterate this. `short` is shown on the
   * compact step pills so long German titles never overlap. The legacy
   * Kfz-Kaufmann import is deliberately NOT a setup step — it runs later
   * from Settings, which has the proper progress UI.
   */
  const steps = [
    { n: 1, title: 'Willkommen', short: 'Start' },
    { n: 2, title: 'Firmendaten', short: 'Firma' },
    { n: 3, title: 'Steuer & Bank', short: 'Bank' },
    { n: 4, title: 'Logo & Anrede', short: 'Logo' },
    { n: 5, title: 'E-Mail (SMTP)', short: 'SMTP' },
    { n: 6, title: 'Öffnungszeiten', short: 'Zeiten' },
    { n: 7, title: 'Administrator', short: 'Admin' },
    { n: 8, title: 'Verifikation', short: 'Prüfen' }
  ]

  let companyName = $state('')
  let owner = $state('')
  let street = $state('')
  let zip = $state('')
  let city = $state('')
  let bundesland = $state('Berlin')
  let phone = $state('')
  let mobile = $state('')
  let email = $state('')
  let website = $state('')

  let vatId = $state('')
  let taxNumber = $state('')
  let bankName = $state('')
  let iban = $state('')
  let bic = $state('')

  let salutation = $state<'Sie' | 'Du'>('Sie')
  let logoData = $state('')
  let logoMime = $state('')

  let smtpHost = $state('')
  let smtpPort = $state('587')
  let smtpSecure = $state<'none' | 'STARTTLS' | 'TLS'>('STARTTLS')
  let smtpUser = $state('')
  let smtpPassword = $state('')
  let fromAddress = $state('')
  let fromName = $state('')
  /**
   * SMTP is an optional integration: the workshop can finish setup
   * without it and configure mail later under Settings. When skipped, the
   * step's fields are disabled and not persisted.
   */
  let smtpSkip = $state(false)

  // Workshop hours. Defaults from the schema seed (Mon-Fri 08:00-17:00,
  // Sat+Sun closed) are loaded once.
  type HoursRow = {
    weekday: number
    opensAt: string
    closesAt: string
    closed: boolean
  }
  const initialHours = await listWorkshopHoursForSetup()
  let hoursRows = $state<HoursRow[]>(
    initialHours.map((r) => ({
      weekday: r.weekday,
      opensAt: r.opensAt,
      closesAt: r.closesAt,
      closed: r.closed
    }))
  )
  const weekdayLabel = (w: number): string => {
    switch (w) {
      case 0:
        return 'Sonntag'
      case 1:
        return 'Montag'
      case 2:
        return 'Dienstag'
      case 3:
        return 'Mittwoch'
      case 4:
        return 'Donnerstag'
      case 5:
        return 'Freitag'
      case 6:
        return 'Samstag'
      default:
        return `Tag ${w}`
    }
  }

  // Administrator-Konto — created on step 7 so the user who configured
  // the workshop also gets the very first login. Marked "created" once
  // `createInitialAdmin` succeeded; the verification step relies on
  // this to show a green badge without re-trying the call.
  let adminUsername = $state('')
  let adminName = $state('')
  let adminPassword = $state('')
  let adminPasswordConfirm = $state('')
  let adminCreated = $state(false)

  const handleLogoUpload = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo darf maximal 5 MB groß sein.')
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      logoData = String(reader.result)
      logoMime = file.type
    }
    reader.readAsDataURL(file)
  }

  const validateStep = (n: number): string | null => {
    if (n === 2) {
      if (!companyName.trim()) return 'Bitte Firmenname eingeben.'
      if (!street.trim()) return 'Bitte Straße eingeben.'
      if (!zip.trim()) return 'Bitte PLZ eingeben.'
      if (!city.trim()) return 'Bitte Ort eingeben.'
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'Bitte gültige E-Mail eingeben.'
      if (!phone.trim()) return 'Bitte Telefonnummer eingeben.'
    }
    if (n === 3) {
      if (!taxNumber.trim()) return 'Bitte Steuernummer eingeben.'
      if (!iban.trim()) return 'Bitte IBAN eingeben.'
      if (!bic.trim()) return 'Bitte BIC eingeben.'
      if (!bankName.trim()) return 'Bitte Bankname eingeben.'
    }
    // Step 4 (logo) is optional — a logo can be added later in Settings,
    // so the step never blocks. Salutation always has a value.
    if (n === 5 && !smtpSkip) {
      if (!smtpHost.trim()) return 'Bitte SMTP-Server eingeben.'
      if (!smtpUser.trim()) return 'Bitte SMTP-Benutzer eingeben.'
      if (!smtpPassword) return 'Bitte SMTP-Passwort eingeben.'
      if (!fromAddress.trim()) return 'Bitte Absender-Adresse eingeben.'
      if (!fromName.trim()) return 'Bitte Absender-Name eingeben.'
    }
    if (n === 6) {
      for (const r of hoursRows) {
        if (r.closed) continue
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.opensAt))
          return `Bitte eine gültige Öffnungszeit für ${weekdayLabel(r.weekday)} eingeben.`
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.closesAt))
          return `Bitte eine gültige Schließzeit für ${weekdayLabel(r.weekday)} eingeben.`
        if (r.closesAt <= r.opensAt)
          return `Schließzeit muss nach Öffnungszeit liegen (${weekdayLabel(r.weekday)}).`
      }
    }
    if (n === 7) {
      const u = adminUsername.trim()
      if (u.length < 3)
        return 'Bitte Benutzernamen (mind. 3 Zeichen) für den Admin angeben.'
      if (!/^[a-zA-Z0-9_.]+$/.test(u))
        return 'Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten (keine Leerzeichen).'
      if (!adminName.trim())
        return 'Bitte den Namen des Administrators angeben.'
      if (adminPassword.length < 8)
        return 'Admin-Passwort muss mindestens 8 Zeichen lang sein.'
      if (adminPassword !== adminPasswordConfirm)
        return 'Die beiden Passwort-Eingaben stimmen nicht überein.'
    }
    return null
  }

  /**
   * Validation UX: a pristine step never shows errors and never greys
   * the primary action — only after the user first presses "Weiter" on
   * that step is its error shown (and it then live-updates while they
   * fix the fields). Per-step tracking so going back to an already
   * attempted step keeps its feedback.
   */
  let attemptedSteps = $state<number[]>([])
  const currentError = $derived(validateStep(step))
  const showError = $derived(
    attemptedSteps.includes(step) && currentError !== null
  )

  /**
   * Persist data that belongs to the step that's being left. Each block
   * has its own dedicated remote so we don't have to re-send unrelated
   * fields. Returns true on success — caller advances the step only then.
   */
  const persistLeavingStep = async (n: number): Promise<boolean> => {
    try {
      if (n === 4) {
        // Company data spans steps 2–4 and is persisted once, when the
        // last company sub-step is left — by then every server-required
        // field (incl. tax number + bank details) has been entered, so
        // the single authoritative `companyDataSchema` validation passes.
        await busy.run(() =>
          saveCompanyData({
            companyName: companyName.trim(),
            owner: owner.trim() || undefined,
            street: street.trim(),
            zip: zip.trim(),
            city: city.trim(),
            state: bundesland.trim(),
            phone: phone.trim(),
            mobile: mobile.trim() || undefined,
            email: email.trim(),
            website: website.trim() || undefined,
            vatId: vatId.trim() || undefined,
            taxNumber: taxNumber.trim(),
            bankName: bankName.trim(),
            iban: iban.trim(),
            bic: bic.trim(),
            salutationStyle: salutation,
            logoMime: logoMime || undefined,
            logoData: logoData || undefined
          })
        )
        return true
      }
      if (n === 5) {
        // Skipped → nothing to persist; mail is set up later in Settings.
        if (smtpSkip) return true
        await busy.run(() =>
          saveSmtp({
            host: smtpHost.trim(),
            port: smtpPort.trim(),
            secure: smtpSecure,
            username: smtpUser.trim(),
            password: smtpPassword,
            fromAddress: fromAddress.trim(),
            fromName: fromName.trim(),
            replyTo: undefined
          })
        )
        return true
      }
      if (n === 6) {
        await busy.run(() => saveWorkshopHoursForSetup({ rows: hoursRows }))
        return true
      }
      if (n === 7 && !adminCreated) {
        await busy.run(() =>
          createInitialAdmin({
            username: adminUsername.trim(),
            name: adminName.trim(),
            password: adminPassword
          })
        )
        adminCreated = true
        return true
      }
      return true
    } catch (e) {
      handleClientError(e, 'Schritt konnte nicht gespeichert werden')
      return false
    }
  }

  const next = async () => {
    // First submit attempt on this step: from now on its validation
    // error is shown inline (and live-updates while the user types).
    if (!attemptedSteps.includes(step)) {
      attemptedSteps = [...attemptedSteps, step]
    }
    if (validateStep(step) !== null) return
    const ok = await persistLeavingStep(step)
    if (!ok) return
    step = Math.min(totalSteps, step + 1)
  }
  const prev = () => {
    step = Math.max(1, step - 1)
  }

  /** Jump back to a specific step from the verification card. */
  const jumpTo = (n: number) => {
    step = Math.max(1, Math.min(totalSteps, n))
  }

  const finishSetup = async () => {
    try {
      await busy.run(() => completeSetup())
      toast.success('Setup abgeschlossen!')
      await invalidateAll()
      goto('/login')
    } catch (e) {
      handleClientError(e, 'Setup konnte nicht abgeschlossen werden')
    }
  }
</script>

<div class="bg-base-200 min-h-dvh">
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6 flex items-center gap-3">
      <img
        src="/icons/icon-128.webp"
        alt=""
        width="48"
        height="48"
        class="rounded-xl"
        loading="eager"
        decoding="async"
      />
      <div>
        <h1 class="text-xl font-bold">TwinCarsManager einrichten</h1>
        <p class="text-base-content/60 text-sm">
          Wir benötigen nur die Kerndaten — alles weitere können Sie später in
          den Einstellungen anpassen.
        </p>
      </div>
    </div>

    <!--
      Responsive step indicator. The current step + title line shows on
      every size; below it a thin progress bar (< md) or a horizontally
      scrollable pill row with SHORT labels (md+). Short labels +
      overflow-x-auto guarantee the steps never overlap, regardless of
      viewport width or step-title length.
    -->
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between gap-2 text-sm">
        <span class="text-base-content/70 whitespace-nowrap">
          Schritt {step} von {totalSteps}
        </span>
        <span class="truncate font-medium">{steps[step - 1].title}</span>
      </div>
      <progress
        class="progress progress-primary w-full md:hidden"
        value={step}
        max={totalSteps}
      ></progress>
      <div class="hidden overflow-x-auto pb-1 md:block">
        <ul class="steps w-full">
          {#each steps as s (s.n)}
            <li
              class="step px-2 whitespace-nowrap"
              class:step-primary={step >= s.n}
            >
              {s.short}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        {#if step === 1}
          <h2 class="card-title">Willkommen!</h2>
          <p>
            Schön, dass Sie da sind. Wir werden gleich Ihre Firma einrichten.
            Sie benötigen folgende Informationen:
          </p>
          <ul class="text-base-content/80 list-disc space-y-1 pl-6 text-sm">
            <li>Firmenname, Anschrift und Kontakt</li>
            <li>Steuer- und Bankdaten (für Rechnungen)</li>
            <li>Ihr Logo als Bilddatei (optional)</li>
            <li>SMTP-Zugangsdaten für den E-Mail-Versand (optional)</li>
            <li>Werkstatt-Öffnungszeiten</li>
            <li>Benutzername + Passwort für den ersten Login</li>
          </ul>
          <p class="text-base-content/60 text-sm">
            Alle weiteren Optionen — Mailvorlagen, PDF-Layout, Nummernkreise,
            Kfz-Freifelder usw. — sind mit deutschen Standardwerten vorbelegt
            und können später unter „Einstellungen" geändert werden.
          </p>
        {:else if step === 2}
          <div class="flex items-center gap-2">
            <Building2 size={22} class="text-primary" />
            <h2 class="card-title">Firmendaten</h2>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Firmenname *</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={companyName}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Inhaber</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={owner}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Straße + Hausnummer *</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={street}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">PLZ *</span>
              <input
                class="input input-bordered w-full"
                maxlength="10"
                bind:value={zip}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Ort *</span>
              <input
                class="input input-bordered w-full"
                maxlength="150"
                bind:value={city}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Bundesland *</span>
              <select
                class="select select-bordered w-full"
                bind:value={bundesland}
              >
                <option>Baden-Württemberg</option>
                <option>Bayern</option>
                <option>Berlin</option>
                <option>Brandenburg</option>
                <option>Bremen</option>
                <option>Hamburg</option>
                <option>Hessen</option>
                <option>Mecklenburg-Vorpommern</option>
                <option>Niedersachsen</option>
                <option>Nordrhein-Westfalen</option>
                <option>Rheinland-Pfalz</option>
                <option>Saarland</option>
                <option>Sachsen</option>
                <option>Sachsen-Anhalt</option>
                <option>Schleswig-Holstein</option>
                <option>Thüringen</option>
              </select>
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Telefon *</span>
              <input
                class="input input-bordered w-full"
                maxlength="30"
                bind:value={phone}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Mobil</span>
              <input
                class="input input-bordered w-full"
                maxlength="30"
                bind:value={mobile}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">E-Mail *</span>
              <input
                class="input input-bordered w-full"
                type="email"
                maxlength="254"
                bind:value={email}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Website</span>
              <input
                class="input input-bordered w-full"
                maxlength="2048"
                bind:value={website}
              />
            </label>
          </div>
        {:else if step === 3}
          <div class="flex items-center gap-2">
            <Banknote size={22} class="text-primary" />
            <h2 class="card-title">Steuer und Bank</h2>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">USt-IdNr.</span>
              <input
                class="input input-bordered w-full"
                maxlength="30"
                bind:value={vatId}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Steuernummer *</span>
              <input
                class="input input-bordered w-full"
                maxlength="30"
                bind:value={taxNumber}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Bankname *</span>
              <input
                class="input input-bordered w-full"
                maxlength="100"
                bind:value={bankName}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">IBAN *</span>
              <input
                class="input input-bordered w-full"
                maxlength="34"
                bind:value={iban}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">BIC *</span>
              <input
                class="input input-bordered w-full"
                maxlength="11"
                bind:value={bic}
              />
            </label>
          </div>
        {:else if step === 4}
          <div class="flex items-center gap-2">
            <ImageIcon size={22} class="text-primary" />
            <h2 class="card-title">Logo und Anrede</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Das Logo erscheint auf jedem PDF (Rechnung, Angebot,
            Verkaufsschild). Optional — Sie können es auch später unter
            Einstellungen hinterlegen.
          </p>
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Logo (PNG/JPG/SVG, max. 5 MB)</span>
                <input
                  class="file-input file-input-bordered w-full"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onchange={handleLogoUpload}
                />
              </label>
              <fieldset class="fieldset mt-4">
                <legend class="fieldset-legend">Anrede-Stil</legend>
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    type="radio"
                    class="radio radio-primary"
                    value="Sie"
                    bind:group={salutation}
                  />
                  <span>Sie (Standard, professionell)</span>
                </label>
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    type="radio"
                    class="radio radio-primary"
                    value="Du"
                    bind:group={salutation}
                  />
                  <span>Du (persönlich)</span>
                </label>
              </fieldset>
            </div>
            <div class="w-48 shrink-0">
              {#if logoData}
                <div class="border-base-300 rounded border bg-white p-3">
                  <img
                    src={logoData}
                    alt="Logo Vorschau"
                    class="h-32 w-full object-contain"
                  />
                </div>
              {:else}
                <div
                  class="border-base-300 bg-base-200 text-base-content/40 flex h-40 items-center justify-center rounded border text-sm"
                >
                  Vorschau
                </div>
              {/if}
            </div>
          </div>
        {:else if step === 5}
          <div class="flex items-center gap-2">
            <Mail size={22} class="text-primary" />
            <h2 class="card-title">E-Mail-Versand (SMTP)</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Damit Sie Rechnungen, Angebote und Mahnungen direkt versenden
            können. Optional — Sie können den E-Mail-Versand auch später unter
            Einstellungen → E-Mail/SMTP einrichten.
          </p>
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              bind:checked={smtpSkip}
            />
            <span>Später einrichten (überspringen)</span>
          </label>
          <div
            class="grid grid-cols-1 gap-3 sm:grid-cols-2"
            class:opacity-50={smtpSkip}
          >
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Absenderadresse *</span>
              <input
                class="input input-bordered w-full"
                type="email"
                maxlength="254"
                disabled={smtpSkip}
                bind:value={fromAddress}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Absendername *</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                disabled={smtpSkip}
                bind:value={fromName}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">SMTP-Server (Host) *</span>
              <input
                class="input input-bordered w-full"
                maxlength="255"
                disabled={smtpSkip}
                bind:value={smtpHost}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Port *</span>
              <input
                class="input input-bordered w-full"
                type="number"
                min="1"
                max="65535"
                disabled={smtpSkip}
                bind:value={smtpPort}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Verschlüsselung *</span>
              <select
                class="select select-bordered w-full"
                disabled={smtpSkip}
                bind:value={smtpSecure}
              >
                <option value="STARTTLS">STARTTLS</option>
                <option value="TLS">TLS</option>
                <option value="none">Keine</option>
              </select>
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Benutzername *</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                disabled={smtpSkip}
                bind:value={smtpUser}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Passwort *</span>
              <input
                class="input input-bordered w-full"
                type="password"
                maxlength="200"
                disabled={smtpSkip}
                bind:value={smtpPassword}
              />
            </label>
          </div>
        {:else if step === 6}
          <div class="flex items-center gap-2">
            <Clock size={22} class="text-primary" />
            <h2 class="card-title">Werkstatt-Öffnungszeiten</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Diese Zeiten bestimmen, wann Termine über die öffentliche Website
            gebucht werden können. Sie lassen sich später unter Einstellungen →
            Öffnungszeiten anpassen.
          </p>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Wochentag</th>
                  <th>Öffnet</th>
                  <th>Schließt</th>
                  <th>Geschlossen</th>
                </tr>
              </thead>
              <tbody>
                {#each hoursRows as r (r.weekday)}
                  <tr>
                    <td class="font-medium">{weekdayLabel(r.weekday)}</td>
                    <td>
                      <input
                        type="time"
                        class="input input-bordered input-sm w-full max-w-[10rem]"
                        bind:value={r.opensAt}
                        disabled={r.closed}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        class="input input-bordered input-sm w-full max-w-[10rem]"
                        bind:value={r.closesAt}
                        disabled={r.closed}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        class="toggle toggle-primary"
                        bind:checked={r.closed}
                      />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if step === 7}
          <div class="flex items-center gap-2">
            <UserCog size={22} class="text-primary" />
            <h2 class="card-title">Administrator-Konto</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Mit diesem Konto melden Sie sich nach Abschluss erstmals an. Bitte
            Benutzername und Passwort sicher merken — beide lassen sich später
            unter „Einstellungen → Benutzer" ändern.
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Benutzername *</span>
              <input
                type="text"
                class="input input-bordered w-full"
                bind:value={adminUsername}
                autocomplete="off"
                required
                minlength="3"
                maxlength="64"
                disabled={adminCreated}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Anzeigename *</span>
              <input
                type="text"
                class="input input-bordered w-full"
                bind:value={adminName}
                autocomplete="off"
                required
                maxlength="200"
                disabled={adminCreated}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Passwort *</span>
              <input
                type="password"
                class="input input-bordered w-full"
                bind:value={adminPassword}
                autocomplete="new-password"
                required
                minlength="8"
                disabled={adminCreated}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Passwort wiederholen *</span>
              <input
                type="password"
                class="input input-bordered w-full"
                bind:value={adminPasswordConfirm}
                autocomplete="new-password"
                required
                minlength="8"
                disabled={adminCreated}
              />
            </label>
          </div>
          {#if adminCreated}
            <div class="alert alert-success mt-3 text-sm" role="status">
              <Check size={16} />
              <span>
                Administrator-Konto „{adminUsername.trim().toLowerCase()}" wurde
                angelegt. Es lässt sich in diesem Wizard nicht mehr ändern.
              </span>
            </div>
          {:else}
            <p class="text-base-content/50 mt-1 text-xs">
              Erlaubte Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich. Der
              Benutzername wird beim Anmelden klein geschrieben behandelt.
            </p>
          {/if}
        {:else if step === 8}
          <div class="flex items-center gap-2">
            <ListChecks size={22} class="text-primary" />
            <h2 class="card-title">Verifikation &amp; Abschluss</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Bitte prüfen Sie Ihre Eingaben. Über „Bearbeiten" gelangen Sie
            zurück zum entsprechenden Schritt — beim erneuten „Weiter" landen
            Sie wieder hier.
          </p>

          <div class="mt-2 grid grid-cols-1 gap-4">
            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Building2 size={18} class="text-primary" />
                    <h3 class="font-semibold">Firma</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(2)}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                <dl
                  class="text-base-content/80 mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]"
                >
                  <dt class="text-base-content/50">Name</dt>
                  <dd>{companyName || '—'}</dd>
                  <dt class="text-base-content/50">Anschrift</dt>
                  <dd>{street}, {zip} {city} ({bundesland})</dd>
                  <dt class="text-base-content/50">Telefon</dt>
                  <dd>{phone || '—'}</dd>
                  {#if mobile}
                    <dt class="text-base-content/50">Mobil</dt>
                    <dd>{mobile}</dd>
                  {/if}
                  <dt class="text-base-content/50">E-Mail</dt>
                  <dd>{email || '—'}</dd>
                  {#if website}
                    <dt class="text-base-content/50">Website</dt>
                    <dd>{website}</dd>
                  {/if}
                </dl>
              </div>
            </div>

            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Banknote size={18} class="text-primary" />
                    <h3 class="font-semibold">Steuer &amp; Bank</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(3)}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                <dl
                  class="text-base-content/80 mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]"
                >
                  <dt class="text-base-content/50">USt-IdNr.</dt>
                  <dd>{vatId || '—'}</dd>
                  <dt class="text-base-content/50">Steuernummer</dt>
                  <dd>{taxNumber || '—'}</dd>
                  <dt class="text-base-content/50">Bankname</dt>
                  <dd>{bankName || '—'}</dd>
                  <dt class="text-base-content/50">IBAN</dt>
                  <dd>{iban || '—'}</dd>
                  <dt class="text-base-content/50">BIC</dt>
                  <dd>{bic || '—'}</dd>
                </dl>
              </div>
            </div>

            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <ImageIcon size={18} class="text-primary" />
                    <h3 class="font-semibold">Logo &amp; Anrede</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(4)}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                <div
                  class="text-base-content/80 mt-1 flex items-center gap-4 text-sm"
                >
                  <div class="w-32 shrink-0">
                    {#if logoData}
                      <div class="border-base-300 rounded border bg-white p-2">
                        <img
                          src={logoData}
                          alt="Logo Vorschau"
                          class="h-20 w-full object-contain"
                        />
                      </div>
                    {:else}
                      <div
                        class="border-base-300 bg-base-200 text-base-content/40 flex h-24 items-center justify-center rounded border text-xs"
                      >
                        kein Logo
                      </div>
                    {/if}
                  </div>
                  <div>
                    <p>
                      <span class="text-base-content/50">Anrede-Stil:</span>
                      {salutation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Mail size={18} class="text-primary" />
                    <h3 class="font-semibold">E-Mail (SMTP)</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(5)}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                {#if smtpSkip}
                  <p class="text-base-content/60 mt-1 text-sm">
                    Übersprungen — kann später unter Einstellungen → E-Mail/SMTP
                    eingerichtet werden.
                  </p>
                {:else}
                  <dl
                    class="text-base-content/80 mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]"
                  >
                    <dt class="text-base-content/50">Host : Port</dt>
                    <dd>{smtpHost || '—'} : {smtpPort}</dd>
                    <dt class="text-base-content/50">Verschlüsselung</dt>
                    <dd>{smtpSecure}</dd>
                    <dt class="text-base-content/50">Benutzer</dt>
                    <dd>{smtpUser || '—'}</dd>
                    <dt class="text-base-content/50">Passwort</dt>
                    <dd>{smtpPassword ? '••••••••' : '—'}</dd>
                    <dt class="text-base-content/50">Absender</dt>
                    <dd>
                      {fromName || '—'}
                      {#if fromAddress}
                        &lt;{fromAddress}&gt;
                      {/if}
                    </dd>
                  </dl>
                {/if}
              </div>
            </div>

            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Clock size={18} class="text-primary" />
                    <h3 class="font-semibold">Öffnungszeiten</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(6)}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                <div class="overflow-x-auto">
                  <table class="table-sm mt-1 table">
                    <thead>
                      <tr>
                        <th>Wochentag</th>
                        <th>Zeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each [1, 2, 3, 4, 5, 6, 0] as wd (wd)}
                        {@const r = hoursRows.find((x) => x.weekday === wd)}
                        {#if r}
                          <tr>
                            <td class="font-medium">{weekdayLabel(wd)}</td>
                            <td>
                              {#if r.closed}
                                <span class="text-base-content/50"
                                  >geschlossen</span
                                >
                              {:else}
                                {r.opensAt} – {r.closesAt}
                              {/if}
                            </td>
                          </tr>
                        {/if}
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="card border-base-300 bg-base-100 border">
              <div class="card-body">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UserCog size={18} class="text-primary" />
                    <h3 class="font-semibold">Administrator</h3>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => jumpTo(7)}
                    disabled={adminCreated}
                  >
                    <Pencil size={14} /> Bearbeiten
                  </button>
                </div>
                <dl
                  class="text-base-content/80 mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]"
                >
                  <dt class="text-base-content/50">Benutzername</dt>
                  <dd>{adminUsername.trim().toLowerCase() || '—'}</dd>
                  <dt class="text-base-content/50">Anzeigename</dt>
                  <dd>{adminName || '—'}</dd>
                  <dt class="text-base-content/50">Status</dt>
                  <dd>
                    {#if adminCreated}
                      <span class="badge badge-success badge-sm">
                        <Check size={12} /> Konto angelegt
                      </span>
                    {:else}
                      <span class="badge badge-warning badge-sm"
                        >noch nicht angelegt</span
                      >
                    {/if}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        {/if}

        <!--
          Inline validation feedback: shown only after the user first
          pressed "Weiter" on this step — a pristine form never nags.
          From the first attempt on, the exact reason live-updates while
          the user fixes the fields (e.g. a space in the admin
          username). The primary button stays clickable so pressing it
          is what surfaces the feedback.
        -->
        {#if showError && !busy.active}
          <div class="alert alert-error mt-4 py-2 text-sm" role="alert">
            <span>{currentError}</span>
          </div>
        {/if}

        <div class="card-actions mt-4 justify-between">
          <button
            class="btn btn-ghost"
            onclick={prev}
            disabled={step === 1 || busy.active}
          >
            <ArrowLeft size={16} /> Zurück
          </button>
          {#if step < totalSteps}
            <button
              class="btn btn-primary"
              onclick={next}
              disabled={busy.active}
            >
              {#if busy.active}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              {#if step === 7 && !adminCreated}
                Konto anlegen
              {:else}
                Weiter
              {/if}
              <ArrowRight size={16} />
            </button>
          {:else}
            <button
              class="btn btn-primary"
              onclick={finishSetup}
              disabled={busy.active || !adminCreated}
            >
              {#if busy.active}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              <Check size={16} /> Setup abschließen
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
