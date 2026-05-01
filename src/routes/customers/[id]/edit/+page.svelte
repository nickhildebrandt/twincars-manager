<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CustomerForm, {
    type CustomerFormValues
  } from '../../CustomerForm.svelte'
  import {
    getCustomerRemote,
    updateCustomerRemote
  } from '../../customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const customer = await getCustomerRemote({ id })

  const handleSave = async (values: CustomerFormValues) => {
    try {
      await busy.run(() => updateCustomerRemote({ id, values }))
      toast.success('Kunde gespeichert.')
      goto(`/customers/${id}`)
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht gespeichert werden')
    }
  }
</script>

<PageHeader title="Kunde bearbeiten" subtitle={customer.customerNumber} />

<CustomerForm
  initial={customer}
  onSave={handleSave}
  onCancel={() => goto(`/customers/${customer.id}`)}
/>
