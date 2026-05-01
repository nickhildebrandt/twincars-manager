<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SupplierForm, { type SupplierFormValues } from '../SupplierForm.svelte'
  import { createSupplierRemote } from '../suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let busy = $state(false)
  const handleSave = async (values: SupplierFormValues) => {
    busy = true
    try {
      const created = await createSupplierRemote(values)
      toast.success('Lieferant angelegt.')
      goto(`/suppliers/${created.id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Neuer Lieferant" subtitle="Stammdaten erfassen." />
<SupplierForm onSave={handleSave} onCancel={() => goto('/suppliers')} {busy} />
