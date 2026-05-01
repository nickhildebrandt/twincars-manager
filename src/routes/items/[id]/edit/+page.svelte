<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ItemForm, { type ItemFormValues } from '../../ItemForm.svelte'
  import { getItemRemote, updateItemRemote } from '../../items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getItemRemote({ id }) : null)
  const i = $derived(q?.current)
  const loading = $derived(q?.loading ?? true)

  let busy = $state(false)
  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })

  const handleSave = async (values: ItemFormValues) => {
    if (!id) return
    busy = true
    try {
      await updateItemRemote({ id, values })
      toast.success('Artikel gespeichert.')
      goto(`/items/${id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Artikel bearbeiten" subtitle={i?.articleNumber ?? ''} />
{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><div class="skeleton h-6 w-1/3"></div></div>
  </div>
{:else if i}
  <ItemForm
    initial={i}
    onSave={handleSave}
    onCancel={() => goto(`/items/${i.id}`)}
    {busy}
  />
{/if}
