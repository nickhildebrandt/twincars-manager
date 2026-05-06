<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SupplierForm, { type SupplierFormValues } from '../SupplierForm.svelte'
  import { createSupplierRemote } from '../suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: SupplierFormValues) => {
    try {
      const created = await busy.run(() => createSupplierRemote(values))
      toast.success('Lieferant angelegt.')
      goto(`/suppliers/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Neuen Lieferanten anlegen" subtitle="Stammdaten erfassen." />
<SupplierForm onSave={handleSave} onCancel={() => goto('/suppliers')} />
