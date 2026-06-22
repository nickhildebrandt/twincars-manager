<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { goto } from '$app/navigation'
  import {
    Plus,
    Calculator,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Trash2,
    TrendingUp,
    TrendingDown,
    Wallet
  } from '@lucide/svelte'
  import {
    listLedgerEntriesRemote,
    deleteLedgerEntryRemote
  } from './ledger.remote'
  import { exportDatevRemote } from './datev.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { downloadBase64File } from '$lib/utils/pdf-download'
  import { FileDown } from '@lucide/svelte'
  import {
    paymentStatusBadge,
    paymentStatusLabel
  } from '$lib/utils/status-labels'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let direction = $state<'all' | 'income' | 'expense'>('all')

  /**
   * Monatsfilter — analog zum Kalender. State sind year + month (1..12);
   * der Server sieht zwei ISO-Strings für `from` und `to`. Wechsel
   * setzt `pageNum=1` zurück, damit Pagination + Monatsfilter
   * konsistent bleiben.
   */
  const today = new Date()
  let viewYear = $state(today.getFullYear())
  let viewMonth = $state(today.getMonth() + 1) // 1..12
  const monthLabels = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember'
  ]
  const monthLabel = (m: number) => monthLabels[m - 1] ?? String(m)
  const fromIso = $derived(
    `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
  )
  const toIso = $derived.by(() => {
    const last = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  })
  const isCurrentMonth = $derived(
    viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1
  )
  const prevMonth = () => {
    pageNum = 1
    if (viewMonth === 1) {
      viewMonth = 12
      viewYear -= 1
    } else viewMonth -= 1
  }
  const nextMonth = () => {
    pageNum = 1
    if (viewMonth === 12) {
      viewMonth = 1
      viewYear += 1
    } else viewMonth += 1
  }
  const goToday = () => {
    pageNum = 1
    viewYear = today.getFullYear()
    viewMonth = today.getMonth() + 1
  }

  const query = $derived(
    listLedgerEntriesRemote({
      page: pageNum,
      size,
      q: q || undefined,
      direction,
      from: fromIso,
      to: toIso
    })
  )

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => query)

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)
  const incomeSum = $derived(
    (result as unknown as { incomeSum?: number })?.incomeSum ?? 0
  )
  const expenseSum = $derived(
    (result as unknown as { expenseSum?: number })?.expenseSum ?? 0
  )
  const loading = $derived(query.loading)

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; desc: string } | null>(null)

  /**
   * DATEV-Export-Modal. Default range = aktuelles Quartal (lehnt sich an
   * den Steuer-Quartals-Rhythmus an, in dem die meisten Kfz-Betriebe
   * ihre Buchhaltung übergeben).
   */
  const currentQuarter = $derived.by(() => {
    const q = Math.floor((today.getMonth() / 3) | 0) + 1
    const fromMonth = (q - 1) * 3 + 1
    const toMonth = q * 3
    const y = today.getFullYear()
    const fromIso = `${y}-${String(fromMonth).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(y, toMonth, 0)).getUTCDate()
    const toIso = `${y}-${String(toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from: fromIso, to: toIso }
  })
  let datevOpen = $state(false)
  // Initial values default to the current quarter; the user can edit them
  // freely in the modal before exporting.
  let datevFrom = $state('')
  let datevTo = $state('')
  const openDatev = () => {
    const q = currentQuarter
    datevFrom = q.from
    datevTo = q.to
    datevOpen = true
  }
  const runDatevExport = async () => {
    try {
      const res = await busy.run(() =>
        exportDatevRemote({ from: datevFrom, to: datevTo })
      )
      downloadBase64File(res)
      toast.success('DATEV-Export heruntergeladen.')
      datevOpen = false
    } catch (err) {
      handleClientError(err, 'DATEV-Export')
    }
  }

  const remove = async () => {
    if (!toDelete) return
    const { id } = toDelete
    try {
      await busy.run(() =>
        deleteLedgerEntryRemote({ id }).updates(
          listLedgerEntriesRemote({
            page: pageNum,
            size,
            q: q || undefined,
            direction,
            from: fromIso,
            to: toIso
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((e) => e.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Buchung gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Buchhaltung"
  primaryAction={{
    label: 'Neue Buchung',
    href: `/ledger/new?date=${isCurrentMonth ? new Date().toISOString().slice(0, 10) : fromIso}`,
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Buchungen suchen: Beschreibung, Belegnummer ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered w-full"
          bind:value={direction}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle</option>
          <option value="income">Einnahmen</option>
          <option value="expense">Ausgaben</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<!--
  Monatsauswahl direkt unter Suche/Toolbar — gleicher Pattern wie der
  Kalender. Vergangene und zukünftige Monate sind editierbar; die
  Liste filtert serverseitig nach dem aktuell gewählten Monat.
-->
<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body flex flex-row items-center gap-2 p-3">
    <div class="join">
      <button
        class="btn btn-sm join-item"
        onclick={prevMonth}
        aria-label="Voriger Monat"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        class="btn btn-sm join-item"
        onclick={goToday}
        disabled={isCurrentMonth}
      >
        Heute
      </button>
      <button
        class="btn btn-sm join-item"
        onclick={nextMonth}
        aria-label="Nächster Monat"
      >
        <ChevronRight size={14} />
      </button>
    </div>
    <h2 class="ms-auto text-lg font-semibold">
      {monthLabel(viewMonth)}
      {viewYear}
    </h2>
    <button
      type="button"
      class="btn btn-sm btn-ghost gap-2"
      onclick={openDatev}
      disabled={busy.active}
    >
      <FileDown size={14} />
      DATEV-Export
    </button>
  </div>
</div>

<!-- Statuskarten zeigen die Summen für den aktuell gewählten Monat. -->
<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
  <StatCard
    title="Einnahmen (gefiltert)"
    value={formatEuro(incomeSum)}
    icon={TrendingUp}
    color="success"
  />
  <StatCard
    title="Ausgaben (gefiltert)"
    value={formatEuro(expenseSum)}
    icon={TrendingDown}
    color="error"
  />
  <StatCard
    title="Saldo"
    value={formatEuro(incomeSum - expenseSum)}
    icon={Wallet}
    color={incomeSum - expenseSum >= 0 ? 'success' : 'error'}
  />
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <!-- Kein expliziter Action-Button — der „Neue Buchung"-Knopf
           lebt im PageHeader und ist immer erreichbar. -->
      <EmptyState
        icon={Calculator}
        title="Noch keine Buchungen"
        description="Für den ausgewählten Monat liegen keine Ein- oder Ausgaben vor."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Beleg-Nr.</th>
              <th>Beschreibung</th>
              <th>Quelle</th>
              <th class="text-right">Betrag</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as e (e.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/ledger/${e.id}/edit`)}
              >
                <td>{e.entryDate}</td>
                <td class="font-mono text-xs">{e.entryNumber ?? ''}</td>
                <td>{e.description}</td>
                <td>
                  <span class="badge badge-ghost badge-sm">
                    {e.source === 'manual' ? 'manuell' : e.source}
                  </span>
                </td>
                <td class="text-right font-mono">
                  <span
                    class:text-success={e.direction === 'income'}
                    class:text-error={e.direction === 'expense'}
                  >
                    {e.direction === 'income' ? '+' : '−'}{formatEuro(
                      Number(e.amountGross)
                    )}
                  </span>
                </td>
                <td>
                  <span
                    class="badge badge-sm {paymentStatusBadge(e.paymentStatus)}"
                  >
                    {paymentStatusLabel(e.paymentStatus)}
                  </span>
                </td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href={`/ledger/${e.id}/edit`}
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: e.id, desc: e.description }
                        confirmOpen = true
                      }}
                      aria-label="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <Pagination
        {total}
        page={pageNum}
        {pageCount}
        {size}
        onPage={(p) => (pageNum = p)}
      />
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Buchung löschen?"
  message={`Soll die Buchung "${toDelete?.desc ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>

<!--
  DATEV-Export-Dialog. Zeitraum-Auswahl mit zwei Date-Inputs. Defaults
  ergeben das aktuelle Kalenderquartal — der typische Übergabe-Rhythmus
  Richtung Steuerberater. Der eigentliche Export geschieht über die
  Remote, die das CSV als base64 zurückliefert; downloadBase64File
  triggert dann den Browser-Download.
-->
{#if datevOpen}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-semibold">DATEV-Export</h3>
      <p class="text-base-content/80 py-3 text-sm">
        Exportiert Rechnungen + Buchungen des gewählten Zeitraums als
        DATEV-Buchungsstapel-CSV (Format 7.0, CP1252).
      </p>
      <div class="grid grid-cols-2 gap-3">
        <label class="form-control">
          <span class="label-text mb-1 text-sm">Von</span>
          <input
            type="date"
            class="input input-bordered input-sm"
            bind:value={datevFrom}
          />
        </label>
        <label class="form-control">
          <span class="label-text mb-1 text-sm">Bis</span>
          <input
            type="date"
            class="input input-bordered input-sm"
            bind:value={datevTo}
          />
        </label>
      </div>
      <div class="modal-action">
        <button
          class="btn btn-ghost"
          onclick={() => (datevOpen = false)}
          disabled={busy.active}
        >
          Abbrechen
        </button>
        <button
          class="btn btn-primary"
          onclick={runDatevExport}
          disabled={busy.active}
        >
          Export starten
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={() => (datevOpen = false)}
    ></button>
  </dialog>
{/if}
