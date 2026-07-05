<script lang="ts">
  /**
   * Combined, relation-aware Kunde/Fahrzeug picker.
   *
   * The two entities are linked, so this component replaces the two
   * independent pickers wherever both are selectable:
   *
   * - Picking a VEHICLE first auto-fills its holder as the customer
   *   (every vehicle hit carries `customerId`/`customerLabel`).
   * - Picking a CUSTOMER first narrows the vehicle search to that
   *   customer's vehicles; a previously chosen vehicle of another
   *   customer is cleared.
   * - The vehicle search always also matches the holder's name, so
   *   "Müller" finds Müller's cars even before a customer is chosen.
   *
   * Bindable `customerId`/`vehicleId` (+ labels) keep the parent-page
   * contract identical to the two separate pickers it replaces.
   */
  import SearchablePicker from './SearchablePicker.svelte'
  import QuickCreateCustomerForm from './QuickCreateCustomerForm.svelte'
  import QuickCreateVehicleForm from './QuickCreateVehicleForm.svelte'
  import {
    pickCustomersRemote,
    pickCustomerVehiclesRemote
  } from '../../../routes/pickers.remote'

  type VehicleHit = {
    id: string
    label: string
    customerId: string | null
    customerLabel: string | null
  }

  type Props = {
    customerId?: string
    customerLabel?: string
    vehicleId?: string
    vehicleLabel?: string
    customerFieldLabel?: string
    vehicleFieldLabel?: string
    customerRequired?: boolean
    vehicleRequired?: boolean
    /**
     * Freezes the vehicle field (e.g. stock-sale flow where the
     * vehicle is preloaded from inventory and must not change). A
     * locked vehicle also survives customer changes.
     */
    vehicleLocked?: boolean
    /** Light helper text under the vehicle field. */
    vehicleHint?: string
    /** Curated German error shown in red under the customer field. */
    customerError?: string | null
    /** Fires after any selection change (pick, auto-fill, clear). */
    onChange?: () => void
    disabled?: boolean
    /** Width modifier applied to both field wrappers (e.g. col-spans). */
    colSpan?: string
  }

  let {
    customerId = $bindable(''),
    customerLabel = $bindable(''),
    vehicleId = $bindable(''),
    vehicleLabel = $bindable(''),
    customerFieldLabel = 'Kunde',
    vehicleFieldLabel = 'Fahrzeug',
    customerRequired = false,
    vehicleRequired = false,
    vehicleLocked = false,
    vehicleHint,
    customerError = null,
    onChange,
    disabled = false,
    colSpan
  }: Props = $props()

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  // The vehicle search closes over the currently selected customer so
  // the dialog only offers that customer's vehicles once one is set.
  const searchVehicles = (params: { q: string; page: number; size: number }) =>
    pickCustomerVehiclesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100,
      customerId: customerId || undefined
    }).run()

  // SearchablePicker writes the bound value BEFORE calling onSelect,
  // so "did the customer change?" needs its own memory of the last
  // confirmed customer — comparing against `customerId` would always
  // see the freshly written id.
  let lastCustomerId = customerId

  const onCustomerSelect = (item: { id: string; label: string } | null) => {
    if (item === null) {
      customerId = ''
      customerLabel = ''
      lastCustomerId = ''
      // Without a holder context the previously chosen vehicle keeps
      // no meaning — clear it (unless it is deliberately locked).
      if (!vehicleLocked) {
        vehicleId = ''
        vehicleLabel = ''
      }
      onChange?.()
      return
    }
    if (lastCustomerId && lastCustomerId !== item.id && !vehicleLocked) {
      // Switching to a different customer invalidates the vehicle.
      vehicleId = ''
      vehicleLabel = ''
    }
    customerId = item.id
    customerLabel = item.label
    lastCustomerId = item.id
    onChange?.()
  }

  const onVehicleSelect = (item: VehicleHit | null) => {
    if (item === null) {
      vehicleId = ''
      vehicleLabel = ''
      onChange?.()
      return
    }
    vehicleId = item.id
    vehicleLabel = item.label
    // The relation: a vehicle determines its holder.
    if (item.customerId) {
      customerId = item.customerId
      customerLabel = item.customerLabel ?? ''
      lastCustomerId = item.customerId
    }
    onChange?.()
  }
</script>

{#snippet customerCreateForm(props: {
  initialQuery: string
  onCreated: (item: { id: string; label: string }) => void
  onCancel: () => void
})}
  <QuickCreateCustomerForm
    initialQuery={props.initialQuery}
    onCreated={props.onCreated}
    onCancel={props.onCancel}
  />
{/snippet}

{#snippet vehicleCreateForm(props: {
  initialQuery: string
  onCreated: (item: VehicleHit) => void
  onCancel: () => void
})}
  <QuickCreateVehicleForm
    {customerId}
    {customerLabel}
    initialQuery={props.initialQuery}
    onCreated={props.onCreated}
    onCancel={props.onCancel}
  />
{/snippet}

<!--
	div + span instead of FormField: the picker contains its own dialog
	with many buttons, and wrapping that in a <label> would both forward
	stray clicks to the trigger and leak the dialog text into the
	trigger's accessible name. Same pattern as every other picker field.
-->
<div class="flex w-full flex-col gap-1 {colSpan ?? ''}">
  <span class="label-text">
    {customerFieldLabel}{customerRequired ? ' *' : ''}
  </span>
  <SearchablePicker
    bind:value={customerId}
    bind:valueLabel={customerLabel}
    dialogTitle="Kunde wählen"
    placeholder="Kunde suchen"
    search={searchCustomers}
    onSelect={onCustomerSelect}
    {disabled}
    createLabel="Neuen Kunden anlegen"
    createForm={customerCreateForm}
  />
  {#if customerError}
    <span class="text-error text-sm">{customerError}</span>
  {/if}
</div>

<div class="flex w-full flex-col gap-1 {colSpan ?? ''}">
  <span class="label-text">
    {vehicleFieldLabel}{vehicleRequired ? ' *' : ''}
  </span>
  <SearchablePicker
    bind:value={vehicleId}
    bind:valueLabel={vehicleLabel}
    dialogTitle={customerId
      ? 'Fahrzeug des Kunden wählen'
      : 'Fahrzeug wählen (Kunde wird übernommen)'}
    placeholder={customerId
      ? 'Fahrzeug dieses Kunden suchen'
      : 'Fahrzeug oder Halter suchen'}
    emptyText={customerId
      ? 'Keine Treffer.'
      : 'Keine Treffer. Zuerst Kunden wählen, um ein neues Fahrzeug anzulegen.'}
    search={searchVehicles}
    onSelect={onVehicleSelect}
    disabled={disabled || vehicleLocked}
    createLabel={customerId ? 'Neues Fahrzeug anlegen' : undefined}
    createForm={customerId ? vehicleCreateForm : undefined}
  />
  {#if vehicleHint}
    <span class="text-base-content/60 text-xs">{vehicleHint}</span>
  {/if}
</div>
