<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getVehicleRemote } from '../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { Pencil, ArrowLeft } from '@lucide/svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getVehicleRemote({ id }) : null)
  const v = $derived(q?.current)
  const loading = $derived(q?.loading ?? true)

  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })
</script>

<PageHeader
  title={loading
    ? 'Lädt …'
    : `${v?.make ?? ''} ${v?.model ?? ''}`.trim() || 'Fahrzeug'}
  back="/vehicles"
  primaryAction={v
    ? { label: 'Bearbeiten', href: `/vehicles/${v.id}/edit`, icon: Pencil }
    : undefined}
/>

{#if v}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Stammdaten</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Marke</dt>
          <dd class="col-span-2">{v.make ?? '—'}</dd>
          <dt class="text-base-content/60">Modell</dt>
          <dd class="col-span-2">{v.model ?? '—'}</dd>
          <dt class="text-base-content/60">Kennzeichen</dt>
          <dd class="col-span-2 font-mono">{v.licensePlate ?? '—'}</dd>
          <dt class="text-base-content/60">FIN</dt>
          <dd class="col-span-2 font-mono">{v.vin ?? '—'}</dd>
          <dt class="text-base-content/60">Erstzulassung</dt>
          <dd class="col-span-2">{v.firstRegistration ?? '—'}</dd>
          <dt class="text-base-content/60">km-Stand</dt>
          <dd class="col-span-2">
            {v.mileageKm ? v.mileageKm.toLocaleString('de-DE') + ' km' : '—'}
          </dd>
          <dt class="text-base-content/60">Nächste HU</dt>
          <dd class="col-span-2">{v.nextHu ?? '—'}</dd>
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Technik</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">HSN/TSN</dt>
          <dd class="col-span-2"
            >{[v.hsn, v.tsn].filter(Boolean).join(' / ') || '—'}</dd
          >
          <dt class="text-base-content/60">Hubraum</dt>
          <dd class="col-span-2"
            >{v.displacementCcm ? `${v.displacementCcm} ccm` : '—'}</dd
          >
          <dt class="text-base-content/60">kW</dt>
          <dd class="col-span-2">{v.powerKw ?? '—'}</dd>
          <dt class="text-base-content/60">Kraftstoff</dt>
          <dd class="col-span-2">{v.fuelType ?? '—'}</dd>
          <dt class="text-base-content/60">Getriebe</dt>
          <dd class="col-span-2">{v.gearbox ?? '—'}</dd>
          <dt class="text-base-content/60">Aufbau</dt>
          <dd class="col-span-2">{v.bodyType ?? '—'}</dd>
        </dl>
      </div>
    </div>
    {#if v.notes}
      <div class="card border-base-300 bg-base-100 border lg:col-span-2">
        <div class="card-body">
          <h3 class="card-title text-base">Notiz</h3>
          <p class="text-sm whitespace-pre-line">{v.notes}</p>
        </div>
      </div>
    {/if}
  </div>
{/if}
