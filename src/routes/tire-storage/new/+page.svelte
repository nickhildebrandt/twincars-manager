<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import TireStorageForm, {
    type TireStorageFormValues
  } from '../TireStorageForm.svelte'
  import { createTireStorageRemote } from '../tire-storage.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const handleSave = async (values: TireStorageFormValues) => {
    try {
      const created = await busy.run(() => createTireStorageRemote(values))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success(`Eintrag „${created.storageNumber}" angelegt.`)
      goto(`/tire-storage/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader
  title="Neue Reifeneinlagerung"
  subtitle="Lagernummer wird automatisch vergeben."
/>

<TireStorageForm onSave={handleSave} onCancel={() => goto('/tire-storage')} />
