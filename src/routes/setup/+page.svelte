<script lang="ts">
  import { goto } from '$app/navigation'
  import { invalidateAll } from '$app/navigation'
  import {
    Wrench,
    ArrowLeft,
    ArrowRight,
    Check,
    Building2,
    Banknote,
    Image as ImageIcon,
    Mail,
    Database
  } from '@lucide/svelte'
  import { saveCompanyData, saveSmtp, completeSetup } from './setup.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let step = $state(1)
  const totalSteps = 7

  const steps = [
    { n: 1, title: 'Willkommen' },
    { n: 2, title: 'Firmendaten' },
    { n: 3, title: 'Steuer & Bank' },
    { n: 4, title: 'Logo & Anrede' },
    { n: 5, title: 'E-Mail (SMTP)' },
    { n: 6, title: 'Lohn & Mahnwesen' },
    { n: 7, title: 'Abschluss' }
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

  // Schritt 6 — Lohn & Mahnwesen
  let payrollGenerationDay = $state(25)
  let reminderDays1 = $state(3)
  let reminderDays2 = $state(10)
  let reminderDays3 = $state(20)
  let reminderDays4 = $state(30)
  let reminderInterestRate = $state(9.62)

  let mdbChoice = $state<'now' | 'later' | 'fresh'>('later')

  let busy = $state(false)

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
    if (n === 4) {
      if (!logoData) return 'Bitte ein Logo hochladen.'
    }
    if (n === 5) {
      if (!smtpHost.trim()) return 'Bitte SMTP-Server eingeben.'
      if (!smtpUser.trim()) return 'Bitte SMTP-Benutzer eingeben.'
      if (!smtpPassword) return 'Bitte SMTP-Passwort eingeben.'
      if (!fromAddress.trim()) return 'Bitte Absender-Adresse eingeben.'
      if (!fromName.trim()) return 'Bitte Absender-Name eingeben.'
    }
    if (n === 6) {
      if (
        !Number.isInteger(payrollGenerationDay) ||
        payrollGenerationDay < 1 ||
        payrollGenerationDay > 28
      )
        return 'Stichtag der Lohnabrechnung muss zwischen 1 und 28 liegen.'
      if (
        reminderDays1 < 0 ||
        reminderDays2 < 0 ||
        reminderDays3 < 0 ||
        reminderDays4 < 0
      )
        return 'Mahnstufen-Tage dürfen nicht negativ sein.'
      if (
        !(
          reminderDays1 < reminderDays2 &&
          reminderDays2 < reminderDays3 &&
          reminderDays3 < reminderDays4
        )
      )
        return 'Mahnstufen müssen aufsteigend sein (1 < 2 < 3 < 4).'
    }
    return null
  }

  const next = () => {
    const err = validateStep(step)
    if (err) {
      toast.error(err)
      return
    }
    step = Math.min(totalSteps, step + 1)
  }
  const prev = () => {
    step = Math.max(1, step - 1)
  }

  const persistAndFinish = async () => {
    busy = true
    try {
      await saveCompanyData({
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
        taxNumber: taxNumber.trim() || undefined,
        bankName: bankName.trim() || undefined,
        iban: iban.trim() || undefined,
        bic: bic.trim() || undefined,
        salutationStyle: salutation,
        logoMime: logoMime || undefined,
        logoData: logoData || undefined,
        payrollGenerationDay,
        reminderDays1,
        reminderDays2,
        reminderDays3,
        reminderDays4,
        reminderInterestRate
      })

      await saveSmtp({
        host: smtpHost.trim(),
        port: smtpPort.trim(),
        secure: smtpSecure,
        username: smtpUser.trim(),
        password: smtpPassword,
        fromAddress: fromAddress.trim(),
        fromName: fromName.trim(),
        replyTo: undefined
      })

      await completeSetup()
      toast.success('Setup abgeschlossen!')
      await invalidateAll()
      if (mdbChoice === 'now') {
        goto('/import')
      } else {
        goto('/')
      }
    } catch (err) {
      handleClientError(err, 'Setup konnte nicht gespeichert werden')
    } finally {
      busy = false
    }
  }
</script>

<div class="bg-base-200 min-h-dvh">
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6 flex items-center gap-3">
      <div class="bg-primary/10 text-primary rounded-lg p-2">
        <Wrench size={24} />
      </div>
      <div>
        <h1 class="text-xl font-bold">TwinCarsManager einrichten</h1>
        <p class="text-base-content/60 text-sm">
          Wir benötigen nur die Kerndaten — alles weitere können Sie später in
          den Einstellungen anpassen.
        </p>
      </div>
    </div>

    <ul class="steps mb-6 w-full">
      {#each steps as s (s.n)}
        <li class="step" class:step-primary={step >= s.n}>{s.title}</li>
      {/each}
    </ul>

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
            <li>Ihr Logo als Bilddatei</li>
            <li>SMTP-Zugangsdaten für den E-Mail-Versand</li>
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
            Das Logo erscheint auf jedem PDF (Rechnung, Angebot, Verkaufsschild,
            Lohnzettel).
          </p>
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Logo (PNG/JPG/SVG, max. 5 MB) *</span>
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
            können.
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Absenderadresse *</span>
              <input
                class="input input-bordered w-full"
                type="email"
                maxlength="254"
                bind:value={fromAddress}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">Absendername *</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={fromName}
              />
            </label>
            <label class="flex w-full flex-col gap-1 sm:col-span-2">
              <span class="label-text">SMTP-Server (Host) *</span>
              <input
                class="input input-bordered w-full"
                maxlength="255"
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
                bind:value={smtpPort}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Verschlüsselung *</span>
              <select
                class="select select-bordered w-full"
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
                bind:value={smtpUser}
              />
            </label>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Passwort *</span>
              <input
                class="input input-bordered w-full"
                type="password"
                maxlength="200"
                bind:value={smtpPassword}
              />
            </label>
          </div>
          <p class="text-base-content/50 mt-2 text-xs">
            Hinweis: Eine Test-Mail können Sie nach dem Setup unter
            Einstellungen → E-Mail/SMTP auslösen.
          </p>
        {:else if step === 6}
          <h2 class="card-title">Lohn & Mahnwesen</h2>
          <p class="text-base-content/70 text-sm">
            Diese Defaults greifen für alle künftigen Lohnabrechnungen und
            Mahnungen. Sie lassen sich später in den Einstellungen anpassen.
          </p>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Lohnabrechnung</legend>
            <label class="flex w-full max-w-xs flex-col gap-1">
              <span class="label-text"> Stichtag (Tag im Monat, 1–28) * </span>
              <input
                class="input input-bordered w-full"
                type="number"
                min="1"
                max="28"
                bind:value={payrollGenerationDay}
              />
              <span class="text-base-content/50 text-xs">
                Ab diesem Tag werden Lohnabrechnungen für den laufenden Monat
                automatisch angelegt.
              </span>
            </label>
          </fieldset>
          <fieldset class="fieldset mt-2">
            <legend class="fieldset-legend"
              >Mahnstufen — Tage nach Fälligkeit</legend
            >
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label class="flex flex-col gap-1">
                <span class="label-text">Zahlungserinnerung *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  bind:value={reminderDays1}
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">1. Mahnung *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  bind:value={reminderDays2}
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">2. Mahnung *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  bind:value={reminderDays3}
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text">Letzte Mahnung *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  bind:value={reminderDays4}
                />
              </label>
            </div>
            <label class="mt-3 flex max-w-xs flex-col gap-1">
              <span class="label-text">Verzugszinsen p.a. (%)</span>
              <input
                class="input input-bordered w-full"
                type="number"
                step="0.01"
                min="0"
                bind:value={reminderInterestRate}
              />
            </label>
          </fieldset>
        {:else if step === 7}
          <div class="flex items-center gap-2">
            <Check size={22} class="text-primary" />
            <h2 class="card-title">Abschluss</h2>
          </div>
          <p class="text-base-content/70 text-sm">
            Möchten Sie alte Daten aus Kfz-Kaufmann (.mdb) jetzt importieren?
          </p>
          <fieldset class="fieldset">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                type="radio"
                class="radio radio-primary"
                value="now"
                bind:group={mdbChoice}
              />
              <span
                ><strong>Jetzt importieren</strong> — direkt zur Importseite weiter</span
              >
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input
                type="radio"
                class="radio radio-primary"
                value="later"
                bind:group={mdbChoice}
              />
              <span
                ><strong>Später</strong> — kann jederzeit unter Import durchgeführt
                werden</span
              >
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input
                type="radio"
                class="radio radio-primary"
                value="fresh"
                bind:group={mdbChoice}
              />
              <span
                ><strong>Frischstart</strong> — keine alten Daten übernehmen</span
              >
            </label>
          </fieldset>
          <div class="bg-base-200 rounded-lg p-3 text-sm">
            <p class="font-semibold">Übersicht</p>
            <ul
              class="text-base-content/80 mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2"
            >
              <li
                ><span class="text-base-content/50">Firma:</span>
                {companyName}</li
              >
              <li
                ><span class="text-base-content/50">Anschrift:</span>
                {street}, {zip}
                {city}</li
              >
              <li><span class="text-base-content/50">E-Mail:</span> {email}</li>
              <li
                ><span class="text-base-content/50">SMTP:</span>
                {smtpHost}:{smtpPort}</li
              >
              <li><span class="text-base-content/50">IBAN:</span> {iban}</li>
              <li
                ><span class="text-base-content/50">Anrede:</span>
                {salutation}</li
              >
            </ul>
          </div>
        {/if}

        <div class="card-actions mt-6 justify-between">
          <button
            class="btn btn-ghost"
            onclick={prev}
            disabled={step === 1 || busy}
          >
            <ArrowLeft size={16} /> Zurück
          </button>
          {#if step < totalSteps}
            <button class="btn btn-primary" onclick={next} disabled={busy}>
              Weiter <ArrowRight size={16} />
            </button>
          {:else}
            <button
              class="btn btn-primary"
              onclick={persistAndFinish}
              disabled={busy}
            >
              {#if busy}<span class="loading loading-spinner loading-sm"
                ></span>{/if}
              {#if mdbChoice === 'now'}
                <Database size={16} /> Abschluss & Import
              {:else}
                <Check size={16} /> Setup abschließen
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
