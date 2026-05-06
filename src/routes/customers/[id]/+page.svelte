<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    getCustomerRemote,
    getCustomerRelatedRemote
  } from '../customers.remote'
  import { Pencil } from '@lucide/svelte'
  import {
    documentStatusBadge,
    documentStatusLabel
  } from '$lib/utils/status-labels'
  import { formatEuro } from '$lib/utils/money'

  const id = untrack(() => page.params.id!)

  /**
   * SSR-friendly parallel load. The customer record + related vehicles
   * and invoices ship in one server round-trip.
   */
  const [customer, related] = await Promise.all([
    getCustomerRemote({ id }),
    getCustomerRelatedRemote({ id })
  ])

  const labelOf = () =>
    customer.company ||
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
    customer.customerNumber
</script>

<PageHeader
  title={labelOf()}
  back="/customers"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/customers/${customer.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Anschrift</h3>
      <dl class="grid grid-cols-3 gap-y-1 text-sm">
        <dt class="text-base-content/60">Firma</dt>
        <dd class="col-span-2">{customer.company ?? '—'}</dd>
        <dt class="text-base-content/60">Name</dt>
        <dd class="col-span-2">
          {[customer.salutation, customer.firstName, customer.lastName]
            .filter(Boolean)
            .join(' ') || '—'}
        </dd>
        <dt class="text-base-content/60">Straße</dt>
        <dd class="col-span-2">{customer.street ?? '—'}</dd>
        <dt class="text-base-content/60">PLZ / Ort</dt>
        <dd class="col-span-2">
          {[customer.zip, customer.city].filter(Boolean).join(' ') || '—'}
        </dd>
      </dl>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Kontakt</h3>
      <dl class="grid grid-cols-3 gap-y-1 text-sm">
        <dt class="text-base-content/60">Telefon</dt>
        <dd class="col-span-2">{customer.phone ?? '—'}</dd>
        <dt class="text-base-content/60">Mobil</dt>
        <dd class="col-span-2">{customer.mobile ?? '—'}</dd>
        <dt class="text-base-content/60">E-Mail</dt>
        <dd class="col-span-2">{customer.email ?? '—'}</dd>
        <dt class="text-base-content/60">Website</dt>
        <dd class="col-span-2">{customer.website ?? '—'}</dd>
      </dl>
    </div>
  </div>

  {#if customer.notes}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Notiz</h3>
        <p class="text-sm whitespace-pre-line">{customer.notes}</p>
      </div>
    </div>
  {/if}

  <!-- Fahrzeuge des Kunden -->
  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Fahrzeuge</h3>
        <p class="text-base-content/60 text-sm">
          {related.vehicles.length} verknüpfte
          {related.vehicles.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'}.
        </p>
      </div>
      {#if related.vehicles.length === 0}
        <div class="text-base-content/60 px-4 py-6 text-sm">
          Keine Fahrzeuge auf diesen Kunden zugeordnet.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Kennzeichen</th>
                <th>Fahrzeug</th>
                <th>Erstzulassung</th>
                <th class="text-right">km-Stand</th>
                <th>HU bis</th>
              </tr>
            </thead>
            <tbody>
              {#each related.vehicles as v (v.id)}
                <tr
                  class="hover:bg-base-200 cursor-pointer"
                  onclick={() => goto(`/vehicles/${v.id}`)}
                >
                  <td class="font-mono text-xs font-medium"
                    >{v.licensePlate ?? '—'}</td
                  >
                  <td>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                  <td>{v.firstRegistration ?? '—'}</td>
                  <td class="text-right font-mono"
                    >{v.mileageKm != null
                      ? v.mileageKm.toLocaleString('de-DE') + ' km'
                      : '—'}</td
                  >
                  <td>{v.nextHu ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  <!-- Rechnungen des Kunden -->
  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Rechnungen</h3>
        <p class="text-base-content/60 text-sm">
          {related.invoices.length} verknüpfte
          {related.invoices.length === 1 ? 'Rechnung' : 'Rechnungen'}.
        </p>
      </div>
      {#if related.invoices.length === 0}
        <div class="text-base-content/60 px-4 py-6 text-sm">
          Bisher keine Rechnungen für diesen Kunden.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Rechnungsnr.</th>
                <th>Datum</th>
                <th>Fällig</th>
                <th class="text-right">Brutto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each related.invoices as inv (inv.id)}
                <tr
                  class="hover:bg-base-200 cursor-pointer"
                  onclick={() => goto(`/invoices/${inv.id}`)}
                >
                  <td class="font-mono text-xs font-medium"
                    >{inv.documentNumber}</td
                  >
                  <td>{inv.issueDate}</td>
                  <td>{inv.dueDate ?? '—'}</td>
                  <td class="text-right font-mono"
                    >{formatEuro(Number(inv.grossTotal))}</td
                  >
                  <td>
                    <span
                      class="badge badge-sm {documentStatusBadge(inv.status)}"
                    >
                      {documentStatusLabel(inv.status)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
