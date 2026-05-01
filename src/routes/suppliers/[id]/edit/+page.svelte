<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SupplierForm, {
    type SupplierFormValues
  } from '../../SupplierForm.svelte'
  import {
    getSupplierRemote,
    updateSupplierRemote
  } from '../../suppliers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getSupplierRemote({ id }) : null)
  const s = $derived(q?.current)
  const loading = $derived(q?.loading ?? true)

  let busy = $state(false)
  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })

  const handleSave = async (values: SupplierFormValues) => {
    if (!id) return
    busy = true
    try {
      await updateSupplierRemote({ id, values })
      toast.success('Lieferant gespeichert.')
      goto(`/suppliers/${id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Lieferant bearbeiten" subtitle={s?.name ?? ''} />
{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><div class="skeleton h-6 w-1/3"></div></div>
  </div>
{:else if s}
  <SupplierForm
    initial={s}
    onSave={handleSave}
    onCancel={() => goto(`/suppliers/${s.id}`)}
    {busy}
  />
{/if}
