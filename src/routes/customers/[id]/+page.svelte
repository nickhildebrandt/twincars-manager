<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getCustomerRemote } from '../customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { Pencil, ArrowLeft } from '@lucide/svelte'

  const id = $derived($page.params.id ?? '')
  const customerQ = $derived(id ? getCustomerRemote({ id }) : null)
  const customer = $derived(customerQ?.current)
  const loading = $derived(customerQ?.loading ?? true)

  $effect(() => {
    if (customerQ?.error) handleClientError(customerQ.error)
  })

  const labelOf = () => {
    if (!customer) return ''
    return (
      customer.company ||
      `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
      customer.customerNumber
    )
  }
</script>

<PageHeader
  title={loading ? 'Lädt …' : labelOf()}
  back="/customers"
  primaryAction={customer
    ? {
        label: 'Bearbeiten',
        href: `/customers/${customer.id}/edit`,
        icon: Pencil
      }
    : undefined}
/>

{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <div class="skeleton h-6 w-1/3"></div>
      <div class="skeleton mt-3 h-4 w-2/3"></div>
      <div class="skeleton mt-2 h-4 w-1/2"></div>
    </div>
  </div>
{:else if customer}
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
  </div>
{/if}
