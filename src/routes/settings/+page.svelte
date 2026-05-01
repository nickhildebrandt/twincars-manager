<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { Building2, Banknote, Mail } from '@lucide/svelte'
  import {
    getAllSettingsRemote,
    updateCompanyRemote,
    updateSmtpRemote
  } from './settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const sQ = $derived(getAllSettingsRemote())
  const data = $derived(sQ.current)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
  })

  let activeTab = $state<'company' | 'bank' | 'smtp'>('company')

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
  let pdfFooter = $state('')

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
    vatId = data.company.vatId ?? ''
    taxNumber = data.company.taxNumber ?? ''
    bankName = data.company.bankName ?? ''
    iban = data.company.iban ?? ''
    bic = data.company.bic ?? ''
    salutation = (data.company.salutationStyle as 'Sie' | 'Du') ?? 'Sie'
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
        vatId: vatId || undefined,
        taxNumber: taxNumber || undefined,
        bankName: bankName || undefined,
        iban: iban || undefined,
        bic: bic || undefined,
        salutationStyle: salutation,
        pdfFooter
      })
      toast.success('Firmendaten gespeichert.')
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

<PageHeader
  title="Einstellungen"
  subtitle="Firmen-, Bank- und Mail-Konfiguration."
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-[14rem_1fr]">
  <aside
    class="card border-base-300 bg-base-100 border lg:sticky lg:top-20 lg:h-fit"
  >
    <ul class="menu menu-md w-full p-2">
      <li>
        <button
          class:menu-active={activeTab === 'company'}
          onclick={() => (activeTab = 'company')}
        >
          <Building2 size={16} /> Firmendaten
        </button>
      </li>
      <li>
        <button
          class:menu-active={activeTab === 'bank'}
          onclick={() => (activeTab = 'bank')}
        >
          <Banknote size={16} /> Bank & Steuer
        </button>
      </li>
      <li>
        <button
          class:menu-active={activeTab === 'smtp'}
          onclick={() => (activeTab = 'smtp')}
        >
          <Mail size={16} /> E-Mail (SMTP)
        </button>
      </li>
    </ul>
  </aside>

  <div>
    {#if !data}
      <div class="card border-base-300 bg-base-100 border">
        <div class="card-body"
          ><span class="loading loading-spinner"></span></div
        >
      </div>
    {:else if activeTab === 'company'}
      <form
        onsubmit={saveCompany}
        class="card border-base-300 bg-base-100 border"
      >
        <div class="card-body gap-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Firmendaten</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="form-control sm:col-span-2"
                ><span class="label-text">Firmenname *</span><input
                  class="input input-bordered"
                  maxlength="200"
                  required
                  bind:value={companyName}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Inhaber</span><input
                  class="input input-bordered"
                  maxlength="200"
                  bind:value={owner}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">E-Mail *</span><input
                  class="input input-bordered"
                  type="email"
                  maxlength="254"
                  required
                  bind:value={email}
                /></label
              >
              <label class="form-control sm:col-span-2"
                ><span class="label-text">Straße *</span><input
                  class="input input-bordered"
                  maxlength="200"
                  required
                  bind:value={street}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">PLZ *</span><input
                  class="input input-bordered"
                  maxlength="10"
                  required
                  bind:value={zip}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Ort *</span><input
                  class="input input-bordered"
                  maxlength="150"
                  required
                  bind:value={city}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Bundesland *</span>
                <select class="select select-bordered" bind:value={bundesland}>
                  <option>Baden-Württemberg</option><option>Bayern</option
                  ><option>Berlin</option>
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
              <label class="form-control"
                ><span class="label-text">Telefon *</span><input
                  class="input input-bordered"
                  maxlength="30"
                  required
                  bind:value={phone}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Mobil</span><input
                  class="input input-bordered"
                  maxlength="30"
                  bind:value={mobile}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Website</span><input
                  class="input input-bordered"
                  maxlength="2048"
                  bind:value={website}
                /></label
              >
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Anrede</legend>
            <label class="label cursor-pointer justify-start gap-3"
              ><input
                type="radio"
                class="radio radio-primary"
                value="Sie"
                bind:group={salutation}
              /><span>Sie (formell)</span></label
            >
            <label class="label cursor-pointer justify-start gap-3"
              ><input
                type="radio"
                class="radio radio-primary"
                value="Du"
                bind:group={salutation}
              /><span>Du (persönlich)</span></label
            >
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">PDF-Footer</legend>
            <textarea
              class="textarea textarea-bordered min-h-24"
              maxlength="10000"
              bind:value={pdfFooter}
            ></textarea>
          </fieldset>

          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary" disabled={busy}>
              {#if busy}<span class="loading loading-spinner loading-sm"
                ></span>{/if}
              Speichern
            </button>
          </div>
        </div>
      </form>
    {:else if activeTab === 'bank'}
      <form
        onsubmit={saveCompany}
        class="card border-base-300 bg-base-100 border"
      >
        <div class="card-body gap-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Steuer</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="form-control"
                ><span class="label-text">USt-IdNr.</span><input
                  class="input input-bordered"
                  maxlength="30"
                  bind:value={vatId}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Steuernummer</span><input
                  class="input input-bordered"
                  maxlength="30"
                  bind:value={taxNumber}
                /></label
              >
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Bankdaten</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="form-control sm:col-span-3"
                ><span class="label-text">Bankname</span><input
                  class="input input-bordered"
                  maxlength="100"
                  bind:value={bankName}
                /></label
              >
              <label class="form-control sm:col-span-2"
                ><span class="label-text">IBAN</span><input
                  class="input input-bordered"
                  maxlength="34"
                  bind:value={iban}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">BIC</span><input
                  class="input input-bordered"
                  maxlength="11"
                  bind:value={bic}
                /></label
              >
            </div>
          </fieldset>
          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary" disabled={busy}>
              {#if busy}<span class="loading loading-spinner loading-sm"
                ></span>{/if}
              Speichern
            </button>
          </div>
        </div>
      </form>
    {:else if activeTab === 'smtp'}
      <form onsubmit={saveSmtp} class="card border-base-300 bg-base-100 border">
        <div class="card-body gap-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">SMTP-Server</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="form-control sm:col-span-2"
                ><span class="label-text">Absender-Adresse *</span><input
                  class="input input-bordered"
                  type="email"
                  maxlength="254"
                  required
                  bind:value={fromAddress}
                /></label
              >
              <label class="form-control sm:col-span-2"
                ><span class="label-text">Absender-Name *</span><input
                  class="input input-bordered"
                  maxlength="200"
                  required
                  bind:value={fromName}
                /></label
              >
              <label class="form-control sm:col-span-2"
                ><span class="label-text">SMTP-Host *</span><input
                  class="input input-bordered"
                  maxlength="255"
                  required
                  bind:value={smtpHost}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Port *</span><input
                  class="input input-bordered"
                  type="number"
                  min="1"
                  max="65535"
                  required
                  bind:value={smtpPort}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Verschlüsselung *</span>
                <select class="select select-bordered" bind:value={smtpSecure}>
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="TLS">TLS</option>
                  <option value="none">Keine</option>
                </select>
              </label>
              <label class="form-control"
                ><span class="label-text">Benutzername *</span><input
                  class="input input-bordered"
                  maxlength="200"
                  required
                  bind:value={smtpUser}
                /></label
              >
              <label class="form-control"
                ><span class="label-text">Passwort (leer = unverändert)</span
                ><input
                  class="input input-bordered"
                  type="password"
                  maxlength="200"
                  bind:value={smtpPassword}
                /></label
              >
            </div>
          </fieldset>
          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary" disabled={busy}>
              {#if busy}<span class="loading loading-spinner loading-sm"
                ></span>{/if}
              Speichern
            </button>
          </div>
        </div>
      </form>
    {/if}
  </div>
</div>
