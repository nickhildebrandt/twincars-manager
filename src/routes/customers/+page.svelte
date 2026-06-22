<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Users, Pencil, Trash2 } from '@lucide/svelte'
  import { listCustomersRemote, deleteCustomerRemote } from './customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let kindFilter = $state<'all' | 'private' | 'business' | 'ebay'>('all')

  /**
   * Anchored remote query, reactive to filter/page state. The first
   * resolution is awaited inline below — that gives the SSR renderer a
   * fully populated HTML response. Subsequent param changes are observed
   * via `query.current` and `query.loading`, so the previous list stays
   * visible while the next page is loading (smooth pagination, no flicker).
   */
  const query = $derived(
    listCustomersRemote({
      page: pageNum,
      size,
      q: q || undefined,
      kind: kindFilter
    })
  )

  // Top-level await: SvelteKit suspends rendering until the initial query
  // resolves, so SSR carries the data and hydration has nothing to swap in.
  // `untrack` makes the explicit "snapshot once for SSR" intent clear —
  // subsequent param changes flow through `query.current` (see below).
  const initial = await untrack(() => query)

  // Cache the last successful result across param changes so the table
  // stays populated during a refetch instead of dropping to empty state.
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)
  const loading = $derived(query.loading)

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDeleteId = $state<string | null>(null)
  let toDeleteName = $state('')

  const askDelete = (id: string, name: string) => {
    toDeleteId = id
    toDeleteName = name
    confirmOpen = true
  }

  const performDelete = async () => {
    if (!toDeleteId) return
    const id = toDeleteId
    try {
      // Optimistic single-flight: the deleted row vanishes immediately via
      // `withOverride`; the same response carries the authoritative refresh
      // for whatever filter / page combo is currently rendered.
      await busy.run(() =>
        deleteCustomerRemote({ id }).updates(
          listCustomersRemote({
            page: pageNum,
            size,
            q: q || undefined,
            kind: kindFilter
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((c) => c.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Kunde „${toDeleteName}" gelöscht.`)
      toDeleteId = null
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht gelöscht werden')
    }
  }

  const customerLabel = (c: (typeof items)[number]) =>
    c.company ||
    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
    c.ebayHandle ||
    c.customerNumber

  const setKind = (k: typeof kindFilter) => {
    if (kindFilter === k) return
    kindFilter = k
    pageNum = 1
  }

  /** Human-readable creation date (yyyy-mm-dd) for the eBay tab. */
  const formatCreatedAt = (d: Date | string | null) => {
    if (!d) return '—'
    const date = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toISOString().slice(0, 10)
  }
</script>

<PageHeader
  title="Kunden"
  primaryAction={{ label: 'Neuer Kunde', href: '/customers/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Kunden suchen: Name, Kundennr., Ort, Telefon, eBay-Name ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <div role="tablist" class="tabs tabs-box">
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={kindFilter === 'all'}
            onclick={() => setKind('all')}
          >
            Alle
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={kindFilter === 'private'}
            onclick={() => setKind('private')}
          >
            Privat
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={kindFilter === 'business'}
            onclick={() => setKind('business')}
          >
            Firma
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={kindFilter === 'ebay'}
            onclick={() => setKind('ebay')}
          >
            eBay
          </button>
        </div>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Users}
        title="Noch keine Kunden"
        description="Legen Sie Ihren ersten Kunden an, um loszulegen."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/customers/new">
            <Plus size={16} /> Neuer Kunde
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <!--
        Desktop / tablet: full table. Hidden below `lg` to avoid
        horizontal scroll on phones and small tablets.
      -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
          <thead>
            <tr>
              <th>Kundennr.</th>
              <th>Name / Firma</th>
              {#if kindFilter === 'ebay'}
                <th>eBay-Name</th>
                <th>eingetragen am</th>
              {:else}
                <th>Ort</th>
                <th>Telefon</th>
              {/if}
              <th>E-Mail</th>
              <th class="w-32 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as c (c.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/customers/${c.id}`)}
              >
                <td class="font-mono text-xs">{c.customerNumber}</td>
                <td class="font-medium">{customerLabel(c)}</td>
                {#if kindFilter === 'ebay'}
                  <td>{c.ebayHandle ?? '—'}</td>
                  <td>{formatCreatedAt(c.createdAt)}</td>
                {:else}
                  <td>{c.city ?? ''}</td>
                  <td>{c.phone ?? ''}</td>
                {/if}
                <td>{c.email ?? ''}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/customers/{c.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      aria-label="Löschen"
                      onclick={() => askDelete(c.id, customerLabel(c))}
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
      <!--
        Phone / small tablet: stacked card list — one row per customer
        with the most important fields. The whole row is an `<a>` so the
        browser handles navigation and we get keyboard focus / Enter for
        free; the action cluster sits next to it as a sibling so its
        edit/delete buttons remain reachable independently.
      -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each items as c (c.id)}
          <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
            <a
              href={`/customers/${c.id}`}
              class="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span class="truncate text-sm font-medium">
                {customerLabel(c)}
              </span>
              <span class="text-base-content/60 truncate font-mono text-xs">
                {c.customerNumber}
              </span>
              {#if kindFilter === 'ebay'}
                <span class="text-base-content/70 mt-0.5 truncate text-xs">
                  {c.ebayHandle ?? formatCreatedAt(c.createdAt)}
                </span>
              {:else if c.city || c.phone}
                <span class="text-base-content/70 mt-0.5 truncate text-xs">
                  {[c.city, c.phone].filter(Boolean).join(' · ')}
                </span>
              {/if}
            </a>
            <div class="flex shrink-0 items-start gap-1">
              <a
                class="btn btn-ghost btn-sm btn-square"
                href="/customers/{c.id}/edit"
                aria-label="Bearbeiten"
              >
                <Pencil size={16} />
              </a>
              <button
                class="btn btn-ghost btn-sm btn-square text-error"
                aria-label="Löschen"
                onclick={() => askDelete(c.id, customerLabel(c))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
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
  title="Kunde löschen?"
  message={`Soll der Kunde "${toDeleteName}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
