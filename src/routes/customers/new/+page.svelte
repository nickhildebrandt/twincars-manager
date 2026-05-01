<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CustomerForm, { type CustomerFormValues } from '../CustomerForm.svelte'
  import { createCustomerRemote } from '../customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let busy = $state(false)

  const handleSave = async (values: CustomerFormValues) => {
    busy = true
    try {
      const created = await createCustomerRemote(values)
      toast.success('Kunde angelegt.')
      goto(`/customers/${created.id}`)
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht angelegt werden')
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Neuer Kunde"
  subtitle="Geben Sie die Stammdaten des Kunden ein."
/>

<CustomerForm onSave={handleSave} onCancel={() => goto('/customers')} {busy} />
