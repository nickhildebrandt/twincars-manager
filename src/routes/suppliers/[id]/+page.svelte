<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getSupplierRemote } from '../suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { Pencil, ArrowLeft } from '@lucide/svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getSupplierRemote({ id }) : null)
  const s = $derived(q?.current)

  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })
</script>

<PageHeader
  title={s?.name ?? 'Lieferant'}
  back="/suppliers"
  primaryAction={s
    ? { label: 'Bearbeiten', href: `/suppliers/${s.id}/edit`, icon: Pencil }
    : undefined}
/>

{#if s}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Anschrift</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Straße</dt><dd class="col-span-2"
            >{s.street ?? '—'}</dd
          >
          <dt class="text-base-content/60">PLZ / Ort</dt><dd class="col-span-2"
            >{[s.zip, s.city].filter(Boolean).join(' ') || '—'}</dd
          >
          <dt class="text-base-content/60">Land</dt><dd class="col-span-2"
            >{s.country ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Kontakt</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Telefon</dt><dd class="col-span-2"
            >{s.phone ?? '—'}</dd
          >
          <dt class="text-base-content/60">Fax</dt><dd class="col-span-2"
            >{s.fax ?? '—'}</dd
          >
          <dt class="text-base-content/60">E-Mail</dt><dd class="col-span-2"
            >{s.email ?? '—'}</dd
          >
          <dt class="text-base-content/60">Website</dt><dd class="col-span-2"
            >{s.website ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    {#if s.iban || s.bic || s.bankName}
      <div class="card border-base-300 bg-base-100 border lg:col-span-2">
        <div class="card-body">
          <h3 class="card-title text-base">Bankdaten</h3>
          <dl class="grid grid-cols-3 gap-y-1 text-sm">
            <dt class="text-base-content/60">Bank</dt><dd class="col-span-2"
              >{s.bankName ?? '—'}</dd
            >
            <dt class="text-base-content/60">IBAN</dt><dd
              class="col-span-2 font-mono">{s.iban ?? '—'}</dd
            >
            <dt class="text-base-content/60">BIC</dt><dd
              class="col-span-2 font-mono">{s.bic ?? '—'}</dd
            >
          </dl>
        </div>
      </div>
    {/if}
  </div>
{/if}
