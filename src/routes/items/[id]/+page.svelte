<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import { getItemPriceHistoryRemote, getItemRemote } from '../items.remote'
  import { getArticleLabelPdfRemote } from '../labels.remote'
  import { Pencil, QrCode } from '@lucide/svelte'
  import { formatEuro } from '$lib/utils/money'
  import { itemKindLabel } from '$lib/utils/status-labels'
  import { busy } from '$lib/stores/busy.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { openPdfInNewTab } from '$lib/utils/pdf-download'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const i = await getItemRemote({ id })

  let pageNum = $state(1)
  const size = 25

  const historyQ = $derived(
    getItemPriceHistoryRemote({ id, page: pageNum, size })
  )
  const initialHistory = await untrack(() => historyQ)
  let lastResult = $state<typeof initialHistory>(initialHistory)
  $effect(() => {
    if (historyQ.current) lastResult = historyQ.current
  })
  const history = $derived(historyQ.current ?? lastResult)

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  /**
   * Fetch the QR-Etikett-PDF (base64) and open it in a new tab via a
   * `blob:` URL. We deliberately don't trigger an automatic download
   * — opening in a tab lets the user preview, then print or save
   * from the browser's PDF viewer.
   */
  const printLabel = async () => {
    try {
      const res = await busy.run(() => getArticleLabelPdfRemote({ id }).run())
      openPdfInNewTab(res)
    } catch (err) {
      handleClientError(err, 'QR-Etikett konnte nicht erzeugt werden')
    }
  }
</script>

<PageHeader
  title={i.description}
  back="/items"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/items/${i.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
    <div
      class="card-body flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0">
        <h3 class="card-title text-base">Artikelnummer</h3>
        <p class="font-mono text-lg break-all">{i.articleNumber}</p>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline gap-2 sm:w-auto"
        disabled={busy.active}
        onclick={printLabel}
      >
        <QrCode size={16} />
        QR-Etikett drucken
      </button>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Stammdaten</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Typ</dt><dd class="sm:col-span-2"
          >{itemKindLabel(i.kind)}</dd
        >
        <dt class="text-base-content/60">Einheit</dt><dd class="sm:col-span-2"
          >{i.unit ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Preise & Lager</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">VK netto</dt><dd
          class="font-mono sm:col-span-2"
          >{formatEuro(Number(i.unitPriceNet ?? 0))}</dd
        >
        <dt class="text-base-content/60">EK netto</dt><dd
          class="font-mono sm:col-span-2"
          >{i.purchasePriceNet
            ? formatEuro(Number(i.purchasePriceNet))
            : '—'}</dd
        >
        <dt class="text-base-content/60">Bestand</dt><dd class="sm:col-span-2"
          >{i.stockOnHand}</dd
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

  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <div class="p-4 pb-2">
        <h3 class="card-title text-base">Preisverlauf</h3>
        <p class="text-base-content/60 text-sm">
          Versionierte Stammpreise — Belegpositionen behalten ihren damals
          verwendeten Preis unabhängig davon.
        </p>
      </div>
      {#if history.items.length > 0}
        <div class="overflow-x-auto">
          <table class="table-sm table">
            <thead>
              <tr>
                <th>Gültig ab</th>
                <th class="text-right">Einzelpreis netto</th>
                <th>Erfasst</th>
              </tr>
            </thead>
            <tbody>
              {#each history.items as row (row.id)}
                <tr>
                  <td>{fmtDate(row.validFrom)}</td>
                  <td class="text-right font-mono"
                    >{formatEuro(Number(row.unitPriceNet))}</td
                  >
                  <td class="text-base-content/60"
                    >{fmtDate(
                      typeof row.createdAt === 'string'
                        ? row.createdAt
                        : row.createdAt.toISOString()
                    )}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <Pagination
          page={history.page}
          pageCount={history.pageCount}
          total={history.total}
          onPage={(p) => (pageNum = p)}
        />
      {:else}
        <p class="text-base-content/60 px-4 pb-4 text-sm">
          Noch keine Preisversionen erfasst.
        </p>
      {/if}
    </div>
  </div>
</div>
