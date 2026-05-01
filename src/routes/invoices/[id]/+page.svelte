<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ArrowLeft, CheckCircle2 } from '@lucide/svelte'
  import { getInvoiceRemote, setInvoiceStatusRemote } from '../invoices.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getInvoiceRemote({ id }) : null)
  const data = $derived(q?.current)
  const loading = $derived(q?.loading ?? true)

  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })

  const markPaid = async () => {
    if (!id) return
    try {
      await setInvoiceStatusRemote({ id, status: 'paid' })
      toast.success('Rechnung als bezahlt markiert.')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title={data ? `Rechnung ${data.doc.documentNumber}` : 'Rechnung'}
  back="/invoices"
  primaryAction={data && data.doc.status !== 'paid'
    ? { label: 'Als bezahlt markieren', onClick: markPaid, icon: CheckCircle2 }
    : undefined}
/>

{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><div class="skeleton h-6 w-1/3"></div></div>
  </div>
{:else if data}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                <td class="text-right">{Number(it.quantity)} {it.unit ?? ''}</td
                >
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
          <dt class="text-base-content/60">Datum</dt><dd class="text-right"
            >{data.doc.issueDate}</dd
          >
          <dt class="text-base-content/60">Fällig</dt><dd class="text-right"
            >{data.doc.dueDate ?? '—'}</dd
          >
          <dt class="text-base-content/60">Netto</dt><dd
            class="text-right font-mono"
            >{formatEuro(Number(data.doc.netTotal))}</dd
          >
          <dt class="text-base-content/60">MwSt</dt><dd
            class="text-right font-mono"
            >{formatEuro(Number(data.doc.taxTotal))}</dd
          >
          <dt class="text-base-content/60">Rabatt</dt><dd
            class="text-right font-mono"
            >{formatEuro(Number(data.doc.discountTotal))}</dd
          >
          <dt class="font-semibold">Brutto</dt><dd
            class="text-right font-mono font-semibold"
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
  </div>
{/if}
