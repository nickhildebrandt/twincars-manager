<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SpecialPaymentForm, {
    type SpecialPaymentValues
  } from '../../SpecialPaymentForm.svelte'
  import {
    getSpecialPaymentRemote,
    updateSpecialPaymentRemote
  } from '../../special-payments.remote'
  import { listEmployeesRemote } from '../../../employees/employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  const [payment, empList] = await Promise.all([
    getSpecialPaymentRemote({ id }),
    listEmployeesRemote({ page: 1, size: 100, archived: 'active' })
  ])

  const handleSave = async (values: SpecialPaymentValues) => {
    try {
      await busy.run(() => updateSpecialPaymentRemote({ id, values }))
      toast.success('Sonderzahlung gespeichert.')
      goto('/special-payments')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Sonderzahlung bearbeiten" back="/special-payments" />

<SpecialPaymentForm
  initial={{
    label: payment.label,
    kind: payment.kind as 'one_time' | 'recurring',
    amount: payment.amount,
    startMonth: payment.startMonth,
    endMonth: payment.endMonth,
    targetAll: payment.targetAll,
    employeeIds: payment.employeeIds,
    notes: payment.notes
  }}
  employees={empList.items}
  onSave={handleSave}
  onCancel={() => goto('/special-payments')}
/>
