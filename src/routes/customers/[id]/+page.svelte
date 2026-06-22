<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    getCustomerRemote,
    getCustomerRelatedRemote,
    sendAdHocCustomerEmailRemote
  } from '../customers.remote'
  import { Mail, Pencil } from '@lucide/svelte'
  import {
    documentStatusBadge,
    documentStatusLabel
  } from '$lib/utils/status-labels'
  import { formatEuro } from '$lib/utils/money'
  import EmailComposer, {
    type ComposerAttachment
  } from '$lib/components/ui/EmailComposer.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'

  const id = untrack(() => page.params.id!)

  /**
   * SSR-friendly parallel load. The customer record + related vehicles
   * and invoices ship in one server round-trip.
   */
  const [customer, related] = await Promise.all([
    getCustomerRemote({ id }),
    getCustomerRelatedRemote({ id })
  ])

  const isEbay = customer.kind === 'ebay'

  const labelOf = () =>
    customer.company ||
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
    customer.ebayHandle ||
    customer.customerNumber

  const yesNo = (v: boolean) => (v ? 'Ja' : 'Nein')

  /**
   * E-Mail-Composer-Dialog. Schreibt eine freie Nachricht an den
   * Kunden — mit optionalen Anhängen. Versand geht über
   * `sendAdHocCustomerEmailRemote`; der Server protokolliert eine
   * Zeile in `sent_messages`.
   */
  let emailOpen = $state(false)
  let emailSubject = $state('')
  let emailBody = $state('')
  let emailAsHtml = $state(false)
  let emailAttachments = $state<ComposerAttachment[]>([])

  const recipientLabel = $derived.by(() => {
    const name =
      customer.company ||
      `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
      customer.ebayHandle ||
      ''
    if (customer.email) {
      return name ? `${name} <${customer.email}>` : customer.email
    }
    return name || '—'
  })

  const canSend = $derived(
    !!customer.email &&
      emailSubject.trim().length > 0 &&
      emailBody.trim().length > 0
  )

  const openEmailDialog = () => {
    emailSubject = ''
    emailBody = ''
    emailAsHtml = false
    emailAttachments = []
    emailOpen = true
  }
  const closeEmailDialog = () => {
    emailOpen = false
  }

  const sendEmail = async () => {
    if (!customer.email) return
    try {
      await busy.run(() =>
        sendAdHocCustomerEmailRemote({
          customerId: customer.id,
          subject: emailSubject.trim(),
          body: emailBody,
          asHtml: emailAsHtml,
          attachments: emailAttachments.map((a) => ({
            filename: a.filename,
            mime: a.mime,
            base64Data: a.base64Data
          }))
        })
      )
      toast.success('E-Mail versendet.')
      closeEmailDialog()
    } catch (err) {
      handleClientError(err, 'E-Mail konnte nicht versendet werden')
    }
  }
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

<div class="mb-4 flex flex-wrap gap-2">
  <button
    type="button"
    class="btn btn-sm gap-2"
    onclick={openEmailDialog}
    disabled={!customer.email}
    title={customer.email
      ? 'E-Mail an diesen Kunden schreiben'
      : 'Keine E-Mail-Adresse hinterlegt'}
  >
    <Mail size={14} />
    E-Mail schreiben
  </button>
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  {#if isEbay}
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">eBay-Kunde</h3>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Kundennr.</dt>
          <dd class="font-mono text-xs break-all sm:col-span-2">
            {customer.customerNumber}
          </dd>
          <dt class="text-base-content/60">eBay-Name</dt>
          <dd class="break-words sm:col-span-2">{customer.ebayHandle ?? '—'}</dd
          >
          <dt class="text-base-content/60">Name</dt>
          <dd class="break-words sm:col-span-2">
            {[customer.firstName, customer.lastName]
              .filter(Boolean)
              .join(' ') || '—'}
          </dd>
          <dt class="text-base-content/60">Newsletter</dt>
          <dd class="sm:col-span-2">{yesNo(customer.wantsBroadcast)}</dd>
          <dt class="text-base-content/60">Reifenwechsel-Erinnerung</dt>
          <dd class="sm:col-span-2">{yesNo(customer.wantsTireReminders)}</dd>
        </dl>
      </div>
    </div>
  {:else}
    <div class="card border-base-300 bg-base-100 min-w-0 border">
      <div class="card-body">
        <h3 class="card-title text-base">Anschrift</h3>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Firma</dt>
          <dd class="break-words sm:col-span-2">{customer.company ?? '—'}</dd>
          <dt class="text-base-content/60">Name</dt>
          <dd class="break-words sm:col-span-2">
            {[customer.salutation, customer.firstName, customer.lastName]
              .filter(Boolean)
              .join(' ') || '—'}
          </dd>
          <dt class="text-base-content/60">Straße</dt>
          <dd class="break-words sm:col-span-2">{customer.street ?? '—'}</dd>
          <dt class="text-base-content/60">PLZ / Ort</dt>
          <dd class="break-words sm:col-span-2">
            {[customer.zip, customer.city].filter(Boolean).join(' ') || '—'}
          </dd>
        </dl>
      </div>
    </div>

    <div class="card border-base-300 bg-base-100 min-w-0 border">
      <div class="card-body">
        <h3 class="card-title text-base">Kontakt</h3>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Telefon</dt>
          <dd class="break-all sm:col-span-2">{customer.phone ?? '—'}</dd>
          <dt class="text-base-content/60">Mobil</dt>
          <dd class="break-all sm:col-span-2">{customer.mobile ?? '—'}</dd>
          <dt class="text-base-content/60">E-Mail</dt>
          <dd class="break-all sm:col-span-2">{customer.email ?? '—'}</dd>
          <dt class="text-base-content/60">Website</dt>
          <dd class="break-all sm:col-span-2">{customer.website ?? '—'}</dd>
          <dt class="text-base-content/60">Newsletter</dt>
          <dd class="sm:col-span-2">{yesNo(customer.wantsBroadcast)}</dd>
          <dt class="text-base-content/60">Reifenwechsel-Erinnerung</dt>
          <dd class="sm:col-span-2">{yesNo(customer.wantsTireReminders)}</dd>
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

  <!-- Rechnungen des Kunden (Email-Dialog folgt am Seitenende) -->
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

{#if emailOpen}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-semibold">E-Mail schreiben</h3>

      <div class="mt-3 mb-3 text-sm">
        <div class="flex items-baseline gap-2">
          <span class="text-base-content/60 w-16 shrink-0">An</span>
          <span class="font-medium">{recipientLabel}</span>
        </div>
      </div>

      {#if !customer.email}
        <div class="alert alert-warning text-sm">
          <span>Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.</span>
        </div>
      {:else}
        <EmailComposer
          bind:subject={emailSubject}
          bind:body={emailBody}
          bind:attachments={emailAttachments}
          bind:asHtml={emailAsHtml}
          allowHtml
        />
      {/if}

      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={closeEmailDialog}
          disabled={busy.active}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={sendEmail}
          disabled={!canSend || busy.active}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Senden
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={closeEmailDialog}
    ></button>
  </div>
{/if}
