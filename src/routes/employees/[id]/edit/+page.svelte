<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmployeeForm, {
    type EmployeeFormValues
  } from '../../EmployeeForm.svelte'
  import {
    getEmployeeRemote,
    updateEmployeeRemote
  } from '../../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getEmployeeRemote({ id }) : null)
  const e = $derived(q?.current)
  const loading = $derived(q?.loading ?? true)

  let busy = $state(false)
  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })

  const handleSave = async (values: EmployeeFormValues) => {
    if (!id) return
    busy = true
    try {
      await updateEmployeeRemote({ id, values })
      toast.success('Mitarbeiter gespeichert.')
      goto(`/employees/${id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Mitarbeiter bearbeiten"
  subtitle={e?.personnelNumber ?? ''}
/>
{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><div class="skeleton h-6 w-1/3"></div></div>
  </div>
{:else if e}
  <EmployeeForm
    initial={e as never}
    onSave={handleSave}
    onCancel={() => goto(`/employees/${e.id}`)}
    {busy}
  />
{/if}
