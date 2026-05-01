<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Users2, Pencil, Trash2 } from '@lucide/svelte'
  import { listEmployeesRemote, deleteEmployeeRemote } from './employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let page = $state(1)
  let size = $state<10 | 25 | 50 | 100>(25)
  let q = $state('')

  const eQ = $derived(
    listEmployeesRemote({ page, size, q: q || undefined, archived: 'active' })
  )
  const items = $derived(eQ.current?.items ?? [])
  const total = $derived(eQ.current?.total ?? 0)
  const pageCount = $derived(eQ.current?.pageCount ?? 1)
  const loading = $derived(eQ.loading)

  $effect(() => {
    if (eQ.error) handleClientError(eQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteEmployeeRemote({ id: toDelete.id })
      toast.success(`Mitarbeiter „${toDelete.name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Mitarbeiter"
  subtitle={total > 0
    ? `${total.toLocaleString('de-DE')} Einträge`
    : 'Mitarbeiter-Stammdaten verwalten.'}
>
  {#snippet actions()}
    <a class="btn btn-primary btn-sm gap-2" href="/employees/new">
      <Plus size={16} /> Neuer Mitarbeiter
    </a>
  {/snippet}
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Mitarbeiter suchen: Name, Personalnr., Position ..."
      onQuery={() => (page = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length === 0}
      <div class="text-base-content/60 flex h-32 items-center justify-center">
        <span class="loading loading-spinner"></span>
      </div>
    {:else if items.length === 0}
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
        <table class="table-zebra table">
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
              <tr class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{e.personnelNumber}</td>
                <td>
                  <a
                    href="/employees/{e.id}"
                    class="link link-hover font-medium"
                  >
                    {`${e.firstName} ${e.lastName}`}
                  </a>
                </td>
                <td>{e.position ?? ''}</td>
                <td>{e.department ?? ''}</td>
                <td>{e.hireDate ?? ''}</td>
                <td>
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
        {page}
        {pageCount}
        {size}
        onPage={(p) => (page = p)}
        onSize={(s) => {
          size = s as 10 | 25 | 50 | 100
          page = 1
        }}
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
