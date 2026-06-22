<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import TireForm, { type TireFormValues } from '../../TireForm.svelte'
  import { getTireRemote, updateTireRemote } from '../../tires.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const t = await getTireRemote({ id })

  const handleSave = async (values: TireFormValues) => {
    try {
      await busy.run(() => updateTireRemote({ id, values }))
      toast.success('Reifen gespeichert.')
      goto(`/tires/${id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Reifen bearbeiten" subtitle={t.articleNumber ?? ''} />

<TireForm
  initial={t}
  onSave={handleSave}
  onCancel={() => goto(`/tires/${t.id}`)}
/>
