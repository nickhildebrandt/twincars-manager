<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Plus, Disc3 } from '@lucide/svelte'
  import { listTireStorageRemote } from './tire-storage.remote'
  import { handleClientError } from '$lib/utils/client-error'

  type Tab = 'active' | 'retrieved'
  let activeTab = $state<Tab>('active')
  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listTireStorageRemote({
      page: pageNum,
      size,
      q: q || undefined,
      active: activeTab === 'active'
    })
  )

  /** Top-level await: SSR carries the first page. */
  const initial = await untrack(() => query)

  /** Keep last result around so filter/page changes never blank the table. */
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  const seasonLabel = (season: string | null): string => {
    if (season === 'summer') return 'Sommer'
    if (season === 'winter') return 'Winter'
    if (season === 'allseason') return 'Ganzjahr'
    return '—'
  }

  const seasonBadge = (season: string | null): string => {
    if (season === 'summer') return 'badge-warning'
    if (season === 'winter') return 'badge-info'
    if (season === 'allseason') return 'badge-success'
    return 'badge-ghost'
  }

  const switchTab = (next: Tab) => {
    activeTab = next
    pageNum = 1
  }
</script>

<PageHeader
  title="Reifenlager"
  primaryAction={{
    label: 'Neuer Eintrag',
    href: '/tire-storage/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Suchen: Lagernummer, Marke, Modell, Größe, Kunde ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div role="tablist" class="tabs tabs-box mb-4 w-fit">
  <button
    type="button"
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'active'}
    onclick={() => switchTab('active')}
  >
    Aktiv
  </button>
  <button
    type="button"
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'retrieved'}
    onclick={() => switchTab('retrieved')}
  >
    Abgeholt
  </button>
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Disc3}
        title={activeTab === 'active'
          ? 'Noch keine aktiven Einlagerungen'
          : 'Noch keine abgeholten Einlagerungen'}
        description={activeTab === 'active'
          ? 'Legen Sie Ihre erste Einlagerung an.'
          : 'Sobald Reifen abgeholt werden, erscheinen sie hier.'}
      >
        {#snippet action()}
          {#if activeTab === 'active'}
            <a class="btn btn-primary btn-sm gap-2" href="/tire-storage/new">
              <Plus size={16} /> Neuer Eintrag
            </a>
          {/if}
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Lagernummer</th>
              <th>Kunde</th>
              <th>Marke / Modell</th>
              <th>Reifengröße</th>
              <th class="text-right">Profil (mm)</th>
              <th>Saison</th>
              <th>Eingelagert</th>
              {#if activeTab === 'retrieved'}
                <th>Abgeholt</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each items as e (e.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/tire-storage/${e.id}`)}
              >
                <td class="font-mono text-xs font-medium">{e.storageNumber}</td>
                <td>{e.customerLabel}</td>
                <td>{[e.brand, e.model].filter(Boolean).join(' ') || '—'}</td>
                <td>{e.size ?? '—'}</td>
                <td class="text-right font-mono"
                  >{e.profileMm != null
                    ? Number(e.profileMm).toFixed(1)
                    : '—'}</td
                >
                <td>
                  <span class="badge badge-sm {seasonBadge(e.season)}">
                    {seasonLabel(e.season)}
                  </span>
                </td>
                <td>{e.storedAt}</td>
                {#if activeTab === 'retrieved'}
                  <td>{e.retrievedAt ?? '—'}</td>
                {/if}
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
