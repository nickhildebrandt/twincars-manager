<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ArrowRight, FileText } from '@lucide/svelte'
  import { getOfferRemote } from '../offers.remote'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import { formatEuro } from '$lib/utils/money'
  import {
    documentStatusBadge,
    documentStatusLabel,
    documentTypeLabel
  } from '$lib/utils/status-labels'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const data = await getOfferRemote({ id })

  const isConverted = $derived(
    data.doc.status === 'converted' || !!data.doc.convertedToInvoiceId
  )
</script>

<PageHeader
  title={`${documentTypeLabel(data.doc.type)} ${data.doc.documentNumber}`}
  back="/offers"
  primaryAction={isConverted
    ? undefined
    : {
        label: 'In Rechnung umwandeln',
        href: `/offers/${id}/convert`,
        icon: ArrowRight
      }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  {#if isConverted && data.doc.convertedToInvoiceId}
    <div class="alert alert-info lg:col-span-3">
      <FileText size={20} />
      <div>
        <div class="font-medium">In Rechnung überführt</div>
        <div class="text-sm">
          Dieser Kostenvoranschlag wurde bereits in eine Rechnung umgewandelt.
        </div>
      </div>
      <a
        class="btn btn-sm gap-1"
        href={`/invoices/${data.doc.convertedToInvoiceId}`}
      >
        Zur Rechnung
        <ArrowRight size={14} />
      </a>
    </div>
  {/if}

  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <table class="table-zebra table">
        <thead>
          <tr>
            <th>#</th>
            <th>Beschreibung</th>
            <th class="text-right">Menge</th>
            <th class="text-right">Einzelpreis</th>
            <th class="text-right">MwSt</th>
            <th class="text-right">Brutto</th>
          </tr>
        </thead>
        <tbody>
          {#each data.items as it (it.id)}
            <tr>
              <td>{it.positionNumber}</td>
              <td>{it.description}</td>
              <td class="text-right">{Number(it.quantity)} {it.unit ?? ''}</td>
              <td class="text-right font-mono"
                >{formatEuro(Number(it.unitPriceNet))}</td
              >
              <td class="text-right">{Number(it.taxRate)} %</td>
              <td class="text-right font-mono"
                >{formatEuro(Number(it.lineTotalGross))}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Summen</h3>
      <dl class="grid grid-cols-2 gap-y-1 text-sm">
        <dt class="text-base-content/60">Status</dt>
        <dd class="text-right">
          <span class="badge badge-sm {documentStatusBadge(data.doc.status)}">
            {documentStatusLabel(data.doc.status)}
          </span>
        </dd>
        <dt class="text-base-content/60">Datum</dt>
        <dd class="text-right">{data.doc.issueDate}</dd>
        <dt class="text-base-content/60">Gültig bis</dt>
        <dd class="text-right">{data.doc.dueDate ?? '—'}</dd>
        <dt class="text-base-content/60">Netto</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.netTotal))}</dd
        >
        <dt class="text-base-content/60">MwSt</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.taxTotal))}</dd
        >
        <dt class="text-base-content/60">Rabatt</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.discountTotal))}</dd
        >
        <dt class="font-semibold">Brutto</dt>
        <dd class="text-right font-mono font-semibold"
          >{formatEuro(Number(data.doc.grossTotal))}</dd
        >
      </dl>
    </div>
  </div>

  {#if data.doc.footer}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body">
        <h3 class="card-title text-base">Endtext</h3>
        <p class="text-sm whitespace-pre-line">{data.doc.footer}</p>
      </div>
    </div>
  {/if}

  <div class="lg:col-span-3">
    <PdfViewer documentId={data.doc.id} />
  </div>
</div>
