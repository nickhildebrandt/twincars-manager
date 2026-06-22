<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Pencil, Eye, EyeOff, Trash2 } from '@lucide/svelte'
  import {
    getPostRemote,
    setPostPublishedRemote,
    deletePostRemote
  } from '../posts.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  const query = getPostRemote({ id })
  // Top-level await for SSR; `post` stays reactive to `query.current` so
  // the optimistic publish toggle (and any refresh) updates the view.
  const initial = await query
  const post = $derived(query.current ?? initial)

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleString('de-DE') : '—'

  let confirmOpen = $state(false)

  const togglePublished = async () => {
    try {
      await busy.run(() =>
        setPostPublishedRemote({ id, published: !post.published }).updates(
          getPostRemote({ id }).withOverride((current) => ({
            ...current,
            published: !current.published
          }))
        )
      )
      toast.success(
        post.published ? 'Beitrag verborgen.' : 'Beitrag veröffentlicht.'
      )
    } catch (err) {
      handleClientError(err)
    }
  }

  const remove = async () => {
    try {
      await busy.run(() => deletePostRemote({ id }))
      toast.success('Beitrag gelöscht.')
      goto('/posts', { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title={post.title}
  back="/posts"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/posts/${post.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4">
  <div class="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost gap-2"
      onclick={togglePublished}
      disabled={busy.active}
    >
      {#if post.published}
        <EyeOff size={16} /> Verbergen
      {:else}
        <Eye size={16} /> Veröffentlichen
      {/if}
    </button>
    <button
      type="button"
      class="btn btn-ghost text-error gap-2"
      onclick={() => (confirmOpen = true)}
      disabled={busy.active}
    >
      <Trash2 size={16} /> Löschen
    </button>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex flex-wrap items-center gap-2">
        {#if post.published}
          <span class="badge badge-success">Veröffentlicht</span>
        {:else}
          <span class="badge badge-ghost">Entwurf</span>
        {/if}
        <span class="text-base-content/60 text-sm">
          Veröffentlicht am: {fmt(post.publishedAt)}
        </span>
      </div>

      {#if post.coverImage}
        <img
          src={post.coverImage.data}
          alt="Titelbild"
          class="max-h-72 w-full rounded object-cover"
        />
      {/if}

      {#if post.excerpt}
        <p class="text-base-content/80 text-sm italic">{post.excerpt}</p>
      {/if}

      <div class="border-base-300 border-t pt-3">
        <p class="text-sm whitespace-pre-wrap">{post.body}</p>
      </div>

      <dl
        class="text-base-content/60 grid grid-cols-1 gap-y-1 pt-2 text-xs sm:grid-cols-4"
      >
        <dt>Permalink (Slug)</dt>
        <dd class="font-mono break-all sm:col-span-3">{post.slug}</dd>
        <dt>Erstellt</dt>
        <dd class="sm:col-span-3">{fmt(post.createdAt)}</dd>
        <dt>Geändert</dt>
        <dd class="sm:col-span-3">{fmt(post.updatedAt)}</dd>
      </dl>
    </div>
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Beitrag löschen?"
  message={`Soll der Beitrag "${post.title}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
