<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { replaceState } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import {
    Store,
    Link2,
    Unlink,
    CircleCheck,
    CircleAlert,
    CloudDownload,
    PackageSearch,
    Search
  } from '@lucide/svelte'
  import {
    getEbayStatusRemote,
    startEbayConnectRemote,
    disconnectEbayRemote,
    getEbayImportInfoRemote,
    importEbayListingsRemote,
    listEbayListingsRemote
  } from './ebay.remote'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'

  const query = getEbayStatusRemote()
  const initial = await query
  const status = $derived(query.current ?? initial)

  // Round-trip result from the OAuth callback redirect
  // (?connected=1 | ?error=declined|state|exchange).
  //
  // Deliberately deferred + read from window.location, NOT from
  // `$app/state`'s `page.url` and NOT via afterNavigate: async pages
  // (top-level await) currently fail hydration app-wide and recover
  // by client re-rendering — reading `page.url` at init makes it
  // worse, and afterNavigate callbacks registered by the recovered
  // component never fire (the initial navigation is already over).
  // A deferred onMount handler runs in BOTH worlds: after clean
  // hydration and after a hydration-recovery re-mount, when the
  // router is initialised so replaceState is safe.
  onMount(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const flag = params.has('connected') ? 'connected' : params.get('error')
      if (!flag) return
      if (flag === 'connected') {
        toast.success('eBay-Konto erfolgreich verbunden.')
      } else if (flag === 'declined') {
        toast.error('Die Verbindung wurde bei eBay abgelehnt.')
      } else if (flag === 'state') {
        toast.error(
          'Die Anfrage war abgelaufen oder ungültig. Bitte erneut verbinden.'
        )
      } else {
        toast.error('Der Token-Austausch mit eBay ist fehlgeschlagen.')
      }
      // Strip the flag so a reload doesn't re-toast.
      replaceState('/settings/ebay', {})
    }, 150)
    return () => clearTimeout(timer)
  })

  let confirmOpen = $state(false)

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleString('de-DE') : '-'

  const connect = async () => {
    try {
      const { url } = await busy.run(() => startEbayConnectRemote())
      window.location.href = url
    } catch (err) {
      handleClientError(err, 'Verbindung konnte nicht gestartet werden')
    }
  }

  const disconnect = async () => {
    try {
      await busy.run(() => disconnectEbayRemote())
      toast.success('eBay-Verbindung getrennt.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /* ── Phase 2: listing import ─────────────────────────────────── */

  const infoQuery = getEbayImportInfoRemote()
  const infoInitial = await infoQuery
  const importInfo = $derived(infoQuery.current ?? infoInitial)

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')
  let statusFilter = $state<'all' | 'active' | 'ended'>('all')
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const queryArgs = $derived({
    page: pageNum,
    size,
    ...(q ? { q } : {}),
    ...(statusFilter === 'all' ? {} : { status: statusFilter })
  })

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const listInitial = await untrack(() => listEbayListingsRemote(queryArgs))

  /** Cache last successful result so paginating doesn't flash empty. */
  let lastResult = $state<typeof listInitial>(listInitial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init.
  const listResult = $derived.by(
    () => listEbayListingsRemote(queryArgs).current ?? lastResult
  )
  const listings = $derived(listResult.items)
  const total = $derived(listResult.total)
  const pageCount = $derived(listResult.pageCount)

  $effect(() => {
    const listQuery = listEbayListingsRemote(queryArgs)
    if (listQuery.current) lastResult = listQuery.current
    if (listQuery.error) handleClientError(listQuery.error)
  })

  const onSearchInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      q = value
      pageNum = 1
    }, 250)
  }

  const runImport = async () => {
    try {
      const r = await busy.run(() => importEbayListingsRemote())
      const parts = [
        `${r.imported} neu`,
        `${r.updated} aktualisiert`,
        `${r.ended} beendet`
      ]
      if (r.failed > 0) parts.push(`${r.failed} übersprungen`)
      toast.success(`Import abgeschlossen: ${parts.join(', ')}.`)
    } catch (err) {
      handleClientError(err, 'Der Angebots-Import ist fehlgeschlagen')
    }
  }

  const fmtPrice = (value: string | null, currency: string | null) => {
    if (value == null) return '-'
    try {
      return Number(value).toLocaleString('de-DE', {
        style: 'currency',
        currency: currency ?? 'EUR'
      })
    } catch {
      return `${value} ${currency ?? ''}`.trim()
    }
  }

  const openListing = (url: string | null) => {
    if (url) window.open(url, '_blank', 'noopener')
  }
</script>

<PageHeader title="eBay-Verbindung" back="/settings" />

<div class="grid grid-cols-1 gap-4">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex items-center gap-2">
        <Store size={22} class="text-primary" />
        <h3 class="card-title text-base">eBay-Verkäuferkonto</h3>
        {#if status.environment === 'sandbox'}
          <span class="badge badge-warning badge-sm">Sandbox</span>
        {/if}
      </div>

      {#if !status.configured}
        <div class="alert alert-warning text-sm" role="alert">
          <CircleAlert size={16} />
          <span>
            Die eBay-Anbindung ist serverseitig noch nicht vollständig
            konfiguriert. Fehlende Umgebungsvariablen:
            <span class="font-mono">{status.missingConfig.join(', ')}</span>.
            Werte stammen aus dem eBay-Developer-Portal (Application Keys / User
            Tokens) und gehören in die Server-Konfiguration.
          </span>
        </div>
      {:else if status.connected}
        <div class="alert alert-success text-sm" role="status">
          <CircleCheck size={16} />
          <span>
            Verbunden{#if status.ebayUsername}
              als <strong>{status.ebayUsername}</strong>{/if} seit
            {fmt(status.connectedAt)}.
          </span>
        </div>
        <dl
          class="text-base-content/80 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]"
        >
          <dt class="text-base-content/50">Access-Token gültig bis</dt>
          <dd>{fmt(status.accessTokenExpiresAt)} (wird automatisch erneuert)</dd
          >
          <dt class="text-base-content/50">Verbindung läuft ab</dt>
          <dd>{fmt(status.refreshTokenExpiresAt)}</dd>
        </dl>
        <div class="card-actions justify-end">
          <button
            type="button"
            class="btn btn-ghost text-error gap-2"
            onclick={() => (confirmOpen = true)}
            disabled={busy.active}
          >
            <Unlink size={16} /> Verbindung trennen
          </button>
        </div>
      {:else}
        <p class="text-base-content/70 text-sm">
          Verbinden Sie das eBay-Verkäuferkonto der Werkstatt, um den
          Reifenbestand mit eBay zu synchronisieren. Sie werden zu eBay
          weitergeleitet und melden sich dort mit dem Verkäuferkonto an.
        </p>
        <div class="card-actions justify-end">
          <button
            type="button"
            class="btn btn-primary gap-2"
            onclick={connect}
            disabled={busy.active}
          >
            {#if busy.active}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            <Link2 size={16} /> Mit eBay verbinden
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Phase 2: import of the account's active listings -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <PackageSearch size={22} class="text-primary" />
        <h3 class="card-title text-base">eBay-Angebote</h3>
        {#if importInfo.listingCount > 0}
          <span class="badge badge-ghost badge-sm">
            {importInfo.activeCount} aktiv / {importInfo.listingCount} gesamt
          </span>
        {/if}
      </div>

      <p class="text-base-content/70 text-sm">
        Importiert die aktiven Angebote des verbundenen Verkäuferkontos in die
        Verwaltung. Ein erneuter Import aktualisiert vorhandene Angebote; nicht
        mehr aktive Angebote werden als „Beendet" markiert.
      </p>

      {#if !status.connected}
        <div class="alert text-sm" role="note">
          <CircleAlert size={16} />
          <span>
            Noch kein eBay-Konto verbunden — der Import setzt eine bestehende
            Verbindung voraus.
          </span>
        </div>
      {/if}

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-base-content/70 text-sm" data-testid="last-import">
          {#if !importInfo.lastRun}
            Noch kein Import durchgeführt.
          {:else if importInfo.lastRun.status === 'failed'}
            <span class="text-error">
              Letzter Import am {fmt(
                importInfo.lastRun.finishedAt ?? importInfo.lastRun.startedAt
              )} fehlgeschlagen{#if importInfo.lastRun.error}:
                {importInfo.lastRun.error}{/if}
            </span>
          {:else}
            Letzter Import: {fmt(
              importInfo.lastRun.finishedAt ?? importInfo.lastRun.startedAt
            )} – {importInfo.lastRun.imported} neu,
            {importInfo.lastRun.updated} aktualisiert,
            {importInfo.lastRun.ended} beendet{#if importInfo.lastRun.failed > 0},
              {importInfo.lastRun.failed} übersprungen{/if}.
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-primary gap-2"
          onclick={runImport}
          disabled={busy.active}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          <CloudDownload size={16} /> Angebote importieren
        </button>
      </div>
    </div>
  </div>

  <!-- Imported listings (paginated, server-side) -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3 pb-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="card-title text-base">Importierte Angebote</h3>
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <label
            class="input input-bordered input-sm flex items-center gap-2 sm:min-w-[14rem]"
          >
            <Search size={14} class="opacity-60" />
            <input
              type="search"
              class="grow"
              placeholder="Titel, SKU, Artikelnr. …"
              oninput={onSearchInput}
              maxlength="200"
              aria-label="Angebote durchsuchen"
            />
          </label>
          <select
            class="select select-sm select-bordered"
            bind:value={statusFilter}
            onchange={() => (pageNum = 1)}
            aria-label="Status filtern"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="ended">Beendet</option>
          </select>
        </div>
      </div>
    </div>
    {#if listings.length === 0}
      <EmptyState
        icon={PackageSearch}
        title={q || statusFilter !== 'all'
          ? 'Keine Angebote gefunden'
          : 'Noch keine Angebote importiert'}
        description={q || statusFilter !== 'all'
          ? 'Für die aktuelle Suche bzw. den Filter gibt es keine Treffer.'
          : 'Nach dem Verbinden des Verkäuferkontos können die aktiven Angebote importiert werden.'}
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Angebot</th>
              <th>eBay-Artikelnr.</th>
              <th class="text-right">Preis</th>
              <th class="text-right">Verfügbar</th>
              <th class="text-right">Verkauft</th>
              <th>Status</th>
              <th>Läuft bis</th>
            </tr>
          </thead>
          <tbody>
            {#each listings as l (l.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => openListing(l.viewItemUrl)}
              >
                <td>
                  <div class="flex items-center gap-3">
                    {#if l.galleryUrl}
                      <img
                        src={l.galleryUrl}
                        alt=""
                        class="h-10 w-10 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                    {/if}
                    <div class="min-w-0">
                      <div class="max-w-md truncate font-medium">{l.title}</div>
                      {#if l.sku}
                        <div class="text-base-content/60 font-mono text-xs">
                          SKU {l.sku}
                        </div>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="font-mono text-xs">{l.ebayItemId}</td>
                <td class="text-right font-mono">
                  {fmtPrice(l.priceValue, l.priceCurrency)}
                </td>
                <td class="text-right">{l.quantityAvailable ?? '-'}</td>
                <td class="text-right">{l.quantitySold ?? '-'}</td>
                <td>
                  {#if l.status === 'active'}
                    <span class="badge badge-success badge-sm">Aktiv</span>
                  {:else}
                    <span class="badge badge-ghost badge-sm">Beendet</span>
                  {/if}
                </td>
                <td class="text-base-content/70 text-sm">{fmt(l.endTime)}</td>
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
  title="eBay-Verbindung trennen?"
  message="Die gespeicherten Zugriffstoken werden gelöscht. Die Synchronisation stoppt, bis das Konto erneut verbunden wird."
  confirmLabel="Trennen"
  variant="danger"
  onConfirm={disconnect}
  onClose={() => (confirmOpen = false)}
/>
