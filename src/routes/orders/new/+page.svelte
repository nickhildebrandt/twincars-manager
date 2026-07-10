<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import WorkOrderForm, {
    type WorkOrderFormValues
  } from '../WorkOrderForm.svelte'
  import { createWorkOrderRemote } from '../orders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const handleSave = async (values: WorkOrderFormValues) => {
    try {
      const created = await busy.run(() =>
        createWorkOrderRemote({
          title: values.title,
          description: values.description,
          customerId: values.customerId,
          vehicleId: values.vehicleId,
          scheduledDate: values.scheduledDate,
          scheduledTime: values.scheduledTime,
          assigneeIds: values.assigneeIds
        })
      )
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Auftrag angelegt.')
      goto(`/orders/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader title="Neuen Auftrag anlegen" back="/orders" />

<WorkOrderForm onSave={handleSave} onCancel={() => goto('/orders')} />
