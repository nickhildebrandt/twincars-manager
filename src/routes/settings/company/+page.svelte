<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ArrowLeft } from '@lucide/svelte'
  import { getAllSettingsRemote, updateCompanyRemote } from '../settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const sQ = $derived(getAllSettingsRemote())
  const data = $derived(sQ.current)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
  })

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
  let initialised = $state(false)
  let busy = $state(false)

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
    initialised = true
  })

  const submit = async (e: Event) => {
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
        salutationStyle: salutation,
        vatId: data?.company.vatId ?? undefined,
        taxNumber: data?.company.taxNumber ?? undefined,
        bankName: data?.company.bankName ?? undefined,
        iban: data?.company.iban ?? undefined,
        bic: data?.company.bic ?? undefined,
        pdfFooter: data?.company.pdfFooter ?? ''
      })
      toast.success('Firmendaten gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Firmendaten">
  {#snippet actions()}
    <button
      class="btn btn-ghost btn-sm gap-2"
      onclick={() => goto('/settings')}
    >
      <ArrowLeft size={16} /> Zurück
    </button>
  {/snippet}
</PageHeader>

{#if !data}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><span class="loading loading-spinner"></span></div>
  </div>
{:else}
  <form onsubmit={submit} class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
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
    </div>
  </form>
{/if}
