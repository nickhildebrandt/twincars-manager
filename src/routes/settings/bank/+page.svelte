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

  let vatId = $state('')
  let taxNumber = $state('')
  let bankName = $state('')
  let iban = $state('')
  let bic = $state('')
  let initialised = $state(false)
  let busy = $state(false)

  $effect(() => {
    if (!data || initialised) return
    vatId = data.company.vatId ?? ''
    taxNumber = data.company.taxNumber ?? ''
    bankName = data.company.bankName ?? ''
    iban = data.company.iban ?? ''
    bic = data.company.bic ?? ''
    initialised = true
  })

  const submit = async (e: Event) => {
    if (!data) return
    e.preventDefault()
    busy = true
    try {
      await updateCompanyRemote({
        companyName: data.company.companyName,
        owner: data.company.owner ?? undefined,
        street: data.company.street,
        zip: data.company.zip,
        city: data.company.city,
        state: data.company.state,
        phone: data.company.phone,
        mobile: data.company.mobile ?? undefined,
        email: data.company.email,
        website: data.company.website ?? undefined,
        salutationStyle:
          (data.company.salutationStyle as 'Sie' | 'Du') ?? 'Sie',
        vatId: vatId || undefined,
        taxNumber: taxNumber || undefined,
        bankName: bankName || undefined,
        iban: iban || undefined,
        bic: bic || undefined,
        pdfFooter: data.company.pdfFooter
      })
      toast.success('Bank- und Steuerdaten gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Bank und Steuer">
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
    </div>
  </form>
{/if}
