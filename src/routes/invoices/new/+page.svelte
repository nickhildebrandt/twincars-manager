<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page as pageStore } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CustomerVehiclePicker from '$lib/components/ui/CustomerVehiclePicker.svelte'
  import PositionsEditor, {
    applyVehicleToPosition,
    blankPosition,
    cleanPosition,
    type Position
  } from '../PositionsEditor.svelte'
  import { createInvoiceRemote } from '../invoices.remote'
  import { getInventoryVehicleRemote } from '../../inventory/inventory.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'
  import { PAYMENT_METHODS, type PaymentMethod } from '$lib/payment-methods'

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + 14)
  const dueIso = due.toISOString().slice(0, 10)

  /**
   * JSON-serializable snapshot of the whole form (header fields +
   * positions) — pushed into the creation-flow store when the user
   * jumps to a full-page customer/vehicle create and restored when
   * they come back.
   */
  type Draft = {
    customerId: string
    customerLabel: string
    vehicleId: string
    vehicleLabel: string
    issueDate: string
    dueDate: string
    serviceDate: string
    paymentMethod: PaymentMethod
    header: string
    footer: string
    notes: string
    positions: Position[]
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page (incl. a possible ?vehicleId=… search string) once.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  let customerId = $state(draft?.customerId ?? '')
  let customerLabel = $state(draft?.customerLabel ?? '')
  let vehicleId = $state(draft?.vehicleId ?? '')
  let vehicleLabel = $state(draft?.vehicleLabel ?? '')
  let issueDate = $state(draft?.issueDate ?? today)
  let dueDate = $state(draft?.dueDate ?? dueIso)
  let serviceDate = $state(draft?.serviceDate ?? today)
  let paymentMethod = $state<PaymentMethod>(
    draft?.paymentMethod ?? 'Überweisung'
  )
  let header = $state(draft?.header ?? '')
  let footer = $state(draft?.footer ?? '')
  let notes = $state(draft?.notes ?? '')

  let positions = $state<Position[]>(draft?.positions ?? [blankPosition()])

  // A successful create auto-selects the new entity in the picker
  // that started the flow.
  if (pending?.result) {
    if (pending.originField === 'customerId') {
      customerId = pending.result.id
      customerLabel = pending.result.label
    } else if (pending.originField === 'vehicleId') {
      vehicleId = pending.result.id
      vehicleLabel = pending.result.label
    }
  }
  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)

  const buildDraft = (): Draft => ({
    customerId,
    customerLabel,
    vehicleId,
    vehicleLabel,
    issueDate,
    dueDate,
    serviceDate,
    paymentMethod,
    header,
    footer,
    notes,
    positions: positions.map((p) => ({ ...p }))
  })

  // Cycle guard: no create for an entity type already being created
  // somewhere in the active chain.
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )
  const canCreateVehicle = $derived(
    !creationFlow.activeEntities().has('vehicle')
  )

  const startCreate = (
    entity: 'customer' | 'vehicle',
    originField: string,
    target: string
  ) => {
    creationFlow.start({
      entity,
      returnUrl: currentUrl(),
      originField,
      draft: buildDraft(),
      createdAt: Date.now()
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto(target)
  }

  const preloadVehicleId = pageStore.url.searchParams.get('vehicleId')
  const preloadQuery = $derived(
    preloadVehicleId
      ? getInventoryVehicleRemote({ id: preloadVehicleId })
      : null
  )
  /**
   * `true`, sobald die Seite mit `?vehicleId=…` aus dem Verkaufsbestand
   * geöffnet wurde. Treibt sowohl die Vorbelegung des Fahrzeug-Pickers
   * oben als auch den Banner, der den Übergangsprozess erläutert.
   * Beim Speichern landet das Fahrzeug als Position in der Rechnung
   * **und** als `vehicleId` am Dokument selbst — letzteres ist die
   * Voraussetzung für `transferStockVehicleOnPayment`.
   */
  const isStockSale = $derived(!!preloadVehicleId)
  // A restored draft already contains the stock-vehicle position —
  // never append it a second time.
  let preloaded = $state(draft !== null)
  $effect(() => {
    if (preloaded) return
    const data = preloadQuery?.current
    if (!data) return
    preloaded = true
    // Drop untouched blank rows and append the stock vehicle as a
    // pre-filled position.
    positions = [
      ...positions.filter(
        (p) => p.description.trim() !== '' || p.source !== 'free'
      ),
      applyVehicleToPosition(blankPosition(), {
        ...data,
        differentialTax: data.differentialTax ?? false,
        label: [data.make, data.model].filter(Boolean).join(' ')
      })
    ]
    // Fahrzeug oben am Dokument vorbelegen — sonst kann
    // `transferStockVehicleOnPayment` das Fahrzeug bei Zahlung nicht
    // umschreiben, weil `documents.vehicle_id` leer wäre.
    vehicleId = data.id
    vehicleLabel =
      [data.make, data.model].filter(Boolean).join(' ').trim() ||
      data.plate ||
      data.vin ||
      ''
  })
  $effect(() => {
    if (preloadQuery?.error) handleClientError(preloadQuery.error)
  })

  /* — 0-€-Warnmodal: trifft alle Positions-Quellen (Frei, Artikel,
     Leistung, Fahrzeug). Eine Position gilt als kostenlos, wenn der
     berechnete Zeilen-Netto auf 0 fällt — sei es durch Einzelpreis 0
     oder Rabatt 100 %. Der Nutzer muss explizit bestätigen. — */
  let zeroOpen = $state(false)
  let zeroRows = $state<{ description: string; reason: string }[]>([])
  let pendingItems = $state<Array<ReturnType<typeof cleanPosition>>>([])

  const persistInvoice = async (
    cleaned: Array<ReturnType<typeof cleanPosition>>
  ) => {
    const created = await busy.run(() =>
      createInvoiceRemote({
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        issueDate,
        serviceDate,
        dueDate,
        paymentMethod,
        header: header.trim() || undefined,
        footer: footer.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cleaned
      })
    )
    toast.success(`Rechnung ${created.documentNumber} erstellt.`)
    // Saved — silence the unsaved-changes guard before navigating
    // (§11: clear before goto so beforeNavigate stays quiet).
    formDirty.clear()
    goto(`/invoices/${created.id}`, { replaceState: true })
  }

  /** Rule 1.1: never disable Submit for invalid input — check here. */
  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!customerId) {
      errorMsg = 'Bitte einen Kunden auswählen.'
      return
    }
    const cleaned = positions
      .map((p) => cleanPosition(p))
      .filter((p) => p.description !== '')
    if (cleaned.length === 0) {
      errorMsg = 'Bitte mindestens eine Position mit Beschreibung anlegen.'
      return
    }
    const zero = cleaned
      .map((p) => {
        if (p.unitPriceNet === 0)
          return { description: p.description, reason: 'Einzelpreis 0 €' }
        if (p.discountPercent >= 100)
          return { description: p.description, reason: 'Rabatt 100 %' }
        const lineNet =
          p.quantity * p.unitPriceNet * (1 - p.discountPercent / 100)
        if (Math.abs(lineNet) < 0.005)
          return { description: p.description, reason: 'Endpreis 0 €' }
        return null
      })
      .filter((x): x is { description: string; reason: string } => x !== null)
    if (zero.length > 0) {
      zeroRows = zero
      pendingItems = cleaned
      zeroOpen = true
      return
    }
    try {
      await persistInvoice(cleaned)
    } catch (err) {
      handleClientError(err)
    }
  }

  const confirmZero = async () => {
    zeroOpen = false
    try {
      await persistInvoice(pendingItems)
    } catch (err) {
      handleClientError(err)
    }
  }
  const cancelZero = () => {
    zeroOpen = false
    pendingItems = []
    zeroRows = []
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<PageHeader
  title="Neue Rechnung anlegen"
  subtitle="Positionen, Kunde und Konditionen erfassen."
/>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="space-y-4"
  novalidate
>
  {#if errorMsg}
    <div class="alert alert-error"><span>{errorMsg}</span></div>
  {/if}

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Empfänger und Konditionen</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CustomerVehiclePicker
            bind:customerId
            bind:customerLabel
            bind:vehicleId
            bind:vehicleLabel
            customerRequired
            vehicleRequired={isStockSale}
            vehicleLocked={isStockSale}
            vehicleHint={isStockSale
              ? 'Lagerfahrzeug aus dem Verkaufsbestand. Beim Bezahlen der Rechnung wird es automatisch in die Kundenfahrzeuge übernommen.'
              : undefined}
            onCreateCustomer={canCreateCustomer
              ? () => startCreate('customer', 'customerId', '/customers/new')
              : undefined}
            onCreateVehicle={canCreateVehicle
              ? () => startCreate('vehicle', 'vehicleId', '/vehicles/new')
              : undefined}
          />
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Rechnungsdatum *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={issueDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Leistungsdatum</span>
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={serviceDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Fälligkeit</span>
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={dueDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1 sm:col-span-3">
            <span class="label-text">Zahlungsart</span>
            <select
              class="select select-bordered w-full"
              bind:value={paymentMethod}
            >
              {#each PAYMENT_METHODS as method (method)}
                <option>{method}</option>
              {/each}
            </select>
          </label>
        </div>
      </fieldset>
    </div>
  </div>

  <PositionsEditor
    bind:positions
    descriptionPlaceholder="z. B. Sonderposition"
  />

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Texte</legend>
        <div class="grid grid-cols-1 gap-3">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Werbe-/Endtext</span>
            <textarea
              class="textarea textarea-bordered min-h-20 w-full"
              maxlength="10000"
              bind:value={footer}
            ></textarea>
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Interne Notiz</span>
            <textarea
              class="textarea textarea-bordered min-h-20 w-full"
              maxlength="2000"
              bind:value={notes}
            ></textarea>
          </label>
        </div>
      </fieldset>
    </div>
  </div>

  <div class="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      onclick={() => goto('/invoices')}
      disabled={busy.active}
    >
      Abbrechen
    </button>
    <button type="submit" class="btn btn-primary" disabled={busy.active}>
      {#if busy.active}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      Rechnung speichern
    </button>
  </div>
</form>

{#if zeroOpen}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Position mit Endpreis 0 €</h3>
      <p class="text-base-content/70 mt-2 text-sm">
        {zeroRows.length === 1
          ? 'Eine Position'
          : `${zeroRows.length} Positionen`} hat einen Netto-Endpreis von 0 €. Soll
        die Rechnung trotzdem so gespeichert werden?
      </p>
      <ul class="border-base-300 mt-3 divide-y rounded border text-sm">
        {#each zeroRows as r, i (i)}
          <li class="flex items-center justify-between gap-3 p-2">
            <span class="truncate">{r.description}</span>
            <span class="text-base-content/60 text-xs whitespace-nowrap">
              {r.reason}
            </span>
          </li>
        {/each}
      </ul>
      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelZero}
          disabled={busy.active}
        >
          Zurück zur Eingabe
        </button>
        <button
          type="button"
          class="btn btn-warning"
          onclick={confirmZero}
          disabled={busy.active}
        >
          Trotzdem speichern
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      onclick={cancelZero}
      aria-label="Schließen">close</button
    >
  </div>
{/if}
