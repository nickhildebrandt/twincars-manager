<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    Building2,
    Banknote,
    Image as ImageIcon,
    Mail,
    Server,
    FileText
  } from '@lucide/svelte'
  import {
    getAllSettingsRemote,
    updateCompanyRemote,
    updateSmtpRemote
  } from './settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  type Tab = 'company' | 'bank' | 'branding' | 'mail' | 'smtp'
  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'company', label: 'Firmendaten', icon: Building2 },
    { id: 'bank', label: 'Bank & Steuer', icon: Banknote },
    { id: 'branding', label: 'Erscheinungsbild', icon: ImageIcon },
    { id: 'mail', label: 'Mailvorlagen', icon: FileText },
    { id: 'smtp', label: 'SMTP', icon: Server }
  ]

  let activeTab = $state<Tab>('company')

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
  let smtpUser = $state('')
  let smtpPassword = $state('')
  let fromAddress = $state('')
  let fromName = $state('')

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
      fromAddress = data.smtp.fromAddress
      fromName = data.smtp.fromName
    }
    initialised = true
  })

  let busy = $state(false)

  const saveCompany = async (e: Event) => {
    e.preventDefault()
    if (!data) return
    busy = true
    try {
      await updateCompanyRemote({
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
      toast.success('Einstellungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }

  const saveSmtp = async (e: Event) => {
    e.preventDefault()
    busy = true
    try {
      await updateSmtpRemote({
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        username: smtpUser,
        password: smtpPassword || undefined,
        fromAddress,
        fromName,
        replyTo: undefined
      })
      smtpPassword = ''
      toast.success('SMTP-Konfiguration gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Einstellungen" />

<!-- Browser-style attached tabs -->
<div role="tablist" class="tabs tabs-lift">
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <button
      role="tab"
      type="button"
      class="tab gap-2"
      class:tab-active={activeTab === t.id}
      onclick={() => (activeTab = t.id)}
    >
      <Icon size={16} />
      <span>{t.label}</span>
    </button>
  {/each}
</div>

<div
  class="card border-base-300 bg-base-100 -mt-px rounded-tl-none rounded-tr-none border"
>
  <div class="card-body">
    {#if !data}
      <span class="loading loading-spinner"></span>
    {:else if activeTab === 'company'}
      <form onsubmit={saveCompany} class="flex flex-col gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Firma</legend>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control sm:col-span-2">
              <span class="label-text">Firmenname *</span>
              <input
                class="input input-bordered"
                maxlength="200"
                required
                bind:value={companyName}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Inhaber</span>
              <input
                class="input input-bordered"
                maxlength="200"
                bind:value={owner}
              />
            </label>
            <label class="form-control">
              <span class="label-text">E-Mail *</span>
              <input
                class="input input-bordered"
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
            <label class="form-control sm:col-span-3">
              <span class="label-text">Straße *</span>
              <input
                class="input input-bordered"
                maxlength="200"
                required
                bind:value={street}
              />
            </label>
            <label class="form-control">
              <span class="label-text">PLZ *</span>
              <input
                class="input input-bordered"
                maxlength="10"
                required
                bind:value={zip}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Ort *</span>
              <input
                class="input input-bordered"
                maxlength="150"
                required
                bind:value={city}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Bundesland *</span>
              <select class="select select-bordered" bind:value={bundesland}>
                <option>Baden-Württemberg</option><option>Bayern</option><option
                  >Berlin</option
                >
                <option>Brandenburg</option><option>Bremen</option><option
                  >Hamburg</option
                >
                <option>Hessen</option><option>Mecklenburg-Vorpommern</option>
                <option>Niedersachsen</option><option
                  >Nordrhein-Westfalen</option
                >
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
            <label class="form-control">
              <span class="label-text">Telefon *</span>
              <input
                class="input input-bordered"
                maxlength="30"
                required
                bind:value={phone}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Mobil</span>
              <input
                class="input input-bordered"
                maxlength="30"
                bind:value={mobile}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Website</span>
              <input
                class="input input-bordered"
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
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {#if busy}<span class="loading loading-spinner loading-sm"
              ></span>{/if}
            Speichern
          </button>
        </div>
      </form>
    {:else if activeTab === 'bank'}
      <form onsubmit={saveCompany} class="flex flex-col gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Steuer</legend>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">USt-IdNr.</span>
              <input
                class="input input-bordered"
                maxlength="30"
                bind:value={vatId}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Steuernummer</span>
              <input
                class="input input-bordered"
                maxlength="30"
                bind:value={taxNumber}
              />
            </label>
          </div>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Bank</legend>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="form-control sm:col-span-3">
              <span class="label-text">Bankname</span>
              <input
                class="input input-bordered"
                maxlength="100"
                bind:value={bankName}
              />
            </label>
            <label class="form-control sm:col-span-2">
              <span class="label-text">IBAN</span>
              <input
                class="input input-bordered"
                maxlength="34"
                bind:value={iban}
              />
            </label>
            <label class="form-control">
              <span class="label-text">BIC</span>
              <input
                class="input input-bordered"
                maxlength="11"
                bind:value={bic}
              />
            </label>
          </div>
        </fieldset>
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {#if busy}<span class="loading loading-spinner loading-sm"
              ></span>{/if}
            Speichern
          </button>
        </div>
      </form>
    {:else if activeTab === 'branding'}
      <form onsubmit={saveCompany} class="flex flex-col gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Logo</legend>
          <p class="text-base-content/60 text-sm">
            Das beim Setup hochgeladene Logo wird auf jedem PDF im Briefkopf
            dargestellt. Eine Logo-Aktualisierung ist eine Folgefunktion.
          </p>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">PDF-Footer</legend>
          <textarea
            class="textarea textarea-bordered min-h-32"
            maxlength="10000"
            bind:value={pdfFooter}
          ></textarea>
        </fieldset>
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {#if busy}<span class="loading loading-spinner loading-sm"
              ></span>{/if}
            Speichern
          </button>
        </div>
      </form>
    {:else if activeTab === 'mail'}
      <div class="flex flex-col gap-3">
        <p class="text-base-content/70 text-sm">
          Hier werden in einer Folgefunktion alle Mailvorlagen (Rechnung,
          Angebot, Mahnung Stufe 1–3, Lohnzettel, Serienbrief) verwaltet —
          Betreff, Body, Live-Vorschau und Reset auf Standard.
        </p>
        <p class="text-base-content/70 text-sm">
          Standardvorlagen sind beim Setup automatisch in der Datenbank angelegt
          worden und werden bereits beim E-Mail-Versand verwendet.
        </p>
      </div>
    {:else if activeTab === 'smtp'}
      <form onsubmit={saveSmtp} class="flex flex-col gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Absender</legend>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Absender-Adresse *</span>
              <input
                class="input input-bordered"
                type="email"
                maxlength="254"
                required
                bind:value={fromAddress}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Absender-Name *</span>
              <input
                class="input input-bordered"
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
            <label class="form-control sm:col-span-2">
              <span class="label-text">SMTP-Host *</span>
              <input
                class="input input-bordered"
                maxlength="255"
                required
                bind:value={smtpHost}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Port *</span>
              <input
                class="input input-bordered"
                type="number"
                min="1"
                max="65535"
                required
                bind:value={smtpPort}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Verschlüsselung *</span>
              <select class="select select-bordered" bind:value={smtpSecure}>
                <option value="STARTTLS">STARTTLS</option>
                <option value="TLS">TLS</option>
                <option value="none">Keine</option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text">Benutzername *</span>
              <input
                class="input input-bordered"
                maxlength="200"
                required
                bind:value={smtpUser}
              />
            </label>
            <label class="form-control">
              <span class="label-text">Passwort (leer = unverändert)</span>
              <input
                class="input input-bordered"
                type="password"
                maxlength="200"
                bind:value={smtpPassword}
              />
            </label>
          </div>
        </fieldset>
        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {#if busy}<span class="loading loading-spinner loading-sm"
              ></span>{/if}
            Speichern
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>
