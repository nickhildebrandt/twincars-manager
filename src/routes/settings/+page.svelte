<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import { Building2, Server, FileText, AlertTriangle } from '@lucide/svelte'
  import {
    getAllSettingsRemote,
    listMailTemplatesRemote,
    removeLogoRemote,
    resetMailTemplateRemote,
    updateCompanyRemote,
    updateLogoRemote,
    updateMailTemplateRemote,
    updateReminderSettingsRemote,
    updateSmtpRemote
  } from './settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { page as pageStore } from '$app/state'
  import { replaceState } from '$app/navigation'

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  type Tab = 'company' | 'mail' | 'smtp' | 'reminders'
  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'company', label: 'Firmendaten', icon: Building2 },
    { id: 'mail', label: 'Mailvorlagen', icon: FileText },
    { id: 'reminders', label: 'Mahnwesen', icon: AlertTriangle },
    { id: 'smtp', label: 'SMTP', icon: Server }
  ]

  /**
   * Aktiver Tab wird in der URL als `?tab=` gespiegelt: ein Reload
   * öffnet den gleichen Tab, ein Tab-Wechsel aktualisiert die URL
   * (replaceState — kein neuer History-Eintrag, damit Browser-Back
   * nicht zwischen Tabs hängen bleibt).
   */
  const initialTabFromUrl = (() => {
    const t = pageStore.url.searchParams.get('tab')
    return tabs.some((x) => x.id === t) ? (t as Tab) : 'company'
  })()
  let activeTab = $state<Tab>(initialTabFromUrl)

  $effect(() => {
    const url = new URL(pageStore.url)
    if (activeTab === 'company') url.searchParams.delete('tab')
    else url.searchParams.set('tab', activeTab)
    if (url.search !== pageStore.url.search) replaceState(url, pageStore.state)
  })

  const sQ = $derived(getAllSettingsRemote())
  const data = $derived(sQ.current)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
  })

  // Company / Bank fields
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
  let salutation = $state<'Sie' | 'Du'>('Sie')
  let vatId = $state('')
  let taxNumber = $state('')
  let bankName = $state('')
  let iban = $state('')
  let bic = $state('')
  let pdfFooter = $state('')
  let payrollGenerationDay = $state(25)

  // SMTP fields
  let smtpHost = $state('')
  let smtpPort = $state(587)
  let smtpSecure = $state<'none' | 'STARTTLS' | 'TLS'>('STARTTLS')
  /** True wenn der Server bereits ein Passwort gespeichert hat —
   *  dann zeigt das Feld als Visual-Cue Punkte an. Beim Tippen
   *  überschreibt der User; bleibt das Feld leer (oder Platzhalter
   *  unangetastet) wird das gespeicherte Passwort behalten. */
  let smtpPasswordSet = $state(false)
  let smtpUser = $state('')
  let smtpPassword = $state('')
  let fromAddress = $state('')
  let fromName = $state('')

  // Mahnwesen fields
  let reminderAutoEnabled = $state(true)
  let smallBusinessExempt = $state(false)
  let reminderDays1 = $state(3)
  let reminderDays2 = $state(10)
  let reminderDays3 = $state(20)
  let reminderDays4 = $state(30)
  let reminderFee1 = $state(0)
  let reminderFee2 = $state(5)
  let reminderFee3 = $state(10)
  let reminderFee4 = $state(15)
  let reminderInterestRate = $state(9.62)

  /* — Mail template state — */
  const templatesQ = $derived(listMailTemplatesRemote())
  const templates = $derived(templatesQ.current ?? [])
  let activeTemplateKey = $state<string | null>(null)
  let templateSubject = $state('')
  let templateBody = $state('')

  /** When templates load (or the active key changes), seed the editor. */
  $effect(() => {
    if (!templates.length) return
    if (!activeTemplateKey) activeTemplateKey = templates[0].key
    const tpl = templates.find((t) => t.key === activeTemplateKey)
    if (tpl) {
      templateSubject = tpl.subject
      templateBody = tpl.body
    }
  })

  let initialised = $state(false)

  $effect(() => {
    if (!data || initialised) return
    companyName = data.company.companyName
    owner = data.company.owner ?? ''
    street = data.company.street
    zip = data.company.zip
    city = data.company.city
    bundesland = data.company.state || 'Berlin'
    phone = data.company.phone
    mobile = data.company.mobile ?? ''
    email = data.company.email
    website = data.company.website ?? ''
    salutation = (data.company.salutationStyle as 'Sie' | 'Du') ?? 'Sie'
    vatId = data.company.vatId ?? ''
    taxNumber = data.company.taxNumber ?? ''
    bankName = data.company.bankName ?? ''
    iban = data.company.iban ?? ''
    bic = data.company.bic ?? ''
    pdfFooter = data.company.pdfFooter
    payrollGenerationDay = data.company.payrollGenerationDay ?? 25
    if (data.smtp) {
      smtpHost = data.smtp.host
      smtpPort = data.smtp.port
      smtpSecure =
        (data.smtp.secure as 'none' | 'STARTTLS' | 'TLS') ?? 'STARTTLS'
      smtpUser = data.smtp.username
      smtpPasswordSet = data.smtp.hasPassword
      fromAddress = data.smtp.fromAddress
      fromName = data.smtp.fromName
    }
    reminderAutoEnabled = data.company.reminderAutoEnabled
    smallBusinessExempt = data.company.smallBusinessExempt
    reminderDays1 = data.company.reminderDays1
    reminderDays2 = data.company.reminderDays2
    reminderDays3 = data.company.reminderDays3
    reminderDays4 = data.company.reminderDays4
    reminderFee1 = Number(data.company.reminderFee1)
    reminderFee2 = Number(data.company.reminderFee2)
    reminderFee3 = Number(data.company.reminderFee3)
    reminderFee4 = Number(data.company.reminderFee4)
    reminderInterestRate = Number(data.company.reminderInterestRate)
    initialised = true
  })

  const saveCompany = async (e: Event) => {
    e.preventDefault()
    if (!data) return
    try {
      formDirty.clear()
      await busy.run(() =>
        updateCompanyRemote({
          companyName,
          owner: owner || undefined,
          street,
          zip,
          city,
          state: bundesland,
          phone,
          mobile: mobile || undefined,
          email,
          website: website || undefined,
          salutationStyle: salutation,
          vatId: vatId || undefined,
          taxNumber: taxNumber || undefined,
          bankName: bankName || undefined,
          iban: iban || undefined,
          bic: bic || undefined,
          pdfFooter,
          payrollGenerationDay
        })
      )
      toast.success('Einstellungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const saveSmtp = async (e: Event) => {
    e.preventDefault()
    try {
      formDirty.clear()
      await busy.run(() =>
        updateSmtpRemote({
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure,
          username: smtpUser,
          password: smtpPassword || undefined,
          fromAddress,
          fromName,
          replyTo: undefined
        })
      )
      smtpPassword = ''
      toast.success('SMTP-Konfiguration gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const saveReminders = async (e: Event) => {
    e.preventDefault()
    try {
      formDirty.clear()
      await busy.run(() =>
        updateReminderSettingsRemote({
          reminderAutoEnabled,
          smallBusinessExempt,
          reminderDays1,
          reminderDays2,
          reminderDays3,
          reminderDays4,
          reminderFee1,
          reminderFee2,
          reminderFee3,
          reminderFee4,
          reminderInterestRate
        })
      )
      toast.success('Mahnwesen-Einstellungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /* ─ Logo handlers ─────────────────────────────────────────────────── */

  /**
   * Hooks for the shared `ImageUploader` component. The uploader handles
   * file picking, size validation and base64 conversion; we just persist
   * via the remote functions and refresh the settings query.
   */
  const uploadLogo = async (file: { mime: string; dataUrl: string }) => {
    try {
      await updateLogoRemote({ logoMime: file.mime, logoData: file.dataUrl })
      toast.success('Logo aktualisiert.')
    } catch (err) {
      handleClientError(err, 'Logo konnte nicht gespeichert werden')
      throw err
    }
  }

  const removeLogoViaUploader = async () => {
    try {
      await removeLogoRemote()
      toast.success('Logo entfernt.')
    } catch (err) {
      handleClientError(err, 'Logo konnte nicht entfernt werden')
      throw err
    }
  }

  /* ─ Mail template handlers ────────────────────────────────────────── */

  const templateLabel = (key: string): string => {
    switch (key) {
      case 'invoice':
        return 'Rechnung'
      case 'cost_estimate':
        return 'Kostenvoranschlag'
      case 'offer':
        return 'Angebot'
      case 'order_confirmation':
        return 'Auftragsbestätigung'
      case 'reminder_1':
        return 'Zahlungserinnerung'
      case 'reminder_2':
        return '2. Mahnung'
      case 'reminder_3':
        return 'Letzte Mahnung'
      case 'mailing':
        return 'Serienbrief'
      case 'payslip':
        return 'Lohnabrechnung'
      default:
        return key
    }
  }

  const saveTemplate = async (e: Event) => {
    e.preventDefault()
    if (!activeTemplateKey) return
    try {
      formDirty.clear()
      await busy.run(() =>
        updateMailTemplateRemote({
          key: activeTemplateKey!,
          subject: templateSubject,
          body: templateBody
        })
      )
      toast.success('Mailvorlage gespeichert.')
    } catch (err) {
      handleClientError(err, 'Mailvorlage konnte nicht gespeichert werden')
    }
  }

  const resetTemplate = async () => {
    if (!activeTemplateKey) return
    try {
      await busy.run(() => resetMailTemplateRemote({ key: activeTemplateKey! }))
      // The list refresh feeds the effect which re-seeds the editor.
      toast.success('Mailvorlage zurückgesetzt.')
    } catch (err) {
      handleClientError(err, 'Vorlage konnte nicht zurückgesetzt werden')
    }
  }
</script>

<PageHeader title="Einstellungen" />

<!--
  Browser-style attached tabs in the canonical daisyUI shape: each
  `<input class="tab">` is followed directly by its own
  `<div class="tab-content">`. The CSS sibling selector toggles
  visibility, so daisyUI removes the border segment between the active
  tab and its panel automatically — no manual `-mt-px` or `!block`
  override needed.

  We use `<label>` wrappers so the icon + text label are clickable as
  one piece, with `bind:group={activeTab}` keeping the Svelte state in
  sync for the form submit handlers.
-->
<div role="tablist" class="tabs tabs-lift">
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <label class="tab gap-2">
      <input
        type="radio"
        name="settings_tabs"
        bind:group={activeTab}
        value={t.id}
      />
      <Icon size={16} />
      <span>{t.label}</span>
    </label>
    <div class="tab-content border-base-300 bg-base-100 border p-6">
      {#if t.id === 'company'}
        <div class="flex flex-col gap-4">
          <ImageUploader
            title="Logo"
            hint="Wird im Briefkopf jedes PDFs dargestellt. Empfohlen: PNG oder SVG mit transparentem Hintergrund, max. 5 MB."
            single={true}
            allowSetMain={false}
            maxBytes={5 * 1024 * 1024}
            images={data?.company.logoData
              ? [{ id: 'logo', dataUrl: data.company.logoData, isMain: true }]
              : []}
            onUpload={uploadLogo}
            onDelete={data?.company.logoData
              ? removeLogoViaUploader
              : undefined}
          />

          <form
            onsubmit={saveCompany}
            oninput={markDirty}
            onchange={markDirty}
            class="flex flex-col gap-4"
          >
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Firma</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex w-full flex-col gap-1 sm:col-span-2">
                  <span class="label-text">Firmenname *</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="200"
                    required
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
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">E-Mail *</span>
                  <input
                    class="input input-bordered w-full"
                    type="email"
                    maxlength="254"
                    required
                    bind:value={email}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Anschrift</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="flex w-full flex-col gap-1 sm:col-span-3">
                  <span class="label-text">Straße *</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="200"
                    required
                    bind:value={street}
                  />
                </label>
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">PLZ *</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="10"
                    required
                    bind:value={zip}
                  />
                </label>
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">Ort *</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="150"
                    required
                    bind:value={city}
                  />
                </label>
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">Bundesland *</span>
                  <select
                    class="select select-bordered w-full"
                    bind:value={bundesland}
                  >
                    <option>Baden-Württemberg</option><option>Bayern</option
                    ><option>Berlin</option>
                    <option>Brandenburg</option><option>Bremen</option><option
                      >Hamburg</option
                    >
                    <option>Hessen</option><option
                      >Mecklenburg-Vorpommern</option
                    >
                    <option>Niedersachsen</option><option
                      >Nordrhein-Westfalen</option
                    >
                    <option>Rheinland-Pfalz</option><option>Saarland</option>
                    <option>Sachsen</option><option>Sachsen-Anhalt</option>
                    <option>Schleswig-Holstein</option><option>Thüringen</option
                    >
                  </select>
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Kontakt</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">Telefon *</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="30"
                    required
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
                  <span class="label-text">Website</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="2048"
                    bind:value={website}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Anrede-Stil</legend>
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="radio"
                  class="radio radio-primary"
                  value="Sie"
                  bind:group={salutation}
                />
                <span>Sie (formell, Standard)</span>
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
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Steuer</legend>
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
                  <span class="label-text">Steuernummer</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="30"
                    bind:value={taxNumber}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Bank</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="flex w-full flex-col gap-1 sm:col-span-3">
                  <span class="label-text">Bankname</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="100"
                    bind:value={bankName}
                  />
                </label>
                <label class="flex w-full flex-col gap-1 sm:col-span-2">
                  <span class="label-text">IBAN</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="34"
                    bind:value={iban}
                  />
                </label>
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">BIC</span>
                  <input
                    class="input input-bordered w-full"
                    maxlength="11"
                    bind:value={bic}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Lohnabrechnung</legend>
              <p class="text-base-content/60 text-sm">
                Tag im Monat, ab dem die Lohnabrechnungen automatisch angelegt
                werden. Davor erscheint der laufende Monat noch nicht in der
                Liste.
              </p>
              <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="flex w-full flex-col gap-1">
                  <span class="label-text">Stichtag (1–28)</span>
                  <input
                    class="input input-bordered w-full"
                    type="number"
                    min="1"
                    max="28"
                    bind:value={payrollGenerationDay}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">PDF-Endtext</legend>
              <p class="text-base-content/60 text-sm">
                Erscheint unter der Summe auf jedem Beleg-PDF. Ideal für
                Werbe-/Schlusstext oder Hinweise zur Zahlungsweise.
              </p>
              <textarea
                class="textarea textarea-bordered mt-2 min-h-32 w-full"
                maxlength="10000"
                bind:value={pdfFooter}
              ></textarea>
            </fieldset>
            <div class="flex justify-end">
              <button
                type="submit"
                class="btn btn-primary"
                disabled={busy.active}
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      {:else if t.id === 'mail'}
        {#if templates.length > 0}
          <form
            onsubmit={saveTemplate}
            oninput={markDirty}
            onchange={markDirty}
            class="flex flex-col gap-4"
          >
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Vorlage</legend>
              <select
                class="select select-bordered w-full"
                bind:value={activeTemplateKey}
              >
                {#each templates as tpl (tpl.key)}
                  <option value={tpl.key}>
                    {templateLabel(tpl.key)}{tpl.isCustom ? ' · angepasst' : ''}
                  </option>
                {/each}
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Betreff</legend>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={templateSubject}
              />
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Nachricht</legend>
              <textarea
                class="textarea textarea-bordered min-h-64 w-full font-mono text-sm"
                maxlength="20000"
                bind:value={templateBody}
              ></textarea>
              <p class="text-base-content/60 mt-2 text-xs">
                Platzhalter: <code class="font-mono">{'{firma}'}</code>,
                <code class="font-mono">{'{firmaIban}'}</code>,
                <code class="font-mono">{'{firmaBic}'}</code>,
                <code class="font-mono">{'{firmaTelefon}'}</code>,
                <code class="font-mono">{'{firmaMail}'}</code>,
                <code class="font-mono">{'{rechnungNummer}'}</code>,
                <code class="font-mono">{'{rechnungDatum}'}</code>,
                <code class="font-mono">{'{rechnungBetragBrutto}'}</code>,
                <code class="font-mono">{'{rechnungOffenerBetrag}'}</code>,
                <code class="font-mono">{'{fälligkeitsDatum}'}</code>,
                <code class="font-mono">{'{angebotNummer}'}</code>,
                <code class="font-mono">{'{angebotGültigBis}'}</code>,
                <code class="font-mono">{'{fahrzeugTyp}'}</code>,
                <code class="font-mono">{'{fahrzeugKennzeichen}'}</code>,
                <code class="font-mono">{'{verzugstage}'}</code>,
                <code class="font-mono">{'{mahnungGebühr}'}</code>,
                <code class="font-mono">{'{mitarbeiterVorname}'}</code>,
                <code class="font-mono">{'{periode}'}</code>.
              </p>
            </fieldset>

            <div class="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                class="btn btn-ghost"
                disabled={busy.active}
                onclick={resetTemplate}
              >
                Auf Standard zurücksetzen
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={busy.active}
              >
                Speichern
              </button>
            </div>
          </form>
        {/if}
      {:else if t.id === 'reminders'}
        <form
          onsubmit={saveReminders}
          oninput={markDirty}
          onchange={markDirty}
          class="flex flex-col gap-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Allgemein</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  bind:checked={reminderAutoEnabled}
                />
                <span>Mahnungen automatisch erzeugen lassen</span>
              </label>
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  bind:checked={smallBusinessExempt}
                />
                <span>Kleinunternehmer (§ 19 UStG)</span>
              </label>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend"
              >Mahnstufen — Tage nach Fälligkeit</legend
            >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Zahlungserinnerung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  bind:value={reminderDays1}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">1. Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  bind:value={reminderDays2}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">2. Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  bind:value={reminderDays3}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Letzte Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  bind:value={reminderDays4}
                />
              </label>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Mahngebühren (€)</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Zahlungserinnerung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  bind:value={reminderFee1}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">1. Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  bind:value={reminderFee2}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">2. Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  bind:value={reminderFee3}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Letzte Mahnung</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  bind:value={reminderFee4}
                />
              </label>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Verzugszinsen</legend>
            <label class="flex w-full max-w-xs flex-col gap-1">
              <span class="label-text">Zinssatz pro Jahr (%)</span>
              <input
                class="input input-bordered w-full"
                type="number"
                min="0"
                max="50"
                step="0.01"
                bind:value={reminderInterestRate}
              />
              <span class="label-text-alt text-base-content/60 mt-1 text-xs">
                Standard: 9,62 % p. a. (Basiszinssatz + 8,12 % bei B2B nach §
                288 Abs. 2 BGB).
              </span>
            </label>
          </fieldset>

          <div class="flex justify-end">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={busy.active}
            >
              Speichern
            </button>
          </div>
        </form>
      {:else if t.id === 'smtp'}
        <form
          onsubmit={saveSmtp}
          oninput={markDirty}
          onchange={markDirty}
          class="flex flex-col gap-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Absender</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Absender-Adresse *</span>
                <input
                  class="input input-bordered w-full"
                  type="email"
                  maxlength="254"
                  required
                  bind:value={fromAddress}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Absender-Name *</span>
                <input
                  class="input input-bordered w-full"
                  maxlength="200"
                  required
                  bind:value={fromName}
                />
              </label>
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Server</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex w-full flex-col gap-1 sm:col-span-2">
                <span class="label-text">SMTP-Host *</span>
                <input
                  class="input input-bordered w-full"
                  maxlength="255"
                  required
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
                  required
                  bind:value={smtpPort}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Verschlüsselung *</span>
                <select
                  class="select select-bordered w-full"
                  bind:value={smtpSecure}
                  onchange={() => {
                    // Standardports nach Verschlüsselungsmethode automatisch
                    // setzen — User kann den Wert anschließend manuell
                    // überschreiben. Mapping: keine → 25 (SMTP),
                    // STARTTLS → 587 (Submission), TLS → 465 (SMTPS).
                    smtpPort =
                      smtpSecure === 'TLS'
                        ? 465
                        : smtpSecure === 'STARTTLS'
                          ? 587
                          : 25
                  }}
                >
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="TLS">TLS (SSL)</option>
                  <option value="none">Keine</option>
                </select>
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Benutzername *</span>
                <input
                  class="input input-bordered w-full"
                  maxlength="200"
                  required
                  bind:value={smtpUser}
                />
              </label>
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">
                  Passwort {smtpPasswordSet ? '(leer lassen = behalten)' : '*'}
                </span>
                <input
                  class="input input-bordered w-full"
                  type="password"
                  maxlength="200"
                  placeholder={smtpPasswordSet ? '••••••••••' : ''}
                  bind:value={smtpPassword}
                />
              </label>
            </div>
          </fieldset>
          <div class="flex justify-end">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={busy.active}
            >
              Speichern
            </button>
          </div>
        </form>
      {/if}
    </div>
  {/each}
</div>
