<script lang="ts">
  import { goto } from '$app/navigation'
  import { Info } from '@lucide/svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CustomerForm, { type CustomerFormValues } from '../CustomerForm.svelte'
  import { createCustomerRemote } from '../customers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { creationFlow } from '$lib/stores/creation-flow.svelte'
  import { customerPickerLabel } from '$lib/utils/picker-labels'

  /**
   * Flow-leaf mode: another form started a full-page customer creation
   * (creation-flow stack top is 'customer'). Saving then returns to the
   * origin page with the new customer auto-selected; cancelling returns
   * with the origin draft only.
   */
  const inFlow = $derived(creationFlow.top?.entity === 'customer')

  const handleSave = async (values: CustomerFormValues) => {
    try {
      const created = await busy.run(() => createCustomerRemote(values))
      toast.success('Kunde angelegt.')
      if (creationFlow.top?.entity === 'customer') {
        const returnUrl = creationFlow.finish({
          id: created.id,
          label: customerPickerLabel(created)
        })
        goto(returnUrl ?? `/customers/${created.id}`, { replaceState: true })
        return
      }
      goto(`/customers/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht angelegt werden')
    }
  }

  const handleCancel = () => {
    if (creationFlow.top?.entity === 'customer') {
      const returnUrl = creationFlow.cancel()
      goto(returnUrl ?? '/customers')
      return
    }
    goto('/customers')
  }
</script>

<PageHeader
  title="Neuen Kunden anlegen"
  subtitle="Geben Sie die Stammdaten des Kunden ein."
/>

{#if inFlow}
  <div class="alert alert-info mb-4">
    <Info size={16} />
    <span>
      Dieser Kunde wird nach dem Speichern automatisch im vorherigen Formular
      ausgewählt.
    </span>
  </div>
{/if}

<CustomerForm onSave={handleSave} onCancel={handleCancel} />
