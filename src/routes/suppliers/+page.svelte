<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Truck, Pencil, Trash2 } from '@lucide/svelte'
  import { listSuppliersRemote, deleteSupplierRemote } from './suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let page = $state(1)
  const size = 25
  let q = $state('')

  const sQ = $derived(
    listSuppliersRemote({ page, size, q: q || undefined, archived: 'active' })
  )
  const items = $derived(sQ.current?.items ?? [])
  const total = $derived(sQ.current?.total ?? 0)
  const pageCount = $derived(sQ.current?.pageCount ?? 1)
  const loading = $derived(sQ.loading)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteSupplierRemote({ id: toDelete.id }).updates(
        listSuppliersRemote
      )
      toast.success(`Lieferant „${toDelete.name}" gelöscht.`)
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
      onQuery={() => (page = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length > 0}
      <Loader variant="bar" />
    {/if}
    {#if loading && items.length === 0}
      <Loader />
    {:else if items.length === 0}
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
        <table class="table-zebra table">
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
                class="hover:bg-base-200/50 cursor-pointer"
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
        {page}
        {pageCount}
        {size}
        onPage={(p) => (page = p)}
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
