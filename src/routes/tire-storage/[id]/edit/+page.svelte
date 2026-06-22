<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import TireStorageForm, {
    type TireStorageFormValues
  } from '../../TireStorageForm.svelte'
  import {
    getTireStorageRemote,
    updateTireStorageRemote
  } from '../../tire-storage.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values. */
  const entry = await getTireStorageRemote({ id })

  const handleSave = async (values: TireStorageFormValues) => {
    try {
      await busy.run(() => updateTireStorageRemote({ id, values }))
      toast.success('Eintrag gespeichert.')
      goto(`/tire-storage/${id}`)
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gespeichert werden')
    }
  }
</script>

<PageHeader
  title="Reifeneinlagerung bearbeiten"
  subtitle={entry.storageNumber}
/>

<TireStorageForm
  initial={{
    ...entry,
    profileMm: entry.profileMm == null ? undefined : Number(entry.profileMm),
    customerLabel: entry.customerLabel
  }}
  onSave={handleSave}
  onCancel={() => goto(`/tire-storage/${entry.id}`)}
/>
