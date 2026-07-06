<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Users2, Pencil, Trash2 } from '@lucide/svelte'
  import { listEmployeesRemote, deleteEmployeeRemote } from './employees.remote'
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
  const initial = await untrack(() => listEmployeesRemote(queryArgs))

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // optimistic overrides never render. See src/routes/orders/+page.svelte.
  const result = $derived.by(
    () => listEmployeesRemote(queryArgs).current ?? lastResult
  )
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  $effect(() => {
    const query = listEmployeesRemote(queryArgs)
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
        deleteEmployeeRemote({ id }).updates(
          listEmployeesRemote(queryArgs).withOverride((current) => ({
            ...current,
            items: current.items.filter((e) => e.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Mitarbeiter „${name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Mitarbeiter"
  primaryAction={{
    label: 'Neuer Mitarbeiter',
    href: '/employees/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Mitarbeiter suchen: Name, Personalnr., Position ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Users2}
        title="Noch keine Mitarbeiter"
        description="Legen Sie den ersten Mitarbeiter an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/employees/new">
            <Plus size={16} /> Neuer Mitarbeiter
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Personalnr.</th>
              <th>Name</th>
              <th>Position</th>
              <th>Abteilung</th>
              <th>Eintritt</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as e (e.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/employees/${e.id}`)}
              >
                <td class="font-mono text-xs">{e.personnelNumber}</td>
                <td class="font-medium">{`${e.firstName} ${e.lastName}`}</td>
                <td>{e.position ?? ''}</td>
                <td>{e.department ?? ''}</td>
                <td>{e.hireDate ?? ''}</td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/employees/{e.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = {
                          id: e.id,
                          name: `${e.firstName} ${e.lastName}`
                        }
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
  title="Mitarbeiter löschen?"
  message={`Soll der Mitarbeiter "${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
