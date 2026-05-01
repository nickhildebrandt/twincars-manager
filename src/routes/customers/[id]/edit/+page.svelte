<script lang="ts">
  import { page } from '$app/stores'
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

  const id = $derived($page.params.id ?? '')
  const customerQ = $derived(id ? getCustomerRemote({ id }) : null)
  const customer = $derived(customerQ?.current)
  const loading = $derived(customerQ?.loading ?? true)

  let busy = $state(false)

  $effect(() => {
    if (customerQ?.error) handleClientError(customerQ.error)
  })

  const handleSave = async (values: CustomerFormValues) => {
    if (!id) return
    busy = true
    try {
      await updateCustomerRemote({ id, values })
      toast.success('Kunde gespeichert.')
      goto(`/customers/${id}`)
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht gespeichert werden')
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Kunde bearbeiten" subtitle={customer?.customerNumber} />

{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <div class="skeleton h-6 w-1/3"></div>
      <div class="skeleton mt-3 h-4 w-2/3"></div>
    </div>
  </div>
{:else if customer}
  <CustomerForm
    initial={customer}
    onSave={handleSave}
    onCancel={() => goto(`/customers/${customer.id}`)}
    {busy}
  />
{/if}
