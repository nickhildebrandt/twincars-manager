<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SupplierForm, {
    type SupplierFormValues
  } from '../../SupplierForm.svelte'
  import {
    getSupplierRemote,
    updateSupplierRemote
  } from '../../suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const s = await getSupplierRemote({ id })

  const handleSave = async (values: SupplierFormValues) => {
    try {
      await busy.run(() => updateSupplierRemote({ id, values }))
      toast.success('Lieferant gespeichert.')
      goto(`/suppliers/${id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Lieferant bearbeiten" subtitle={s.name} />

<SupplierForm
  initial={s}
  onSave={handleSave}
  onCancel={() => goto(`/suppliers/${s.id}`)}
/>
