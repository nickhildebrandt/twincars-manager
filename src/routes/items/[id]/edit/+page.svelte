<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ItemForm, { type ItemFormValues } from '../../ItemForm.svelte'
  import { getItemRemote, updateItemRemote } from '../../items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const i = await getItemRemote({ id })

  const handleSave = async (values: ItemFormValues) => {
    try {
      await busy.run(() => updateItemRemote({ id, values }))
      toast.success('Artikel gespeichert.')
      goto(`/items/${id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Artikel bearbeiten" subtitle={i.articleNumber ?? ''} />

<ItemForm
  initial={i}
  onSave={handleSave}
  onCancel={() => goto(`/items/${i.id}`)}
/>
