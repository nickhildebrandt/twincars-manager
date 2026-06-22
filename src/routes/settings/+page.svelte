<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import {
    Building2,
    Server,
    FileText,
    AlertTriangle,
    Disc3
  } from '@lucide/svelte'
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
    { id: 'reminders', label: 'Zahlungserinnerung', icon: AlertTriangle },
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

  // Zahlungserinnerung fields — single friendly template that
  // repeats every N days; keine Eskalation, keine Mahngebühr,
  // keine Verzugszinsen.
  let reminderAutoEnabled = $state(true)
  let smallBusinessExempt = $state(false)
  let reminderDays1 = $state(3)
  let reminderRecurEveryDays = $state(14)
  // Inline Vorlagentext für die einzige `reminder_1`-Mailvorlage,
  // damit der Operator Betreff + Body direkt aus diesem Tab pflegen
  // kann, ohne in die Mailvorlagen wechseln zu müssen.
  let reminderTemplateSubject = $state('')
  let reminderTemplateBody = $state('')

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
    reminderRecurEveryDays = data.company.reminderRecurEveryDays
    initialised = true
  })

  // Hydrate the inline Zahlungserinnerungs-Vorlage from the mail
  // templates list as soon as it arrives. Runs once — subsequent edits
  // stay user-driven so we don't fight typing.
  let reminderTemplateInitialised = $state(false)
  $effect(() => {
    if (reminderTemplateInitialised || !templates.length) return
    const tpl = templates.find((t) => t.key === 'reminder_1')
    if (tpl) {
      reminderTemplateSubject = tpl.subject
      reminderTemplateBody = tpl.body
      reminderTemplateInitialised = true
    }
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
          pdfFooter
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
      await busy.run(async () => {
        await updateReminderSettingsRemote({
          reminderAutoEnabled,
          smallBusinessExempt,
          reminderDays1,
          reminderRecurEveryDays
        })
        // Persist the inline template edits alongside the settings so
        // the operator gets a single "Speichern" experience.
        await updateMailTemplateRemote({
          key: 'reminder_1',
          subject: reminderTemplateSubject,
          body: reminderTemplateBody
        })
      })
      toast.success('Einstellungen für Zahlungserinnerungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const resetReminderTemplate = async () => {
    try {
      await busy.run(() => resetMailTemplateRemote({ key: 'reminder_1' }))
      reminderTemplateInitialised = false
      toast.success('Vorlage zurückgesetzt.')
    } catch (err) {
      handleClientError(err, 'Vorlage konnte nicht zurückgesetzt werden')
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
      case 'mailing':
        return 'Serienbrief'
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

          <!--
            Reifenwechsel-Erinnerungen: eigene Unterseite, weil dort
            zwei eigenständige Karten (Frühjahr + Herbst) mit Vorschau
            und „Jetzt senden" leben — passt nicht in einen einzelnen
            Tab-Form-Submit.
          -->
          <a
            href="/settings/tire-reminders"
            class="card border-base-300 bg-base-100 hover:bg-base-200 border"
          >
            <div class="card-body flex-row items-center gap-3">
              <Disc3 size={20} class="text-base-content/60" />
              <div class="grow">
                <div class="font-medium">Reifenwechsel-Erinnerungen</div>
                <div class="text-base-content/60 text-sm">
                  Twice-yearly Mailings an Kunden mit eingelagerten Reifen.
                </div>
              </div>
              <span class="btn btn-ghost btn-sm">Öffnen</span>
            </div>
          </a>
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
          <div class="alert alert-info">
            <span class="text-sm">
              Es gibt nur eine einzige freundliche „Zahlungserinnerung" — keine
              Mahnstufen, keine Mahngebühr, keine Verzugszinsen. Sie wird ab dem
              konfigurierten Tag nach Fälligkeit versendet und so lange in
              regelmäßigen Abständen wiederholt, bis die Rechnung bezahlt ist.
            </span>
          </div>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Allgemein</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  bind:checked={reminderAutoEnabled}
                />
                <span>Zahlungserinnerungen automatisch versenden</span>
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
            <legend class="fieldset-legend">Zeitplan</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex w-full flex-col gap-1">
                <span class="label-text"
                  >Erste Erinnerung nach (Tagen nach Fälligkeit)</span
                >
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
                <span class="label-text">Folge-Erinnerung alle (Tage)</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  bind:value={reminderRecurEveryDays}
                />
                <span class="label-text-alt text-base-content/60 mt-1 text-xs">
                  Solange die Rechnung offen ist, wird die Zahlungserinnerung
                  alle {reminderRecurEveryDays} Tage erneut versendet.
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Vorlagentext</legend>
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Betreff</span>
              <input
                class="input input-bordered w-full"
                maxlength="200"
                bind:value={reminderTemplateSubject}
              />
            </label>
            <label class="mt-2 flex w-full flex-col gap-1">
              <span class="label-text">Nachricht</span>
              <textarea
                class="textarea textarea-bordered w-full"
                rows="10"
                bind:value={reminderTemplateBody}
              ></textarea>
              <span class="label-text-alt text-base-content/60 mt-1 text-xs">
                Verfügbare Platzhalter: {'{firma}'}, {'{rechnungNummer}'},
                {'{rechnungDatum}'}, {'{rechnungOffenerBetrag}'},
                {'{verzugstage}'}, {'{fälligkeitsDatum}'}.
              </span>
            </label>
            <div class="mt-2 flex justify-end">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                disabled={busy.active}
                onclick={resetReminderTemplate}
              >
                Auf Standard zurücksetzen
              </button>
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
