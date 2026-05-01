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

  let pdfFooter = $state('')
  let initialised = $state(false)
  let busy = $state(false)

  $effect(() => {
    if (!data || initialised) return
    pdfFooter = data.company.pdfFooter
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
        vatId: data.company.vatId ?? undefined,
        taxNumber: data.company.taxNumber ?? undefined,
        bankName: data.company.bankName ?? undefined,
        iban: data.company.iban ?? undefined,
        bic: data.company.bic ?? undefined,
        pdfFooter
      })
      toast.success('Erscheinungsbild gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Erscheinungsbild">
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
    </div>
  </form>
{/if}
