<script lang="ts">
  import { page } from '$app/stores'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { getEmployeeRemote } from '../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { Pencil, ArrowLeft } from '@lucide/svelte'

  const id = $derived($page.params.id ?? '')
  const q = $derived(id ? getEmployeeRemote({ id }) : null)
  const e = $derived(q?.current)

  $effect(() => {
    if (q?.error) handleClientError(q.error)
  })
</script>

<PageHeader
  title={e ? `${e.firstName} ${e.lastName}` : 'Mitarbeiter'}
  back="/employees"
  primaryAction={e
    ? { label: 'Bearbeiten', href: `/employees/${e.id}/edit`, icon: Pencil }
    : undefined}
/>

{#if e}
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Person & Anschrift</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Geburtstag</dt><dd class="col-span-2"
            >{e.birthday ?? '—'}</dd
          >
          <dt class="text-base-content/60">Anschrift</dt><dd class="col-span-2"
            >{[e.street, e.zip, e.city].filter(Boolean).join(', ') || '—'}</dd
          >
          <dt class="text-base-content/60">E-Mail</dt><dd class="col-span-2"
            >{e.privateEmail ?? '—'}</dd
          >
          <dt class="text-base-content/60">Telefon</dt><dd class="col-span-2"
            >{e.privatePhone ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Beschäftigung</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Eintritt</dt><dd class="col-span-2"
            >{e.hireDate ?? '—'}</dd
          >
          <dt class="text-base-content/60">Position</dt><dd class="col-span-2"
            >{e.position ?? '—'}</dd
          >
          <dt class="text-base-content/60">Abteilung</dt><dd class="col-span-2"
            >{e.department ?? '—'}</dd
          >
          <dt class="text-base-content/60">Art</dt><dd class="col-span-2"
            >{e.employmentType ?? '—'}</dd
          >
          <dt class="text-base-content/60">Wochenstunden</dt><dd
            class="col-span-2">{e.weeklyHours ?? '—'}</dd
          >
          <dt class="text-base-content/60">Urlaub / Jahr</dt><dd
            class="col-span-2">{e.vacationDaysPerYear ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Steuer & SV</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Steuer-ID</dt><dd
            class="col-span-2 font-mono">{e.taxId ?? '—'}</dd
          >
          <dt class="text-base-content/60">Steuerklasse</dt><dd
            class="col-span-2">{e.taxClass ?? '—'}</dd
          >
          <dt class="text-base-content/60">SV-Nummer</dt><dd
            class="col-span-2 font-mono">{e.socialInsuranceNumber ?? '—'}</dd
          >
          <dt class="text-base-content/60">Krankenkasse</dt><dd
            class="col-span-2">{e.healthInsurance ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Bankverbindung</h3>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Inhaber</dt><dd class="col-span-2"
            >{e.bankAccountHolder ?? '—'}</dd
          >
          <dt class="text-base-content/60">IBAN</dt><dd
            class="col-span-2 font-mono">{e.bankIban ?? '—'}</dd
          >
          <dt class="text-base-content/60">BIC</dt><dd
            class="col-span-2 font-mono">{e.bankBic ?? '—'}</dd
          >
          <dt class="text-base-content/60">Bank</dt><dd class="col-span-2"
            >{e.bankName ?? '—'}</dd
          >
        </dl>
      </div>
    </div>
  </div>
{/if}
