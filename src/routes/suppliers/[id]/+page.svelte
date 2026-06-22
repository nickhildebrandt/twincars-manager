<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getSupplierRemote } from '../suppliers.remote'
  import { Pencil } from '@lucide/svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const s = await getSupplierRemote({ id })
</script>

<PageHeader
  title={s.name}
  back="/suppliers"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/suppliers/${s.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Anschrift</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Straße</dt><dd
          class="break-words sm:col-span-2">{s.street ?? '—'}</dd
        >
        <dt class="text-base-content/60">PLZ / Ort</dt><dd
          class="break-words sm:col-span-2"
          >{[s.zip, s.city].filter(Boolean).join(' ') || '—'}</dd
        >
        <dt class="text-base-content/60">Land</dt><dd
          class="break-words sm:col-span-2">{s.country ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Kontakt</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Telefon</dt><dd
          class="break-all sm:col-span-2">{s.phone ?? '—'}</dd
        >
        <dt class="text-base-content/60">Fax</dt><dd
          class="break-all sm:col-span-2">{s.fax ?? '—'}</dd
        >
        <dt class="text-base-content/60">E-Mail</dt><dd
          class="break-all sm:col-span-2">{s.email ?? '—'}</dd
        >
        <dt class="text-base-content/60">Website</dt><dd
          class="break-all sm:col-span-2">{s.website ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  {#if s.iban || s.bic || s.bankName}
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Bankdaten</h3>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Bank</dt><dd
            class="break-words sm:col-span-2">{s.bankName ?? '—'}</dd
          >
          <dt class="text-base-content/60">IBAN</dt><dd
            class="font-mono break-all sm:col-span-2">{s.iban ?? '—'}</dd
          >
          <dt class="text-base-content/60">BIC</dt><dd
            class="font-mono break-all sm:col-span-2">{s.bic ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
  {/if}
</div>
