<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ShippingOptionForm, {
    type ShippingOptionFormValues
  } from '../ShippingOptionForm.svelte'
  import { createShippingOptionRemote } from '../shipping.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: ShippingOptionFormValues) => {
    try {
      await busy.run(() => createShippingOptionRemote(values))
      toast.success('Versandoption angelegt.')
      goto('/settings/shipping', { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neue Versandoption"
  back="/settings/shipping"
  subtitle="Stammdaten erfassen."
/>
<ShippingOptionForm
  onSave={handleSave}
  onCancel={() => goto('/settings/shipping')}
/>
