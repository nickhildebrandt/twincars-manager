<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getVehicleRemote } from '../vehicles.remote'
  import { Pencil } from '@lucide/svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const v = await getVehicleRemote({ id })
</script>

<PageHeader
  title={`${v.make ?? ''} ${v.model ?? ''}`.trim() || 'Fahrzeug'}
  back="/vehicles"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/vehicles/${v.id}/edit`,
    icon: Pencil
  }}
/>

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
