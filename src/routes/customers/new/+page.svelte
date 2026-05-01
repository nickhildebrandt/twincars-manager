<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CustomerForm, { type CustomerFormValues } from '../CustomerForm.svelte'
  import { createCustomerRemote } from '../customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: CustomerFormValues) => {
    try {
      const created = await busy.run(() => createCustomerRemote(values))
      toast.success('Kunde angelegt.')
      goto(`/customers/${created.id}`)
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader
  title="Neuen Kunden anlegen"
  subtitle="Geben Sie die Stammdaten des Kunden ein."
/>

<CustomerForm onSave={handleSave} onCancel={() => goto('/customers')} />
