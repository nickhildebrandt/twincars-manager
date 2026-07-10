<script lang="ts">
  /**
   * General settings ("Allgemein"): company master data, logo, labor
   * rate and the link to the tire reminder mailings. Mail templates,
   * payment reminders and SMTP were promoted to their own top-level
   * settings tabs (/settings/mail, /settings/reminders,
   * /settings/smtp) — there is exactly ONE tab level in the settings
   * area (the section layout) and no tabs inside a settings tab.
   */
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import { Disc3 } from '@lucide/svelte'
  import {
    getAllSettingsRemote,
    getLaborRateSettingRemote,
    removeLogoRemote,
    updateCompanyRemote,
    updateLaborRateRemote,
    updateLogoRemote
  } from './settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { page as pageStore } from '$app/state'
  import { goto } from '$app/navigation'

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  /**
   * Legacy deep links: the areas that used to live behind `?tab=` on
   * this page are top-level settings routes now. Map old URLs onto the
   * new locations (replaceState — the old URL never enters history).
   */
  const LEGACY_TAB_ROUTES: Record<string, string> = {
    mail: '/settings/mail',
    reminders: '/settings/reminders',
    smtp: '/settings/smtp'
  }
  const legacyTarget =
    LEGACY_TAB_ROUTES[pageStore.url.searchParams.get('tab') ?? ''] ?? null
  $effect(() => {
    if (legacyTarget) goto(legacyTarget, { replaceState: true })
  })

  // Never memoize the query proxy (CONTRIBUTING §5) — the save
  // commands refresh this query server-side and the page must pick
  // the fresh value up without a reload.
  const data = $derived.by(() => getAllSettingsRemote().current)

  $effect(() => {
    const q = getAllSettingsRemote()
    if (q.error) handleClientError(q.error)
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
          pdfFooter
        })
      )
      toast.success('Einstellungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /* ─ Stundensatz (workshop labor rate) ─────────────────────────────── */

  const laborRate = $derived.by(() => getLaborRateSettingRemote().current)

  $effect(() => {
    const q = getLaborRateSettingRemote()
    if (q.error) handleClientError(q.error)
  })

  let laborRateInput = $state<number | null>(null)
  let laborRateInitialised = $state(false)
  $effect(() => {
    if (laborRateInitialised || laborRate === undefined) return
    laborRateInput = laborRate?.unitPriceNet
      ? Number(laborRate.unitPriceNet)
      : null
    laborRateInitialised = true
  })

  const fmtRate = (v: string): string =>
    `${Number(v).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} €`

  const saveLaborRate = async (e: Event) => {
    e.preventDefault()
    const value = Number(laborRateInput)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Bitte einen Stundensatz größer als 0 eingeben.')
      return
    }
    try {
      formDirty.clear()
      await busy.run(() => updateLaborRateRemote({ priceNet: value }))
      toast.success('Stundensatz aktualisiert.')
    } catch (err) {
      handleClientError(err, 'Stundensatz konnte nicht gespeichert werden')
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
</script>

<PageHeader title="Einstellungen" />

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
    onDelete={data?.company.logoData ? removeLogoViaUploader : undefined}
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
          <select class="select select-bordered w-full" bind:value={bundesland}>
            <option>Baden-Württemberg</option><option>Bayern</option><option
              >Berlin</option
            >
            <option>Brandenburg</option><option>Bremen</option><option
              >Hamburg</option
            >
            <option>Hessen</option><option>Mecklenburg-Vorpommern</option>
            <option>Niedersachsen</option><option>Nordrhein-Westfalen</option>
            <option>Rheinland-Pfalz</option><option>Saarland</option>
            <option>Sachsen</option><option>Sachsen-Anhalt</option>
            <option>Schleswig-Holstein</option><option>Thüringen</option>
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
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        Speichern
      </button>
    </div>
  </form>

  <!--
    Labor rate: its own small form (not a company_settings
    column; the value lives as a price version on the
    "Arbeitszeit" catalog item, so the history is preserved).
  -->
  <form onsubmit={saveLaborRate} oninput={markDirty} onchange={markDirty}>
    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stundensatz</legend>
      <p class="text-base-content/60 text-sm">
        Netto pro Stunde; wird beim Abschließen von Aufträgen als
        Arbeitszeit-Position berechnet.
      </p>
      {#if laborRate}
        <div class="mt-2 flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1">
            <span class="label-text">Stundensatz (netto, EUR)</span>
            <input
              class="input input-bordered w-44"
              type="number"
              min="0.01"
              step="0.01"
              required
              bind:value={laborRateInput}
            />
          </label>
          <span class="text-base-content/60 pb-3 text-sm">
            Aktuell: {laborRate.unitPriceNet
              ? fmtRate(laborRate.unitPriceNet)
              : 'nicht gesetzt'}
          </span>
          <button type="submit" class="btn btn-primary" disabled={busy.active}>
            Speichern
          </button>
        </div>
      {:else if laborRate === null}
        <p class="mt-2 text-sm">Es ist kein Arbeitszeit-Artikel hinterlegt.</p>
      {/if}
    </fieldset>
  </form>

  <!--
    Reifenwechsel-Erinnerungen: eigene Unterseite, weil dort
    zwei eigenständige Karten (Frühjahr + Herbst) mit Vorschau
    und „Jetzt senden" leben — passt nicht in einen einzelnen
    Form-Submit.
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
