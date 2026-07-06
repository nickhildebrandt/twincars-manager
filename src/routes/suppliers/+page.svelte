<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Truck, Pencil, Trash2 } from '@lucide/svelte'
  import { listSuppliersRemote, deleteSupplierRemote } from './suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const queryArgs = $derived({
    page: pageNum,
    size,
    ...(q ? { q } : {}),
    archived: 'active' as const
  })

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => listSuppliersRemote(queryArgs))

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // optimistic overrides never render. See src/routes/orders/+page.svelte.
  const result = $derived.by(
    () => listSuppliersRemote(queryArgs).current ?? lastResult
  )
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  $effect(() => {
    const query = listSuppliersRemote(queryArgs)
    if (query.current) lastResult = query.current
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    const { id, name } = toDelete
    try {
      await busy.run(() =>
        deleteSupplierRemote({ id }).updates(
          listSuppliersRemote(queryArgs).withOverride((current) => ({
            ...current,
            items: current.items.filter((s) => s.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Lieferant „${name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Lieferanten"
  primaryAction={{
    label: 'Neuer Lieferant',
    href: '/suppliers/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Lieferanten suchen: Firma, Ort, Kontakt ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Truck}
        title="Noch keine Lieferanten"
        description="Legen Sie Ihren ersten Lieferanten an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/suppliers/new">
            <Plus size={16} /> Neuer Lieferant
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Firma</th>
              <th>Kontakt</th>
              <th>Ort</th>
              <th>Telefon</th>
              <th>E-Mail</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as s (s.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/suppliers/${s.id}`)}
              >
                <td class="font-medium">{s.name}</td>
                <td>{s.contactPerson ?? ''}</td>
                <td>{s.city ?? ''}</td>
                <td>{s.phone ?? ''}</td>
                <td>{s.email ?? ''}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/suppliers/{s.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: s.id, name: s.name }
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
  title="Lieferant löschen?"
  message={`Soll der Lieferant "${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
