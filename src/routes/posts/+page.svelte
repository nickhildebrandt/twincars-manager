<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Newspaper, Pencil, Trash2 } from '@lucide/svelte'
  import { listPostsRemote, deletePostRemote } from './posts.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listPostsRemote({
      page: pageNum,
      size,
      q: q || undefined,
      published: 'all'
    })
  )

  const initial = await untrack(() => query)

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

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; title: string } | null>(null)

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString('de-DE') : '—'

  const remove = async () => {
    if (!toDelete) return
    const { id, title } = toDelete
    try {
      await busy.run(() =>
        deletePostRemote({ id }).updates(
          listPostsRemote({
            page: pageNum,
            size,
            q: q || undefined,
            published: 'all'
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((p) => p.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Beitrag „${title}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Aktuelle Informationen"
  primaryAction={{ label: 'Neuer Beitrag', href: '/posts/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Beiträge suchen: Titel, Teaser ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Newspaper}
        title="Noch keine Beiträge"
        description="Veröffentlichen Sie Neuigkeiten für Ihre Website."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/posts/new">
            <Plus size={16} /> Neuer Beitrag
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Status</th>
              <th>Veröffentlicht am</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as p (p.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/posts/${p.id}`)}
              >
                <td class="font-medium">{p.title}</td>
                <td>
                  {#if p.published}
                    <span class="badge badge-sm badge-success"
                      >Veröffentlicht</span
                    >
                  {:else}
                    <span class="badge badge-sm badge-ghost">Entwurf</span>
                  {/if}
                </td>
                <td>{fmt(p.publishedAt)}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/posts/{p.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: p.id, title: p.title }
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
  title="Beitrag löschen?"
  message={`Soll der Beitrag "${toDelete?.title ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
