<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ItemForm, { type ItemFormValues } from '../ItemForm.svelte'
  import { createItemRemote } from '../items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const handleSave = async (values: ItemFormValues) => {
    try {
      const created = await busy.run(() => createItemRemote(values))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Artikel angelegt.')
      goto(`/items/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neuen Artikel anlegen"
  subtitle="Leistung, Material oder Artikel anlegen."
/>
<ItemForm onSave={handleSave} onCancel={() => goto('/items')} />
