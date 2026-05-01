<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ItemForm, { type ItemFormValues } from '../ItemForm.svelte'
  import { createItemRemote } from '../items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let busy = $state(false)
  const handleSave = async (values: ItemFormValues) => {
    busy = true
    try {
      const created = await createItemRemote(values)
      toast.success('Artikel angelegt.')
      goto(`/items/${created.id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Neuer Artikel"
  subtitle="Leistung, Material oder Artikel anlegen."
/>
<ItemForm onSave={handleSave} onCancel={() => goto('/items')} {busy} />
