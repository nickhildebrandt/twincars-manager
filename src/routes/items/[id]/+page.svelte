<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getItemRemote } from '../items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { Pencil, ArrowLeft } from '@lucide/svelte'
  import { formatEuro } from '$lib/utils/money'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getItemRemote({ id }) : null)
  const i = $derived(q?.current)

  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })
</script>

<PageHeader
  title={i?.description ?? 'Artikel'}
  back="/items"
  primaryAction={i
    ? { label: 'Bearbeiten', href: `/items/${i.id}/edit`, icon: Pencil }
    : undefined}
/>

{#if i}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Stammdaten</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Typ</dt><dd class="col-span-2"
            >{i.kind}</dd
          >
          <dt class="text-base-content/60">Einheit</dt><dd class="col-span-2"
            >{i.unit ?? '—'}</dd
          >
          <dt class="text-base-content/60">Auslaufartikel</dt><dd
            class="col-span-2">{i.discontinued ? 'Ja' : 'Nein'}</dd
          >
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Preise & Lager</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">VK netto</dt><dd
            class="col-span-2 font-mono"
            >{formatEuro(Number(i.unitPriceNet ?? 0))}</dd
          >
          <dt class="text-base-content/60">EK netto</dt><dd
            class="col-span-2 font-mono"
            >{i.purchasePriceNet
              ? formatEuro(Number(i.purchasePriceNet))
              : '—'}</dd
          >
          <dt class="text-base-content/60">Bestand</dt><dd class="col-span-2"
            >{i.stockOnHand}</dd
          >
          <dt class="text-base-content/60">Min / Max</dt><dd class="col-span-2"
            >{i.stockMin ?? '—'} / {i.stockMax ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    {#if i.notes}
      <div class="card border-base-300 bg-base-100 border lg:col-span-2">
        <div class="card-body">
          <h3 class="card-title text-base">Notiz</h3>
          <p class="text-sm whitespace-pre-line">{i.notes}</p>
        </div>
      </div>
    {/if}
  </div>
{/if}
