<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'

  type Employee = Record<string, string | number | boolean | null | undefined>

  type Props = {
    initial?: Employee
    onSave: (values: EmployeeFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type EmployeeFormValues = {
    firstName: string
    lastName: string
    personnelNumber?: string
    salutation?: string
    birthday?: string
    street?: string
    zip?: string
    city?: string
    privateEmail?: string
    privatePhone?: string
    mobile?: string
    hireDate?: string
    position?: string
    department?: string
    employmentType?: string
    weeklyHours?: number
    monthlySalary?: number
    hourlyWage?: number
    vacationDaysPerYear?: number
    taxId?: string
    taxClass?: string
    socialInsuranceNumber?: string
    healthInsurance?: string
    bankAccountHolder?: string
    bankIban?: string
    bankBic?: string
    bankName?: string
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  /** Snapshot the initial prop once at mount — see CustomerForm for rationale. */
  const init = untrack(() => ({ ...initial }))

  let firstName = $state((init.firstName as string) ?? '')
  let lastName = $state((init.lastName as string) ?? '')
  let personnelNumber = $state((init.personnelNumber as string) ?? '')
  let salutation = $state((init.salutation as string) ?? '')
  let birthday = $state((init.birthday as string) ?? '')
  let street = $state((init.street as string) ?? '')
  let zip = $state((init.zip as string) ?? '')
  let city = $state((init.city as string) ?? '')
  let privateEmail = $state((init.privateEmail as string) ?? '')
  let privatePhone = $state((init.privatePhone as string) ?? '')
  let mobile = $state((init.mobile as string) ?? '')
  let hireDate = $state((init.hireDate as string) ?? '')
  let position = $state((init.position as string) ?? '')
  let department = $state((init.department as string) ?? '')
  let employmentType = $state((init.employmentType as string) ?? '')
  let weeklyHours = $state<number | string>((init.weeklyHours as number) ?? '')
  let monthlySalary = $state<number | string>(
    (init.monthlySalary as number) ?? ''
  )
  let hourlyWage = $state<number | string>((init.hourlyWage as number) ?? '')
  let vacationDaysPerYear = $state<number | string>(
    (init.vacationDaysPerYear as number) ?? ''
  )
  let taxId = $state((init.taxId as string) ?? '')
  let taxClass = $state((init.taxClass as string) ?? '')
  let socialInsuranceNumber = $state(
    (init.socialInsuranceNumber as string) ?? ''
  )
  let healthInsurance = $state((init.healthInsurance as string) ?? '')
  let bankAccountHolder = $state((init.bankAccountHolder as string) ?? '')
  let bankIban = $state((init.bankIban as string) ?? '')
  let bankBic = $state((init.bankBic as string) ?? '')
  let bankName = $state((init.bankName as string) ?? '')

  let errorMsg = $state<string | null>(null)

  const u = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }
  const n = (v: number | string) => (v === '' ? undefined : Number(v))

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!firstName.trim() || !lastName.trim()) {
      errorMsg = 'Bitte Vor- und Nachnamen eingeben.'
      return
    }
    await onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      personnelNumber: u(personnelNumber),
      salutation: u(salutation),
      birthday: u(birthday),
      street: u(street),
      zip: u(zip),
      city: u(city),
      privateEmail: u(privateEmail),
      privatePhone: u(privatePhone),
      mobile: u(mobile),
      hireDate: u(hireDate),
      position: u(position),
      department: u(department),
      employmentType: u(employmentType),
      weeklyHours: n(weeklyHours),
      monthlySalary: n(monthlySalary),
      hourlyWage: n(hourlyWage),
      vacationDaysPerYear: n(vacationDaysPerYear),
      taxId: u(taxId),
      taxClass: u(taxClass),
      socialInsuranceNumber: u(socialInsuranceNumber),
      healthInsurance: u(healthInsurance),
      bankAccountHolder: u(bankAccountHolder),
      bankIban: u(bankIban),
      bankBic: u(bankBic),
      bankName: u(bankName)
    })
  }
</script>

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Person</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control">
          <span class="label-text">Personalnr. (auto)</span>
          <input
            class="input input-bordered"
            maxlength="30"
            placeholder="auto"
            bind:value={personnelNumber}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Anrede</span>
          <select class="select select-bordered" bind:value={salutation}>
            <option value="">—</option>
            <option>Herr</option>
            <option>Frau</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Geburtstag</span>
          <input
            class="input input-bordered"
            type="date"
            bind:value={birthday}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Vorname *</span>
          <input
            class="input input-bordered"
            maxlength="100"
            bind:value={firstName}
          />
        </label>
        <label class="form-control sm:col-span-2">
          <span class="label-text">Nachname *</span>
          <input
            class="input input-bordered"
            maxlength="100"
            bind:value={lastName}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Anschrift & Kontakt</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control sm:col-span-3">
          <span class="label-text">Straße + Hausnummer</span>
          <input
            class="input input-bordered"
            maxlength="200"
            bind:value={street}
          />
        </label>
        <label class="form-control"
          ><span class="label-text">PLZ</span><input
            class="input input-bordered"
            maxlength="10"
            bind:value={zip}
          /></label
        >
        <label class="form-control sm:col-span-2"
          ><span class="label-text">Ort</span><input
            class="input input-bordered"
            maxlength="150"
            bind:value={city}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Private E-Mail</span><input
            class="input input-bordered"
            type="email"
            maxlength="254"
            bind:value={privateEmail}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Telefon</span><input
            class="input input-bordered"
            maxlength="30"
            bind:value={privatePhone}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Mobil</span><input
            class="input input-bordered"
            maxlength="30"
            bind:value={mobile}
          /></label
        >
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Beschäftigung</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control"
          ><span class="label-text">Eintrittsdatum</span><input
            class="input input-bordered"
            type="date"
            bind:value={hireDate}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Position</span><input
            class="input input-bordered"
            maxlength="150"
            bind:value={position}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Abteilung</span><input
            class="input input-bordered"
            maxlength="100"
            bind:value={department}
          /></label
        >
        <label class="form-control">
          <span class="label-text">Beschäftigungsart</span>
          <select class="select select-bordered" bind:value={employmentType}>
            <option value="">—</option>
            <option>Vollzeit</option>
            <option>Teilzeit</option>
            <option>Minijob</option>
            <option>Werkstudent</option>
            <option>Auszubildender</option>
          </select>
        </label>
        <label class="form-control"
          ><span class="label-text">Wochenstunden</span><input
            class="input input-bordered"
            type="number"
            min="0"
            max="60"
            step="0.5"
            bind:value={weeklyHours}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Urlaubstage / Jahr</span><input
            class="input input-bordered"
            type="number"
            min="0"
            max="60"
            bind:value={vacationDaysPerYear}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Monatsgehalt (€)</span><input
            class="input input-bordered"
            type="number"
            min="0"
            step="0.01"
            bind:value={monthlySalary}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">Stundenlohn (€)</span><input
            class="input input-bordered"
            type="number"
            min="0"
            step="0.01"
            bind:value={hourlyWage}
          /></label
        >
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Steuer & Sozialversicherung</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control"
          ><span class="label-text">Steuer-ID</span><input
            class="input input-bordered"
            maxlength="30"
            bind:value={taxId}
          /></label
        >
        <label class="form-control">
          <span class="label-text">Steuerklasse</span>
          <select class="select select-bordered" bind:value={taxClass}>
            <option value="">—</option>
            <option>1</option><option>2</option><option>3</option><option
              >4</option
            ><option>5</option><option>6</option>
          </select>
        </label>
        <label class="form-control"
          ><span class="label-text">SV-Nummer</span><input
            class="input input-bordered"
            maxlength="30"
            bind:value={socialInsuranceNumber}
          /></label
        >
        <label class="form-control sm:col-span-3"
          ><span class="label-text">Krankenkasse</span><input
            class="input input-bordered"
            maxlength="100"
            bind:value={healthInsurance}
          /></label
        >
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Bankverbindung</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control sm:col-span-3"
          ><span class="label-text">Kontoinhaber</span><input
            class="input input-bordered"
            maxlength="200"
            bind:value={bankAccountHolder}
          /></label
        >
        <label class="form-control sm:col-span-2"
          ><span class="label-text">IBAN</span><input
            class="input input-bordered"
            maxlength="34"
            bind:value={bankIban}
          /></label
        >
        <label class="form-control"
          ><span class="label-text">BIC</span><input
            class="input input-bordered"
            maxlength="11"
            bind:value={bankBic}
          /></label
        >
        <label class="form-control sm:col-span-3"
          ><span class="label-text">Bankname</span><input
            class="input input-bordered"
            maxlength="100"
            bind:value={bankName}
          /></label
        >
      </div>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}>Abbrechen</button
        >
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
