<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import TireForm, { type TireFormValues } from '../TireForm.svelte'
  import { createTireRemote } from '../tires.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: TireFormValues) => {
    try {
      const created = await busy.run(() => createTireRemote(values))
      toast.success('Reifen angelegt.')
      goto(`/tires/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neuen Reifen anlegen"
  subtitle="Marke, Modell und Größe sind Pflichtangaben."
/>
<TireForm onSave={handleSave} onCancel={() => goto('/tires')} />
