<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ShippingOptionForm, {
    type ShippingOptionFormValues
  } from '../../ShippingOptionForm.svelte'
  import {
    getShippingOptionRemote,
    updateShippingOptionRemote
  } from '../../shipping.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const s = await getShippingOptionRemote({ id })

  const handleSave = async (values: ShippingOptionFormValues) => {
    try {
      await busy.run(() => updateShippingOptionRemote({ id, values }))
      toast.success('Versandoption gespeichert.')
      goto('/settings/shipping')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Versandoption bearbeiten"
  back="/settings/shipping"
  subtitle={s.name}
/>

<ShippingOptionForm
  initial={s}
  onSave={handleSave}
  onCancel={() => goto('/settings/shipping')}
/>
