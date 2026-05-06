<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SpecialPaymentForm, {
    type SpecialPaymentValues
  } from '../SpecialPaymentForm.svelte'
  import { createSpecialPaymentRemote } from '../special-payments.remote'
  import { listEmployeesRemote } from '../../employees/employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /** Aktive Mitarbeiter für die Empfänger-Auswahl. */
  const empList = await listEmployeesRemote({
    page: 1,
    size: 100,
    archived: 'active'
  })

  const handleSave = async (values: SpecialPaymentValues) => {
    try {
      await busy.run(() => createSpecialPaymentRemote(values))
      toast.success('Sonderzahlung angelegt.')
      goto('/special-payments')
    } catch (err) {
      handleClientError(err, 'Sonderzahlung konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader title="Neue Sonderzahlung" back="/special-payments" />

<SpecialPaymentForm
  employees={empList.items}
  onSave={handleSave}
  onCancel={() => goto('/special-payments')}
/>
