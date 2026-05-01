<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Users, Pencil, Trash2 } from '@lucide/svelte'
  import { listCustomersRemote, deleteCustomerRemote } from './customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let page = $state(1)
  let size = $state<10 | 25 | 50 | 100>(25)
  let q = $state('')
  let archivedFilter = $state<'active' | 'archived' | 'all'>('active')

  const customersQ = $derived(
    listCustomersRemote({
      page,
      size,
      q: q || undefined,
      archived: archivedFilter
    })
  )

  const result = $derived(customersQ.current)
  const items = $derived(result?.items ?? [])
  const total = $derived(result?.total ?? 0)
  const pageCount = $derived(result?.pageCount ?? 1)
  const loading = $derived(customersQ.loading)

  $effect(() => {
    if (customersQ.error) handleClientError(customersQ.error)
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
    try {
      await deleteCustomerRemote({ id: toDeleteId })
      toast.success(`Kunde „${toDeleteName}" gelöscht.`)
      toDeleteId = null
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht gelöscht werden')
    }
  }

  const customerLabel = (c: (typeof items)[number]) =>
    c.company ||
    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
    c.customerNumber
</script>

<PageHeader
  title="Kunden"
  subtitle={total > 0
    ? `${total.toLocaleString('de-DE')} Einträge`
    : 'Verwalten Sie Ihre Kunden.'}
>
  {#snippet actions()}
    <a class="btn btn-primary btn-sm gap-2" href="/customers/new">
      <Plus size={16} /> Neuer Kunde
    </a>
  {/snippet}
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Kunden suchen: Name, Kundennr., Ort, Telefon ..."
      onQuery={() => (page = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={archivedFilter}
          onchange={() => (page = 1)}
        >
          <option value="active">Aktiv</option>
          <option value="archived">Archiviert</option>
          <option value="all">Alle</option>
        </select>
      {/snippet}
    </Toolbar>
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
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Kundennr.</th>
              <th>Name / Firma</th>
              <th>Ort</th>
              <th>Telefon</th>
              <th>E-Mail</th>
              <th class="w-32 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as c (c.id)}
              <tr class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{c.customerNumber}</td>
                <td>
                  <a
                    class="link link-hover font-medium"
                    href="/customers/{c.id}"
                  >
                    {customerLabel(c)}
                  </a>
                </td>
                <td>{c.city ?? ''}</td>
                <td>{c.phone ?? ''}</td>
                <td>{c.email ?? ''}</td>
                <td>
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
  title="Kunde löschen?"
  message={`Soll der Kunde "${toDeleteName}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
